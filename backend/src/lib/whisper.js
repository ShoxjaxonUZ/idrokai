// Audio → matn (Groq Whisper). Multipart so'rov (groq.js JSON helper'idan farqli).
// Node 20+ global FormData/Blob ishlatadi. GROQ_API_KEY kerak.

const EXT_BY_MIME = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a'
}

async function transcribe(buffer, { lang = 'en', mime = 'audio/webm' } = {}) {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY yo'q")
  const ext = EXT_BY_MIME[mime] || 'webm'

  const fd = new FormData()
  fd.append('file', new Blob([buffer], { type: mime }), `audio.${ext}`)
  fd.append('model', 'whisper-large-v3-turbo')
  if (lang) fd.append('language', lang)
  fd.append('response_format', 'json')
  fd.append('temperature', '0')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: fd
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Whisper ${res.status}: ${t.slice(0, 200)}`)
  }

  const data = await res.json()
  return String(data.text || '').trim()
}

module.exports = { transcribe }
