// AI Speaking Partner (prototip) — erkin muloqotli suhbatdosh.
// Oqim: audio → Groq Whisper (matn) → Groq LLM (rag'batli suhbat) → matn javob.
// Ovozga aylantirish (TTS) frontend'da brauzer speechSynthesis orqali.

const express = require('express')
const multer = require('multer')
const router = express.Router()
const { auth } = require('../middleware/auth')
const { groqFetch } = require('../lib/groq')
const { extractAndParseJson } = require('../lib/jsonParse')
const { transcribe } = require('../lib/whisper')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 } // ~12MB audio yetarli
})

const PERSONAS = {
  en: { name: 'Eva', langName: 'English' },
  ru: { name: 'Anya', langName: 'Russian' }
}

function systemPrompt(p) {
  return `You are ${p.name}, a warm and encouraging ${p.langName} speaking partner for an Uzbek learner.
GOAL: keep the learner TALKING and feeling HAPPY and confident. This is free conversation practice, NOT an exam.
RULES:
- Reply ONLY in ${p.langName}, simple and SHORT (1-2 sentences max — it will be spoken aloud).
- Be warm, positive and motivating. Celebrate effort. Never criticize harshly.
- ALWAYS end your reply with an easy, open follow-up question so the conversation never stops.
- If the learner made a clear language mistake, give ONE short, gentle correction tip (with the correct form), but never interrupt the flow.
- If the learner is just starting, greet warmly and ask an easy opening question.
Return ONLY JSON, nothing else:
{"reply": "<your short spoken reply in ${p.langName}>", "tip": "<optional one short gentle correction written in Uzbek, or empty string>"}`
}

router.post('/talk', auth, upload.single('audio'), async (req, res) => {
  try {
    const lang = req.body.lang === 'ru' ? 'ru' : 'en'
    const persona = PERSONAS[lang]
    const start = req.body.start === 'true' || req.body.start === '1'

    let history = []
    try { history = JSON.parse(req.body.history || '[]') } catch {}
    if (!Array.isArray(history)) history = []
    history = history.slice(-10)

    // 1) Foydalanuvchi nutqini matnga aylantirish (start bo'lmasa)
    let userText = ''
    if (!start) {
      if (!req.file) return res.status(400).json({ message: "Audio yo'q" })
      try {
        userText = await transcribe(req.file.buffer, { lang, mime: req.file.mimetype })
      } catch (e) {
        console.error('[speaking] whisper:', e.message)
        return res.status(502).json({ message: "Ovozni tanib bo'lmadi — qayta urinib ko'ring." })
      }
      if (!userText) {
        return res.json({
          userText: '',
          reply: lang === 'ru'
            ? 'Извини, я не расслышала. Повтори, пожалуйста?'
            : "Sorry, I didn't catch that. Could you say it again?",
          tip: ''
        })
      }
    }

    // 2) LLM suhbat
    const messages = [{ role: 'system', content: systemPrompt(persona) }]
    for (const m of history) {
      if (m && m.text && (m.role === 'user' || m.role === 'ai')) {
        messages.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: String(m.text).slice(0, 500) })
      }
    }
    messages.push({
      role: 'user',
      content: start
        ? '(The learner just opened the app. Greet them warmly and ask one easy opening question.)'
        : userText
    })

    const gr = await groqFetch({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 220
    })
    if (!gr.ok) return res.status(502).json({ message: 'AI band — qayta urinib ko\'ring.' })

    const data = await gr.json()
    const text = data.choices?.[0]?.message?.content || ''
    const parsed = extractAndParseJson(text) || {}
    const reply = String(parsed.reply || text || '').slice(0, 500).trim()
    const tip = String(parsed.tip || '').slice(0, 200).trim()

    res.json({ userText, reply, tip })
  } catch (err) {
    console.error('[speaking] error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
