// AI (Groq) JSON javoblari uchun chidamli parser.
// Loyihaning backend/src/lib/jsonParse.js bilan bir xil yondashuv:
// LLM ba'zan noto'g'ri escape (\n, \d, \W ...) yuboradi — buni tuzatib parse qilamiz.

function safeParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null

  // 1) To'g'ridan-to'g'ri
  try { return JSON.parse(raw) } catch {}

  // 2) Noto'g'ri escape'larni double-escape qilish
  try {
    return JSON.parse(raw.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'))
  } catch {}

  // 3) Control char'larni normalize qilish
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
  } catch {
    return null
  }
}

// Matn ichidan birinchi JSON blokini ajratib parse qilish
function extractAndParseJson(text) {
  if (!text || typeof text !== 'string') return null
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  return safeParseJson(match[0])
}

module.exports = { safeParseJson, extractAndParseJson }
