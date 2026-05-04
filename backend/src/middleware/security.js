const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

// Parol kuchliligi: kamida 8 belgi, harf + raqam (oddiy bo'lsa-da, "12345"
// va "password" kabi past sifatli parollarni bloklaydi)
const PASSWORD_MIN = 8
const PASSWORD_MAX = 100

const PASSWORD_RULES = {
  minLen: PASSWORD_MIN,
  maxLen: PASSWORD_MAX
}

const validatePassword = (pwd) => {
  if (typeof pwd !== 'string') return 'Parol noto\'g\'ri'
  if (pwd.length < PASSWORD_MIN) return `Parol kamida ${PASSWORD_MIN} belgidan iborat bo\'lsin`
  if (pwd.length > PASSWORD_MAX) return `Parol ${PASSWORD_MAX} belgidan oshmasin`
  if (!/[A-Za-z]/.test(pwd)) return 'Parol kamida bitta harfdan iborat bo\'lsin'
  if (!/\d/.test(pwd)) return 'Parol kamida bitta raqam o\'z ichiga olsin'
  // Yaxshi ma'lum zaif parollar
  const lower = pwd.toLowerCase()
  const weak = ['password', 'parol123', 'admin123', '12345678', 'qwerty', 'abc12345']
  if (weak.some(w => lower === w || lower === w + '!')) return 'Bu parol juda zaif'
  return null
}

// Email bo'yicha login limiter — bitta email uchun maksimal 5 muvaffaqiyatsiz urinish 15 daqiqada.
// Bu IP-asosli limit bilan birga ishlaydi.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // IP (IPv6 xavfsiz) + email birgalikda kalit
  keyGenerator: (req, res) => {
    const email = (typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '').slice(0, 100)
    const ipKey = ipKeyGenerator(req, res)
    return `${ipKey}::${email}`
  },
  message: { message: 'Juda ko\'p urinish. 15 daqiqadan keyin urinib ko\'ring' },
  // Faqat muvaffaqiyatsiz urinishlarni hisoblash uchun (express-rate-limit 7+ da bor)
  skipSuccessfulRequests: true
})

module.exports = { validatePassword, loginLimiter, PASSWORD_RULES }
