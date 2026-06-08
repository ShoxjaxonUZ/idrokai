// Double-submit CSRF himoyasi.
// Cookie orqali autentifikatsiya qilingan (auth_token cookie bilan) MUTATSION
// so'rovlarda X-CSRF-Token header csrf_token cookie bilan mos kelishi shart.
//
// Nega faqat cookie-auth uchun: Authorization: Bearer header brauzer tomonidan
// avtomatik yuborilmaydi → CSRF'ga immun. Faqat cookie avtomatik yuboriladi.
// Dual-mode transition: eski (header-auth) sessiyalar buzilmasin.

const { AUTH_COOKIE, CSRF_COOKIE } = require('../lib/authCookies')

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Auth-bootstrap yo'llari — CSRF'dan ozod. Bu endpoint'lar orqali sessiya
// HOSIL qilinadi; CSRF token olish uchun avval login qilish kerak bo'lsa
// mantiqiy halqa va lockout xavfi paydo bo'ladi (eski auth_token cookie qolsa).
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/resend-verification'
])

const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next()
  if (EXEMPT_PATHS.has(req.originalUrl.split('?')[0])) return next()

  // Cookie orqali kelmagan bo'lsa (header Bearer) — CSRF tekshiruvi shart emas.
  const authCookie = req.cookies?.[AUTH_COOKIE]
  if (!authCookie) return next()

  const cookieToken = req.cookies?.[CSRF_COOKIE]
  const headerToken = req.get('X-CSRF-Token')

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: 'CSRF tekshiruvi muvaffaqiyatsiz' })
  }
  next()
}

module.exports = { csrfProtection }
