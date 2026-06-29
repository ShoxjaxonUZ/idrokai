const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth } = require('../middleware/auth')
const { extractAndParseJson } = require('../lib/jsonParse')

const MAX_INTERESTS = 20
const MAX_INTEREST_LEN = 50
const MAX_CHAT_HISTORY_LEN = 4000
const MAX_CHAT_MESSAGES = 30
const MAX_MESSAGE_LEN = 1000

const cleanString = (v, max = 100) =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

const cleanInterests = (v) => {
  if (!Array.isArray(v)) return []
  return v
    .map(x => cleanString(x, MAX_INTEREST_LEN))
    .filter(Boolean)
    .slice(0, MAX_INTERESTS)
}

const { groqFetch } = require('../lib/groq')

// Matnni solishtirish uchun normallashtirish (katta-kichik harf, apostroflar)
const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/['`']/g, '')

// Daraja -> son (1=boshlovchi, 2=o'rta, 3=yuqori)
const levelOf = (daraja) => {
  const d = norm(daraja)
  if (d.includes('boshlov')) return 1
  if (d.includes('yuqori') || d.includes('advanced')) return 3
  return 2
}

// DETERMINISTIK kurs tanlash — natija doim bir xil va tiniq.
// Soha (kategoriya) mosligi asosiy signal, maqsad esa darajani tartiblaydi.
function rankCourses(allCourses, { preferredField, goal }) {
  const field = norm(preferredField)
  const g = norm(goal)
  // Maqsad ilg'or darajani talab qiladimi? ("o'sish", "sertifikat", "karyera")
  const wantsAdvanced = /(sish|sertifikat|karyera|daraja)/.test(g)

  const levelScore = (daraja) => {
    const lvl = levelOf(daraja)
    if (wantsAdvanced) return lvl === 3 ? 15 : lvl === 2 ? 10 : 4
    return lvl === 1 ? 15 : lvl === 2 ? 10 : 4 // standart: boshlovchidan boshlash
  }

  return allCourses
    .map(c => {
      const cat = norm(c.category)
      let score = 0
      if (field) {
        if (cat === field) score += 100               // aniq kategoriya mosligi
        else if (cat && (cat.includes(field) || field.includes(cat))) score += 70
        else {
          const hay = norm(`${c.title} ${c.description || ''}`)
          if (field.length >= 3 && hay.includes(field)) score += 40 // matnda eslatilgan
        }
      }
      score += levelScore(c.daraja)
      return { course: c, score }
    })
    .sort((a, b) => b.score - a.score || levelOf(a.course.daraja) - levelOf(b.course.daraja))
}

