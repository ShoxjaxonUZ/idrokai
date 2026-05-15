// AI (Groq) JSON response'lari uchun chidamli parser.
// Muammo: LLM ba'zan kod ichida \n, \d, \W, \s kabi escape'lar yuboradi.
// JSON faqat \" \\ \/ \b \f \n \r \t \uXXXX ni qabul qiladi — boshqalar SyntaxError.

function safeParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null

  // 1-urinish: to'g'ridan-to'g'ri
  try {
    return JSON.parse(raw)
  } catch {}

  // 2-urinish: invalid escape'larni double-escape qilish
  try {
    const cleaned = raw.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
    return JSON.parse(cleaned)
  } catch {}

  // 3-urinish: control character'larni ham normalize qilish
  try {
    const cleaned = raw
      .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
      .replace(/[\x00-\x1F\x7F]/g, (c) => {
        const code = c.charCodeAt(0)
        if (code === 0x0A) return '\\n'
        if (code === 0x0D) return '\\r'
        if (code === 0x09) return '\\t'
        return ''
      })
    return JSON.parse(cleaned)
  } catch (err) {
    // Fallback ishlaydi — bu kritik xato emas, faqat info
    console.warn('[safeParseJson] fallback used:', err.message?.slice(0, 60))
    return null
  }
}

// AI response (matn) ichidan birinchi JSON blokini ajratib parse qilish
function extractAndParseJson(text) {
  if (!text || typeof text !== 'string') return null
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  return safeParseJson(match[0])
}

module.exports = { safeParseJson, extractAndParseJson }
