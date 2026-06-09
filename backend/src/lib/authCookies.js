// JWT'ni httpOnly cookie sifatida o'rnatish + double-submit CSRF cookie.
// XSS himoyasi: auth_token JS'dan o'qib bo'lmaydi. CSRF himoyasi: cookie
// avtomatik yuborilgani uchun mutatsion so'rovlarda csrf_token (JS o'qiy
// oladigan) header'da qaytarilishi va cookie bilan mos kelishi shart.
//
// Cross-origin (Vercel ↔ Render): prod'da SameSite=None; Secure shart.
// Lokal dev (localhost http): Secure cookie qabul qilinmaydi → SameSite=Lax.

const crypto = require('crypto')

const isProd = process.env.NODE_ENV === 'production'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 kun (token maxAge bilan bir xil)

const AUTH_COOKIE = 'auth_token'
const CSRF_COOKIE = 'csrf_token'

const baseOpts = {
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/',
  maxAge: MAX_AGE_MS
}

const generateCsrf = () => crypto.randomBytes(32).toString('hex')

// Login/register'da chaqiriladi — auth (httpOnly) + csrf (o'qiladigan) cookie.
// Yaratilgan CSRF tokenni QAYTARADI — cross-domain (Vercel↔Render) deploy'da
// frontend backend domenidagi csrf_token cookie'ni document.cookie orqali
// o'qiy olmaydi, shu sabab tokenni JSON javobida ham qaytaramiz.
const setAuthCookies = (res, token) => {
  res.cookie(AUTH_COOKIE, token, { ...baseOpts, httpOnly: true })
  return setCsrfCookie(res)
}

// Faqat CSRF cookie'ni o'rnatadi va qiymatini qaytaradi (csrf endpoint uchun).
const setCsrfCookie = (res) => {
  const csrf = generateCsrf()
  res.cookie(CSRF_COOKIE, csrf, { ...baseOpts, httpOnly: false })
  return csrf
}

// Logout'da chaqiriladi.
const clearAuthCookies = (res) => {
  const opts = { secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' }
  res.clearCookie(AUTH_COOKIE, { ...opts, httpOnly: true })
  res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false })
}

module.exports = { setAuthCookies, setCsrfCookie, clearAuthCookies, generateCsrf, AUTH_COOKIE, CSRF_COOKIE }