router.get('/status', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT onboarded FROM users WHERE id = $1', [req.user.id])
    const profile = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1', [req.user.id])
    res.json({
      onboarded: result.rows[0]?.onboarded || false,
      profile: profile.rows[0] || null
    })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/complete', auth, async (req, res) => {
  try {
    const ageGroup = cleanString(req.body.ageGroup, 30)
    const goal = cleanString(req.body.goal, 100)
    const experience = cleanString(req.body.experience, 30)
    const interests = cleanInterests(req.body.interests)
    const availableTime = cleanString(req.body.availableTime, 30)
    const preferredField = cleanString(req.body.preferredField, 50)
    const chatHistory = cleanString(req.body.chatHistory, MAX_CHAT_HISTORY_LEN)

    // Minimal validatsiya — bo'sh profil bilan onboarding tugatilmasin
    if (!goal && !preferredField && !availableTime) {
      return res.status(400).json({ message: 'Iltimos, savollarga javob bering' })
    }

    const coursesRes = await pool.query('SELECT id, title, category, daraja, description FROM courses')
    const allCourses = coursesRes.rows

    // Faqat mavjud (bo'sh bo'lmagan) maydonlarni promptga qo'shamiz
    const userInfo = [
      ageGroup && `- Yosh guruhi: ${ageGroup}`,
      goal && `- Maqsad: ${goal}`,
      experience && `- Tajriba: ${experience}`,
      interests.length && `- Qiziqishlari: ${interests.join(', ')}`,
      availableTime && `- Mavjud vaqt (kunlik): ${availableTime}`,
      preferredField && `- Afzal soha: ${preferredField}`
    ].filter(Boolean).join('\n')

    // ===== 1) DETERMINISTIK KURS TANLASH (tiniq, doim bir xil natija) =====
    const ranked = rankCourses(allCourses, { preferredField, goal })
    // Sohaga aniq mos kelganlar (kategoriya mosligi: score >= 70)
    const matched = ranked.filter(r => r.score >= 70).slice(0, 5)
    let recommendedCourses = matched.map(r => r.course)
    // Kamida 3 ta bo'lsin — yetmasa eng yuqori ballilardan to'ldiramiz
    if (recommendedCourses.length < 3) {
      for (const r of ranked) {
        if (recommendedCourses.length >= 3) break
        if (!recommendedCourses.find(c => c.id === r.course.id)) {
          recommendedCourses.push(r.course)
        }
      }
    }

    // ===== 2) AI faqat MASLAHAT MATNINI yozadi (tanlangan kurslar bo'yicha) =====
    // Standart shablon — AI ishlamasa ham mazmunli javob qaytadi.
    const firstCourse = recommendedCourses[0]
    let aiAdvice = firstCourse
      ? `Tanlovingiz va maqsadingizga qarab eng mos kurslarni tanladik. "${firstCourse.title}" kursidan boshlashni tavsiya qilamiz — u sizning yo'nalishingizga to'g'ri keladi.`
      : 'Sizning qiziqishlaringizga mos kurslar tanlandi.'
    let studyPlan = availableTime
      ? `Har kuni ${availableTime} ajrating va birinchi kursdan boshlang. Har dars oxirida mashqlarni bajaring va izchillikni saqlang — natija shunda ko'rinadi.`
      : 'Birinchi kursdan boshlang, har kuni 1-2 ta darsdan o\'qing va izchillikni saqlang.'

    try {
      const prompt = `Sen Eduzy ta'lim platformasining do'stona konsultantsisan.

FOYDALANUVCHI MA'LUMOTLARI:
${userInfo}
${chatHistory ? `\nQO'SHIMCHA SUHBAT:\n${chatHistory}` : ''}

UNGA TANLANGAN KURSLAR (shu kurslar bo'yicha gaplash, BOSHQA kurs taklif qilma):
${recommendedCourses.map((c, i) => `${i + 1}. "${c.title}" — ${c.category}, ${c.daraja}`).join('\n')}

VAZIFA: Faqat shu tanlangan kurslar haqida do'stona maslahat va o'qish rejasi yoz.

JAVOB FAQAT JSON formatda:
{
  "advice": "2-3 jumlali tavsiya o'zbek tilida — nega bu kurslar mos va qaysi biridan boshlash kerak",
  "studyPlan": "Qisqa o'qish rejasi — 3-4 jumla, kunlik vaqtni hisobga olib"
}`

      const groqRes = await groqFetch({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 600
      })

      const aiData = await groqRes.json()
      const text = aiData.choices?.[0]?.message?.content || ''
      const parsed = extractAndParseJson(text)
      if (parsed) {
        if (parsed.advice) aiAdvice = String(parsed.advice).slice(0, 1000)
        if (parsed.studyPlan) studyPlan = String(parsed.studyPlan).slice(0, 1000)
      }
    } catch (aiErr) {
      console.warn('[onboarding] AI advice fallback:', (aiErr.message || aiErr).slice?.(0, 80))
      // Shablon javob ishlatiladi — kurs tanlash baribir to'g'ri.
    }

    const courseIds = recommendedCourses.map(c => String(c.id))

    const existing = await pool.query('SELECT id FROM user_profiles WHERE user_id = $1', [req.user.id])

    if (existing.rows.length > 0) {
      await pool.query(`
        UPDATE user_profiles
        SET age_group = $1, goal = $2, experience = $3, interests = $4,
            available_time = $5, preferred_field = $6, recommended_courses = $7,
            ai_advice = $8, completed_at = NOW()
        WHERE user_id = $9
      `, [ageGroup, goal, experience, interests, availableTime, preferredField, courseIds, aiAdvice, req.user.id])
    } else {
      await pool.query(`
        INSERT INTO user_profiles (user_id, age_group, goal, experience, interests, available_time, preferred_field, recommended_courses, ai_advice, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [req.user.id, ageGroup, goal, experience, interests, availableTime, preferredField, courseIds, aiAdvice])
    }

    await pool.query('UPDATE users SET onboarded = TRUE WHERE id = $1', [req.user.id])

    res.json({
      success: true,
      recommendedCourses,
      advice: aiAdvice,
      studyPlan
    })
  } catch (err) {
    console.error('Onboarding complete error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/chat', auth, async (req, res) => {
  try {
    const { messages, profileData } = req.body
    if (!Array.isArray(messages)) return res.status(400).json({ message: 'messages noto\'g\'ri' })

    const cleanMessages = messages
      .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-MAX_CHAT_MESSAGES)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LEN) }))

    const profile = profileData && typeof profileData === 'object' ? profileData : {}

    const turns = cleanMessages.filter(m => m.role === 'user').length

    const systemPrompt = `Sen Eduzy ta'lim platformasining do'stona AI konsultantsisan. O'ZBEK TILIDA suhbatlash.

FOYDALANUVCHI HAQIDA OLDINDAN MA'LUMOT:
- Yosh: ${cleanString(profile.ageGroup, 30) || 'noma\'lum'}
- Maqsad: ${cleanString(profile.goal, 100) || 'noma\'lum'}
- Tajriba: ${cleanString(profile.experience, 30) || 'noma\'lum'}
- Qiziqishlari: ${cleanInterests(profile.interests).join(', ') || 'noma\'lum'}

SUHBAT QOIDALARI:
1. Foydalanuvchining oldin bergan javoblariga BOG'LIQ tarzda gaplash
2. Har xabarda BITTA aniq savol ber (ko'p emas)
3. Javoblarni QISQA va aniq qil (2-3 jumla)
4. Foydalanuvchi qiziqishlariga qarab MAVZULARGA chuqur kir

HOZIRGI HOLAT: Suhbatda ${turns} ta javob bor.

${turns >= 3
  ? `MUHIM: Endi yetarli ma'lumot to'plandi. Foydalanuvchiga qisqacha xulosa ayting va Eduzy platformasidagi mos kurslarni tavsiya qilishga tayyorligingizni bildiring.`
  : `HOZIR: Foydalanuvchini chuqurroq tushunish uchun yana 1-2 ta savol bering.`
}

Foydalanuvchi xabariga mos javob bering — qisqa va do'stona.`

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...cleanMessages
    ]

    let groqRes
    try {
      groqRes = await groqFetch({
        model: 'llama-3.3-70b-versatile',
        messages: aiMessages,
        temperature: 0.7,
        max_tokens: 250
      })
    } catch {
      return res.status(504).json({ message: 'AI javob bermadi' })
    }

    const data = await groqRes.json()
    const answer = data.choices?.[0]?.message?.content || 'Kechirasiz, javob berolmadim.'

    res.json({ answer, readyForRecommendations: turns >= 3 })
  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

module.exports = router
