const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth } = require('../middleware/auth')
const { generateQuestions } = require('../lib/quizGen')

const { isSubscribed } = require('../lib/subscription')

const MAX_TOPIC_LEN = 200
const MAX_MESSAGE_LEN = 2000
const MAX_HISTORY = 10
const MAX_HISTORY_CONTENT = 4000
const DAILY_LIMIT = 20
const SUBSCRIBED_DAILY_LIMIT = 100 // obunachilar uchun kengaytirilgan kunlik limit
const LESSON_HELP_LIMIT = 20 // dars AI yordami uchun alohida kunlik limit

// Obunachi bo'lsa kengaytirilgan limit, aks holda bazaviy.
const getDailyLimit = async (userId) =>
  (await isSubscribed(userId)) ? SUBSCRIBED_DAILY_LIMIT : DAILY_LIMIT
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // ~4MB

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const TEXT_MODEL = 'llama-3.3-70b-versatile'

const validateImage = (image) => {
  if (!image) return null
  if (typeof image !== 'string') return 'Rasm formati noto\'g\'ri'
  const m = image.match(/^data:(image\/(jpeg|jpg|png|webp|gif));base64,(.+)$/i)
  if (!m) return 'Rasm formati qo\'llanmaydi (JPG/PNG/WEBP/GIF)'
  // base64 length × 0.75 ≈ bytes
  const approxBytes = Math.floor(m[3].length * 0.75)
  if (approxBytes > MAX_IMAGE_BYTES) return 'Rasm juda katta (max 4MB)'
  return null
}

const { groqFetch } = require('../lib/groq')

