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

    const coursesRes = await pool.query('SELECT id, title, category, daraja, description FROM courses')
    const allCourses = coursesRes.rows

    const prompt = `Sen IdrokAI ta'lim platformasining konsultantsisan. Foydalanuvchining ma'lumotlariga qarab eng mos KURSLARNI tavsiya qil.

FOYDALANUVCHI MA'LUMOTLARI:
- Yosh guruhi: ${ageGroup}
- Maqsad: ${goal}
- Tajriba: ${experience}
- Qiziqishlari: ${interests.join(', ')}
- Mavjud vaqt (kunlik): ${availableTime}
- Afzal soha: ${preferredField}

${chatHistory ? `\nQO'SHIMCHA SUHBAT:\n${chatHistory}` : ''}

MAVJUD KURSLAR:
${allCourses.map(c => `- ID: ${c.id} | "${c.title}" | Kategoriya: ${c.category} | Daraja: ${c.daraja}`).join('\n')}

VAZIFA:
1. Foydalanuvchiga eng mos 3-5 ta kursni tanlang
2. Nimaga shu kurslarni tanlaganingizni tushuntiring
3. Maslahat bering — qaysi kursdan boshlash kerak

JAVOB FAQAT JSON formatda:
{
  "courseIds": ["id1", "id2", "id3"],
  "advice": "2-3 jumlali tavsiya o'zbek tilida (do'stona uslubda)",
  "studyPlan": "Qisqa o'qish rejasi — 3-4 jumla"
}`

    let recommendedCourses = []
    let aiAdvice = ''
    let studyPlan = ''

    try {
      const groqRes = await groqFetch({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 1000
      })

      const aiData = await groqRes.json()
      const text = aiData.choices?.[0]?.message?.content || ''
      const parsed = extractAndParseJson(text)

      if (parsed) {
        recommendedCourses = (parsed.courseIds || [])
          .map(id => allCourses.find(c => String(c.id) === String(id)))
          .filter(Boolean)
        aiAdvice = String(parsed.advice || '').slice(0, 1000)
        studyPlan = String(parsed.studyPlan || '').slice(0, 1000)
      }
    } catch (aiErr) {
      console.warn('[onboarding] AI fallback:', (aiErr.message || aiErr).slice?.(0, 80))
      const lowField = preferredField.toLowerCase()
      if (lowField) {
        recommendedCourses = allCourses
          .filter(c => (c.category || '').toLowerCase().includes(lowField))
          .slice(0, 5)
      }
      aiAdvice = 'Sizning qiziqishlaringizga mos kurslar tanlandi.'
      studyPlan = 'Birinchi kursdan boshlang, har kuni 1-2 ta darsdan o\'qing.'
    }

    if (recommendedCourses.length < 3) {
      const remaining = allCourses
        .filter(c => !recommendedCourses.find(r => r.id === c.id))
        .slice(0, 3 - recommendedCourses.length)
      recommendedCourses = [...recommendedCourses, ...remaining]
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

    const systemPrompt = `Sen IdrokAI ta'lim platformasining do'stona AI konsultantsisan. O'ZBEK TILIDA suhbatlash.

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
  ? `MUHIM: Endi yetarli ma'lumot to'plandi. Foydalanuvchiga qisqacha xulosa ayting va IdrokAI platformasidagi mos kurslarni tavsiya qilishga tayyorligingizni bildiring.`
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
