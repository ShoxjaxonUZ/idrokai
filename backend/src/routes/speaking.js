// AI Speaking Partner (prototip) — erkin muloqotli suhbatdosh.
// Oqim: audio → Groq Whisper (matn) → Groq LLM (rag'batli suhbat) → matn javob.
// Ovozga aylantirish (TTS) frontend'da brauzer speechSynthesis orqali.

const express = require('express')
const multer = require('multer')
const router = express.Router()
const pool = require('../db')
const { auth } = require('../middleware/auth')
const { groqFetch } = require('../lib/groq')
const { extractAndParseJson } = require('../lib/jsonParse')
const { transcribe } = require('../lib/whisper')
const { synthesize } = require('../lib/tts')
const r2 = require('../lib/r2')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 } // ~12MB audio yetarli
})

// Butun sessiya ovozi — bir necha daqiqa webm ~ bir necha MB, 30MB yetarli.
const sessionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }
})

const PERSONAS = {
  en: { name: 'Eva', langName: 'English' },
  ru: { name: 'Anya', langName: 'Russian' }
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const levelRank = (l) => LEVELS.indexOf(String(l || '').toUpperCase())

// Foydalanuvchi hamrohiga bergan ismni tozalash (xavfsiz, qisqa, faqat harf/probel).
function sanitizeName(raw) {
  return String(raw || '')
    .replace(/[^\p{L}\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
}

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

SPEAKING SUPPORT: In the "help" field, ALWAYS provide ONE short, natural example answer in ${p.langName} that the learner could simply say next in reply to your question. Keep it at their level and make it a ready-to-say sentence (NOT a translation or instruction). This nudge is shown ONLY if the learner stays silent for a few seconds, so it must directly fit the question you just asked.

RULES:
- Reply ONLY in ${p.langName}, SHORT (1-2 sentences max — it will be spoken aloud).
- Be warm, positive and motivating. Celebrate effort. Never criticize harshly.
- ALWAYS end your reply with an easy, open follow-up question so the conversation never stops.
- If the learner made a clear language mistake, give ONE short, gentle correction tip (with the correct form), but never interrupt the flow.

Return ONLY JSON, nothing else:
{"reply": "<your short spoken reply in ${p.langName}>", "tip": "<optional one short gentle correction written in Uzbek, or empty>", "level": "<CEFR band A1/A2/B1/B2/C1/C2 if known or just estimated, else empty>", "help": "<a short, ready-to-say example answer in ${p.langName} that fits your question, so a stuck learner can just say it>"}`
}

// LLM suhbat — userText (yoki start) → {reply, tip, level}. /talk va /chat shuni ishlatadi.
async function converse({ lang, userText, history, start, level, partnerName }) {
  const base = PERSONAS[lang] || PERSONAS.en
  const name = sanitizeName(partnerName) || base.name
  const persona = { ...base, name }
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
    level: LEVELS.includes(detected) ? detected : (curLevel || ''),
    help: String(parsed.help || '').slice(0, 220).trim()
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

    const { reply, tip, level, help } = await converse({ lang, userText, history: req.body.history, start, level: req.body.level, partnerName: req.body.partnerName })
    res.json({ userText, reply, tip, level, help })
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

    const { reply, tip, level, help } = await converse({ lang, userText, history: parseHistory(req.body.history), start, level: req.body.level, partnerName: req.body.partnerName })
    res.json({ userText, reply, tip, level, help })
  } catch (err) {
    if (err.status === 502) return res.status(502).json({ message: 'AI band — qayta urinib ko\'ring.' })
    console.error('[speaking] error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// ============ AI ovozi (TTS) ============

// POST /api/speaking/tts — matnni AI ovoziga aylantiradi (WAV).
// TTS mavjud bo'lmasa (ruscha yoki terms qabul qilinmagan) 204 qaytaradi →
// frontend brauzer TTS'ga qaytadi.
router.post('/tts', auth, async (req, res) => {
  try {
    const lang = req.body.lang === 'ru' ? 'ru' : 'en'
    const text = String(req.body.text || '').trim().slice(0, 600)
    if (!text) return res.status(400).json({ message: 'Matn yo\'q' })

    const audio = await synthesize(text, { lang })
    if (!audio) return res.status(204).end()

    res.set('Content-Type', 'audio/wav')
    res.set('Cache-Control', 'no-store')
    res.send(audio)
  } catch (err) {
    console.error('[speaking] tts:', err.message)
    res.status(502).json({ message: 'Ovoz yaratib bo\'lmadi' })
  }
})

// ============ Hamroh ismi (bir marta sozlash) ============

// GET /api/speaking/prefs — foydalanuvchining hamroh ismi
router.get('/prefs', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT partner_name FROM speaking_prefs WHERE user_id = $1', [req.user.id])
    res.json({ partnerName: r.rows[0]?.partner_name || '' })
  } catch (err) {
    console.error('[speaking] prefs get:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST /api/speaking/prefs — hamroh ismini saqlash/yangilash
router.post('/prefs', auth, async (req, res) => {
  try {
    const name = sanitizeName(req.body.partnerName)
    if (!name) return res.status(400).json({ message: 'Ism kiriting (kamida 1 harf)' })
    await pool.query(
      `INSERT INTO speaking_prefs (user_id, partner_name, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET partner_name = $2, updated_at = NOW()`,
      [req.user.id, name]
    )
    res.json({ partnerName: name })
  } catch (err) {
    console.error('[speaking] prefs set:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// ============ Sessiyani baholash ============

// Transkriptni Groq LLM bilan baholash → {level, score, mistakes, fluency, summary}
async function evaluateSession({ lang, transcript }) {
  const persona = PERSONAS[lang] || PERSONAS.en
  const dialogue = transcript
    .filter(m => m && m.text && (m.role === 'user' || m.role === 'ai'))
    .slice(-40)
    .map(m => `${m.role === 'ai' ? 'PARTNER' : 'LEARNER'}: ${String(m.text).slice(0, 400)}`)
    .join('\n')

  const sys = `You are a strict but fair ${persona.langName} speaking examiner for an Uzbek learner.
Assess ONLY the LEARNER's spoken lines (ignore the PARTNER lines except for context).
Give an honest CEFR level and scores. Be encouraging in the summary but accurate in the numbers.

Return ONLY JSON:
{"level":"<CEFR A1/A2/B1/B2/C1/C2>","score":<overall 0-100>,"mistakes":<number of clear grammar/word mistakes you noticed>,"fluency":<0-100 how smooth & natural>,"summary":"<2-3 short sentences in UZBEK: what was good + ONE concrete thing to improve, warm tone>"}`

  const gr = await groqFetch({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: `Conversation transcript:\n${dialogue || '(empty)'}` }
    ],
    temperature: 0.3,
    max_tokens: 350
  })
  if (!gr.ok) { const e = new Error('AI band'); e.status = 502; throw e }

  const data = await gr.json()
  const parsed = extractAndParseJson(data.choices?.[0]?.message?.content || '') || {}
  const lvl = String(parsed.level || '').toUpperCase().trim()
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)))
  return {
    level: LEVELS.includes(lvl) ? lvl : '',
    score: clamp(parsed.score, 0, 100),
    mistakes: clamp(parsed.mistakes, 0, 999),
    fluency: clamp(parsed.fluency, 0, 100),
    summary: String(parsed.summary || '').slice(0, 600).trim()
  }
}

// "Kecha vs bugun" taqqoslash matni (o'zbekcha, daraja o'ssa — maqtov)
function buildProgress(prev, cur) {
  if (!prev) {
    return { levelUp: false, scoreDelta: null, message: "Bu sizning birinchi natijangiz — ajoyib boshlanish! Har kuni gaplashsangiz, daraja albatta o'sadi. To'xtamang! 🚀" }
  }
  const up = levelRank(cur.level) > levelRank(prev.level) && levelRank(cur.level) >= 0
  const down = levelRank(cur.level) < levelRank(prev.level) && levelRank(prev.level) >= 0
  const scoreDelta = (Number.isInteger(cur.score) && Number.isInteger(prev.score)) ? cur.score - prev.score : null
  let message
  if (up) {
    message = `Zo'r natija! O'tgan safar ${prev.level} edingiz, bugun ${cur.level} darajaga chiqdingiz! 🎉 Shu zayl davom eting — to'xtamang, siz o'syapsiz!`
  } else if (down) {
    message = `Bugun biroz qiyinroq bo'ldi (o'tgan safar ${prev.level} edi). Muhimi — davom etyapsiz. Ertaga yana urinib ko'ring, albatta yaxshilanadi! 💪`
  } else if (scoreDelta !== null && scoreDelta > 0) {
    message = `Barakalla! Daraja ${cur.level}da, ammo ballingiz ${prev.score} → ${cur.score} ga oshdi. Yaxshilanyapsiz — davom eting! 📈`
  } else {
    message = `${cur.level} darajada barqaror gaplashyapsiz. Keyingi darajaga chiqish uchun har kuni ozgina ko'proq gapiring — to'xtamang! 🔥`
  }
  return { levelUp: up, scoreDelta, message, prevLevel: prev.level, prevScore: prev.score }
}

// POST /api/speaking/session — tugallangan suhbatni saqlash (audio + matn) + baholash
router.post('/session', auth, sessionUpload.single('audio'), async (req, res) => {
  try {
    const lang = req.body.lang === 'ru' ? 'ru' : 'en'
    let transcript = []
    try {
      const t = JSON.parse(req.body.transcript || '[]')
      if (Array.isArray(t)) transcript = t.filter(m => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'ai'))
                                         .map(m => ({ role: m.role, text: String(m.text).slice(0, 1000) }))
    } catch { transcript = [] }

    const userTurns = transcript.filter(m => m.role === 'user')
    if (userTurns.length === 0) {
      return res.status(400).json({ message: "Saqlash uchun suhbat juda qisqa." })
    }
    const wordCount = userTurns.reduce((s, m) => s + m.text.split(/\s+/).filter(Boolean).length, 0)

    // 1) Audio'ni saqlash (bo'lsa) — R2 sozlanmasa jimgina o'tkazamiz
    let audioUrl = null, audioKey = null
    if (req.file && req.file.size > 0 && r2.isConfigured()) {
      try {
        const key = `speaking/${req.user.id}/${Date.now()}.webm`
        audioUrl = await r2.uploadBuffer({ key, body: req.file.buffer, contentType: req.file.mimetype || 'audio/webm' })
        audioKey = key
      } catch (e) {
        console.warn('[speaking] audio upload xatosi:', e.message)
      }
    }

    // 2) Baholash
    let evalRes
    try {
      evalRes = await evaluateSession({ lang, transcript })
    } catch (e) {
      evalRes = { level: '', score: 0, mistakes: 0, fluency: 0, summary: '' }
    }

    // 3) Oldingi sessiya (taqqoslash uchun)
    const prevQ = await pool.query(
      `SELECT level, score, created_at FROM speaking_sessions
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    )
    const prev = prevQ.rows[0] ? { level: prevQ.rows[0].level, score: prevQ.rows[0].score, createdAt: prevQ.rows[0].created_at } : null

    // 4) Saqlash
    const ins = await pool.query(
      `INSERT INTO speaking_sessions
         (user_id, lang, transcript, audio_url, audio_key, level, score, word_count, mistakes, fluency, turns, summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, created_at`,
      [req.user.id, lang, JSON.stringify(transcript), audioUrl, audioKey,
       evalRes.level || null, evalRes.score, wordCount, evalRes.mistakes, evalRes.fluency, userTurns.length, evalRes.summary]
    )

    const cur = { ...evalRes, wordCount, turns: userTurns.length }
    const progress = buildProgress(prev, cur)

    res.json({
      id: ins.rows[0].id,
      createdAt: ins.rows[0].created_at,
      audioUrl,
      ...cur,
      progress
    })
  } catch (err) {
    console.error('[speaking] session save:', err.message)
    res.status(500).json({ message: 'Sessiyani saqlashda xato' })
  }
})

// GET /api/speaking/progress — oxirgi natija + tarix (sahifa ochilganda ko'rsatiladi)
router.get('/progress', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, lang, audio_url, level, score, word_count, mistakes, fluency, turns, summary, created_at
       FROM speaking_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [req.user.id]
    )
    const sessions = r.rows.map(s => ({
      id: s.id, lang: s.lang, audioUrl: s.audio_url, level: s.level, score: s.score,
      wordCount: s.word_count, mistakes: s.mistakes, fluency: s.fluency, turns: s.turns,
      summary: s.summary, createdAt: s.created_at
    }))
    const last = sessions[0] || null
    const prev = sessions[1] || null
    const progress = last ? buildProgress(prev, last) : null
    res.json({ last, prev, progress, sessions })
  } catch (err) {
    console.error('[speaking] progress:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