router.post('/generate-quiz', auth, async (req, res) => {
  try {
    const { topic, count = 5 } = req.body
    if (typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ message: 'Mavzu kiritilmagan' })
    }
    if (topic.length > MAX_TOPIC_LEN) {
      return res.status(400).json({ message: 'Mavzu juda uzun' })
    }
    const safeCount = Math.min(parseInt(count) || 5, 20)
    const safeTopic = topic.trim().slice(0, MAX_TOPIC_LEN)

    const today = new Date().toISOString().split('T')[0]
    const limit = await getDailyLimit(req.user.id)

    // Kunlik limit tekshiruvi (AI xarajatini cheklash uchun — /teacher bilan bir xil hisoblagich)
    const usageRes = await pool.query(
      'SELECT count FROM ai_teacher_usage WHERE user_id = $1 AND usage_date = $2',
      [req.user.id, today]
    )
    const currentCount = usageRes.rows[0]?.count || 0
    if (currentCount >= limit) {
      return res.status(429).json({
        message: `Kunlik limit tugadi (${currentCount}/${limit}). Ertaga qayta urinib ko'ring!`,
        limitReached: true,
        used: currentCount,
        limit
      })
    }

    const prompt = `Sen ta'lim platformasi uchun test savollari yaratuvchi assistentsan. To'g'ri javoblar TASODIFIY taqsimlangan bo'lsin — A, B, C, D barchasi har xil savollarda to'g'ri bo'lib chiqsin (faqat bir variantga to'plama).

Mavzu: "${safeTopic}"
Savollar soni: ${safeCount}

Quyidagi JSON formatda ${safeCount} ta test savoli yarat. Faqat sof JSON qaytargin, boshqa hech narsa yozma:
{"questions":[{"question":"Savol matni","options":["A variant","B variant","C variant","D variant"],"correct":0}]}

"correct" — to'g'ri javob indeksi (0=A, 1=B, 2=C, 3=D).`

    const gen = await generateQuestions(prompt, { maxTokens: 3000 })
    if (gen.error) {
      return res.status(gen.error.status).json({ message: gen.error.message })
    }
    if (gen.questions.length === 0) {
      return res.status(500).json({ message: "AI savollar yaratolmadi" })
    }

    // Muvaffaqiyatli javobdan keyingina hisoblagichni oshiramiz
    await pool.query(
      `INSERT INTO ai_teacher_usage (user_id, usage_date, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, usage_date) DO UPDATE SET count = ai_teacher_usage.count + 1`,
      [req.user.id, today]
    )

    res.json({ questions: gen.questions })

  } catch (err) {
    console.error('AI route xatosi:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/teacher', auth, async (req, res) => {
  const userId = req.user.id

  try {
    const { message, history, image } = req.body

    if (typeof message !== 'string' || (!message.trim() && !image)) {
      return res.status(400).json({ message: 'Savol yoki rasm kiriting' })
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return res.status(400).json({ message: 'Savol juda uzun' })
    }
    const imgErr = validateImage(image)
    if (imgErr) {
      console.warn('[AI Teacher] image validation failed:', imgErr)
      return res.status(400).json({ message: imgErr })
    }

    const today = new Date().toISOString().split('T')[0]
    const limit = await getDailyLimit(userId)

    const usageRes = await pool.query(
      'SELECT count FROM ai_teacher_usage WHERE user_id = $1 AND usage_date = $2',
      [userId, today]
    )

    const currentCount = usageRes.rows[0]?.count || 0

    if (currentCount >= limit) {
      return res.status(429).json({
        message: `Kunlik limit tugadi (${currentCount}/${limit}). Ertaga qayta urinib ko'ring!`,
        limitReached: true,
        used: currentCount,
        limit
      })
    }

    const detectPrompt = `Quyidagi savol qaysi sohaga tegishli? FAQAT BITTA so'z bilan javob bering:
- "dasturlash" (kod, programming, web, JS, Python va h.k.)
- "matematika" (algebra, geometriya, hisoblash, formulalar)
- "fizika" (kinematika, elektr, optika, mexanika)
- "ingliz" (english, grammar, words, til o'rganish)
- "umumiy" (boshqa mavzular)

Savol: "${message.slice(0, 500)}"

Faqat soha nomini yozing, tushuntirmay.`

    let subject = 'umumiy'
    if (!image) try {
      const detectRes = await groqFetch({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: detectPrompt }],
        temperature: 0.1,
        max_tokens: 20
      }, 10000)
      const detectData = await detectRes.json()
      const detected = (detectData.choices?.[0]?.message?.content || '').toLowerCase().trim()

      if (detected.includes('dasturlash') || detected.includes('programming')) subject = 'dasturlash'
      else if (detected.includes('matematika') || detected.includes('math')) subject = 'matematika'
      else if (detected.includes('fizika') || detected.includes('physics')) subject = 'fizika'
      else if (detected.includes('ingliz') || detected.includes('english')) subject = 'ingliz'
    } catch (err) {
      console.error('Detect error:', err)
    }

    const systemPrompts = {
      dasturlash: `Sen tajribali DASTURLASH USTOZ ISAN. 10+ yil tajribang bor. Vazifang:
- Foydalanuvchiga kod yozish, algoritmlar, data structures, web dev, mobil dev haqida o'rgatish
- Kod misollar markdown \`\`\` ichida yozish
- O'zbek tilida (lotin yozuvi), oddiy va aniq tushuntirish
- Praktik misollar bilan yondashuv`,

      matematika: `Sen tajribali MATEMATIKA O'QITUVCHISISAN. Vazifang:
- Matematika masalalarini bosqichma-bosqich yechib ko'rsatish
- Formulalarni aniq yozish va tushuntirish
- O'zbek tilida (lotin yozuvi)

MUHIM QOIDA:
- HECH QACHON dasturlash kod bloklari ishlatma
- Formulalar uchun: x², √(a+b), π, ∫, Σ, ≤, ≥
- Yechishni qadamlar bilan ko'rsat`,

      fizika: `Sen tajribali FIZIKA O'QITUVCHISISAN. Vazifang:
- Fizika qonunlari va formulalarini tushuntirish
- Masalalarni qadamma-qadam yechish
- O'zbek tilida (lotin yozuvi)
- Kod bloklari ishlatma — faqat formulalar`,

      ingliz: `Sen tajribali INGLIZ TILI O'QITUVCHISISAN. Vazifang:
- Grammatika qoidalarini tushuntirish
- So'z boyligini oshirish
- Javoblarni O'ZBEK TILIDA (lotin yozuvi)

MUHIM QOIDA:
- HECH QACHON kod bloklari ishlatma!
- Ingliz misollarini quyidagicha yoz:
  Misol: I have been working here for 5 years.
  Tarjima: Men bu yerda 5 yildan beri ishlayapman.`,

      umumiy: `Sen do'stona AI USTOZ SAN. Foydalanuvchi savoliga aniq, oddiy va do'stona javob ber. O'zbek tilida (lotin yozuvi). Markdown \`\`\` kod uchun ishlatishing mumkin.`
    }

    const systemPrompt = (systemPrompts[subject] || systemPrompts.umumiy) + `

UMUMIY QOIDALAR:
- Javob 200-500 so'z oralig'ida
- Aniq, tushunarli, do'stona uslub`

    // Vision so'rovi alohida ko'rib chiqiladi — history o'rniga toza
    // (system + user[text+image]) yuboramiz, chunki history'dagi eski matn
    // xabarlari rasm tahlilini chalkashtirishi mumkin.
    const messages = [{ role: 'system', content: systemPrompt }]

    if (image) {
      const userText = !message.trim()
        ? 'Bu rasmni diqqat bilan tahlil qil va men uchun tushuntir.'
        : message
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: image } }
        ]
      })
    } else {
      if (Array.isArray(history) && history.length > 0) {
        history.slice(-MAX_HISTORY).forEach(h => {
          if (!h || typeof h.content !== 'string') return
          messages.push({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content.slice(0, MAX_HISTORY_CONTENT)
          })
        })
      }
      messages.push({ role: 'user', content: message })
    }

    const modelToUse = image ? VISION_MODEL : TEXT_MODEL

    let groqRes
    try {
      groqRes = await groqFetch({
        model: modelToUse,
        messages,
        temperature: image ? 0.4 : 0.7,
        max_tokens: 1500
      }, image ? 60000 : 30000)
    } catch (err) {
      console.error('Groq fetch failed:', err.message)
      return res.status(504).json({ message: 'AI javob bermadi (timeout yoki ulanish xatosi)' })
    }

    const data = await groqRes.json()
    if (!groqRes.ok || !data.choices?.[0]?.message?.content) {
      console.error('Groq API error (status', groqRes.status, '):', JSON.stringify(data, null, 2))
      const errMsg = data?.error?.message || `AI javob bermadi (HTTP ${groqRes.status})`
      return res.status(502).json({ message: errMsg })
    }

    await pool.query(
      `INSERT INTO ai_teacher_usage (user_id, usage_date, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, usage_date)
       DO UPDATE SET count = ai_teacher_usage.count + 1, updated_at = NOW()`,
      [userId, today]
    )

    res.json({
      answer: data.choices[0].message.content,
      subject,
      used: currentCount + 1,
      limit,
      remaining: limit - (currentCount + 1)
    })
  } catch (err) {
    console.error('AI Teacher error:', err)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

router.get('/teacher/usage', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const result = await pool.query(
      'SELECT count FROM ai_teacher_usage WHERE user_id = $1 AND usage_date = $2',
      [req.user.id, today]
    )

    const used = result.rows[0]?.count || 0
    const limit = await getDailyLimit(req.user.id)
    res.json({ used, limit, remaining: Math.max(0, limit - used) })
  } catch {
    res.status(500).json({ message: 'Xatolik' })
  }
})

