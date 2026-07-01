// Matn → ovoz (Groq Orpheus TTS). Faqat inglizcha (Groq'da ruscha TTS yo'q).
// Speaking sessiya audiosiga AI ovozini ham qo'shish uchun ishlatiladi.
// DIQQAT: Orpheus modeli Groq konsolida "terms acceptance" talab qiladi:
//   https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english
// Qabul qilinmasa yoki xato bo'lsa — null qaytadi, frontend brauzer TTS'ga qaytadi.

const MODEL = 'canopylabs/orpheus-v1-english'
const DEFAULT_VOICE = 'tara'

// text → WAV Buffer (yoki null, agar TTS mavjud/mos bo'lmasa)
async function synthesize(text, { lang = 'en', voice = DEFAULT_VOICE } = {}) {
  const input = String(text || '').trim().slice(0, 600)
  if (!input) return null
  if (lang !== 'en') return null            // Groq faqat inglizcha TTS beradi
  if (!process.env.GROQ_API_KEY) return null

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: MODEL, voice, input, response_format: 'wav' }),
      signal: ctrl.signal
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      console.warn('[tts] Groq xato', res.status, t.slice(0, 160))
      return null
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    console.warn('[tts] xato:', err.message)
    return null
  } finally {
    clearTimeout(timer)
  }
}

module.exports = { synthesize }
