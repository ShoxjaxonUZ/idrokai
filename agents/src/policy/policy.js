// Qoidalar & Siyosatlar — ruxsatlar, maxfiylik, xavfsizlik, compliance.
// Agentlar va vositalar shu qoidalardan o'tadi.

const path = require('path')

// Loglar/natijalarda ko'rinmasligi kerak bo'lgan maxfiy naqshlar
const SECRET_PATTERNS = [
  /gsk_[A-Za-z0-9]{20,}/g,             // Groq API key
  /Bearer\s+[A-Za-z0-9._\-]{20,}/gi,   // Bearer token
  /sk-[A-Za-z0-9]{20,}/g,              // umumiy API key
  /(password|parol|secret|token)\s*[:=]\s*["']?[^\s"']{6,}/gi
]

function redact(text) {
  if (typeof text !== 'string') return text
  let out = text
  for (const re of SECRET_PATTERNS) { re.lastIndex = 0; out = out.replace(re, '«***maxfiy***»') }
  return out
}

// Vosita harakatini tekshirish — sandbox tashqarisiga yozish taqiqlanadi
function checkAction(action, cfg) {
  const workspaceDir = cfg.workspaceDir
  if (!action || !action.type) return { allowed: false, reason: "noma'lum harakat" }
  if (['read', 'write', 'list'].includes(action.type)) {
    const abs = path.resolve(workspaceDir, action.path || '.')
    if (!abs.startsWith(path.resolve(workspaceDir))) {
      return { allowed: false, reason: "sandbox tashqarisiga ruxsat yo'q" }
    }
    return { allowed: true }
  }
  if (action.type === 'delete') return { allowed: false, reason: "o'chirish taqiqlangan" }
  if (action.type === 'git-read') return { allowed: true }
  return { allowed: false, reason: `ruxsat etilmagan harakat: ${action.type}` }
}

// Yakuniy compliance — natijalarda muammo bormi
function compliance(context) {
  const issues = []
  const blob = JSON.stringify(context.artifacts || {})
  for (const re of SECRET_PATTERNS) {
    re.lastIndex = 0
    if (re.test(blob)) issues.push("Natijada maxfiy ma'lumot izi topildi (redakt qilindi)")
  }
  if (!context.artifacts || Object.keys(context.artifacts).length === 0) {
    issues.push("Hech qanday agent natijasi yo'q")
  }
  return issues
}

const policy = { redact, checkAction, compliance, SECRET_PATTERNS }
module.exports = { policy }