// ====== Dars AI yordami (video darsni tushuntirish) ======
// Alohida kunlik limit (AI Teacher'dan mustaqil).

router.get('/lesson-help/usage', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const r = await pool.query(
      'SELECT count FROM lesson_help_usage WHERE user_id = $1 AND usage_date = $2',
      [req.user.id, today]
    )
    const used = r.rows[0]?.count || 0
    res.json({ used, limit: LESSON_HELP_LIMIT, remaining: Math.max(0, LESSON_HELP_LIMIT - used) })
  } catch {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/lesson-help', auth, async (req, res) => {
  try {
    const { courseTitle, lessonTitle, lessonDescription, question, timestamp } = req.body || {}
    if (typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ message: 'Savol kiriting' })
    }
    if (question.length > MAX_MESSAGE_LEN) {
      return res.status(400).json({ message: 'Savol juda uzun' })
    }

    const today = new Date().toISOString().split('T')[0]
    const usageRes = await pool.query(
      'SELECT count FROM lesson_help_usage WHERE user_id = $1 AND usage_date = $2',
      [req.user.id, today]
    )
    const used = usageRes.rows[0]?.count || 0
    if (used >= LESSON_HELP_LIMIT) {
      return res.status(429).json({
        message: `Kunlik dars-yordam limiti tugadi (${LESSON_HELP_LIMIT}/${LESSON_HELP_LIMIT}). Ertaga davom eting!`,
        limitReached: true, used, limit: LESSON_HELP_LIMIT
      })
    }

    // Vaqt belgisi (sekund) -> "MM:SS" ko'rinishi
    let timeNote = ''
    const ts = Number(timestamp)
    if (Number.isFinite(ts) && ts > 0) {
      const m = Math.floor(ts / 60)
      const s = Math.floor(ts % 60)
      timeNote = `\nTalaba videoning ~${m}:${String(s).padStart(2, '0')} daqiqasida turibdi.`
    }

    const prompt = `Sen ta'lim platformasidagi DARS YORDAMCHISI AI'san. Talaba video darsni ko'rib, tushunmagan joyini so'rayapti.

KURS: "${String(courseTitle || '').slice(0, 200)}"
DARS: "${String(lessonTitle || '').slice(0, 200)}"
${lessonDescription ? `DARS TAVSIFI: "${String(lessonDescription).slice(0, 500)}"` : ''}${timeNote}

TALABA SAVOLI: "${question.slice(0, MAX_MESSAGE_LEN)}"

QOIDALAR:
- O'zbek tilida (lotin yozuvi), oddiy va tushunarli tushuntir
- Dars mavzusi doirasida javob ber, kerak bo'lsa misol keltir
- Qisqa va aniq (150-350 so'z)
- Markdown ishlatishing mumkin (kod bloklari, ro'yxatlar)
- Sen videoni ko'rmaysan — mavzu va savol bo'yicha tushuntir`

    let groqRes
    try {
      groqRes = await groqFetch({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 1200
      }, 30000)
    } catch {
      return res.status(504).json({ message: 'AI javob bermadi (timeout)' })
    }

    const data = await groqRes.json()
    if (!groqRes.ok || !data.choices?.[0]?.message?.content) {
      return res.status(502).json({ message: 'AI xizmatida xatolik' })
    }

    await pool.query(
      `INSERT INTO lesson_help_usage (user_id, usage_date, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, usage_date)
       DO UPDATE SET count = lesson_help_usage.count + 1, updated_at = NOW()`,
      [req.user.id, today]
    )

    res.json({
      answer: data.choices[0].message.content,
      used: used + 1,
      limit: LESSON_HELP_LIMIT,
      remaining: Math.max(0, LESSON_HELP_LIMIT - (used + 1))
    })
  } catch (err) {
    console.error('Lesson help error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
