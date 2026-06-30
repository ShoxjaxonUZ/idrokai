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

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function systemPrompt(p, level) {
  const levelBlock = level
    ? `The learner's level is about ${level} (CEFR). Calibrate ALL your language to this level — vocabulary, grammar and sentence length.`
    : `You DON'T know the learner's level yet. In your first 1-2 turns, gently gauge it with simple, natural questions (NEVER call it a test or exam). As soon as you can estimate it, set "level" to a CEFR band and, in your reply, warmly tell them their approximate level in one short friendly phrase, then continue at that level.`

  return `You are ${p.name}, a warm and encouraging ${p.langName} speaking partner for an Uzbek learner.
GOAL: keep the learner TALKING and feeling HAPPY and confident. This is free conversation practice, NOT an exam.

LEVEL DETECTION: ${levelBlock}

CALIBRATION BY LEVEL:
- A1/A2: very simple high-frequency words, short and slow sentences; if they are stuck you may add a tiny hint.
- B1/B2: natural everyday ${p.langName}, moderate vocabulary.
- C1/C2: rich, natural, idiomatic ${p.langName}.

RULES:
- Reply ONLY in ${p.langName}, SHORT (1-2 sentences max — it will be spoken aloud).
- Be warm, positive and motivating. Celebrate effort. Never criticize harshly.
- ALWAYS end your reply with an easy, open follow-up question so the conversation never stops.
- If the learner made a clear language mistake, give ONE short, gentle correction tip (with the correct form), but never interrupt the flow.

Return ONLY JSON, nothing else:
{"reply": "<your short spoken reply in ${p.langName}>", "tip": "<optional one short gentle correction written in Uzbek, or empty>", "level": "<CEFR band A1/A2/B1/B2/C1/C2 if known or just estimated, else empty>"}`
}

// LLM suhbat — userText (yoki start) → {reply, tip, level}. /talk va /chat shuni ishlatadi.
async function converse({ lang, userText, history, start, level }) {
  const persona = PERSONAS[lang] || PERSONAS.en
  const curLevel = LEVELS.includes(level) ? level : ''
  const messages = [{ role: 'system', content: systemPrompt(persona, curLevel) }]
  for (const m of (Array.isArray(history) ? history.slice(-10) : [])) {
    if (m && m.text && (m.role === 'user' || m.role === 'ai')) {
      messages.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: String(m.text).slice(0, 500) })
    }
  }
  messages.push({
    role: 'user',
    content: start
      ? '(The learner just opened the app. Greet them warmly and ask one easy opening question to start gauging their level.)'
      : userText
  })

  const gr = await groqFetch({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.7,
    max_tokens: 240
  })
  if (!gr.ok) { const e = new Error('AI band'); e.status = 502; throw e }

  const data = await gr.json()
  const text = data.choices?.[0]?.message?.content || ''
  const parsed = extractAndParseJson(text) || {}
  const detected = String(parsed.level || '').toUpperCase().trim()
  return {
    reply: String(parsed.reply || text || '').slice(0, 500).trim(),
    tip: String(parsed.tip || '').slice(0, 200).trim(),
    level: LEVELS.includes(detected) ? detected : (curLevel || '')
  }
}

function parseHistory(raw) {
  try { const h = JSON.parse(raw || '[]'); return Array.isArray(h) ? h : [] } catch { return [] }
}

// POST /api/speaking/chat — matnli (jonli brauzer STT uchun, eng tez)
router.post('/chat', auth, async (req, res) => {
  try {
    const lang = req.body.lang === 'ru' ? 'ru' : 'en'
    const start = req.body.start === true || req.body.start === 'true'
    const userText = String(req.body.text || '').trim().slice(0, 1000)
    if (!start && !userText) return res.status(400).json({ message: 'Matn yo\'q' })

    const { reply, tip, level } = await converse({ lang, userText, history: req.body.history, start, level: req.body.level })
    res.json({ userText, reply, tip, level })
  } catch (err) {
    if (err.status === 502) return res.status(502).json({ message: 'AI band — qayta urinib ko\'ring.' })
    console.error('[speaking] chat error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST /api/speaking/talk — audio (Whisper STT, brauzer SpeechRecognition'ni qo'llamasa fallback)
router.post('/talk', auth, upload.single('audio'), async (req, res) => {
  try {
    const lang = req.body.lang === 'ru' ? 'ru' : 'en'
    const start = req.body.start === 'true' || req.body.start === '1'

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

    const { reply, tip, level } = await converse({ lang, userText, history: parseHistory(req.body.history), start, level: req.body.level })
    res.json({ userText, reply, tip, level })
  } catch (err) {
    if (err.status === 502) return res.status(502).json({ message: 'AI band — qayta urinib ko\'ring.' })
    console.error('[speaking] error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
