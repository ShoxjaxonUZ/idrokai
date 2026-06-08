export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Backend yuklangan rasm/video/fayl URL'i bilan ishlash:
// - Backend `/uploads/...` (relative) qaytaradi
// - Frontend uni API_URL bilan birlashtiradi
// - Tashqi URL bo'lsa (https://...) o'zgartirilmaydi
// - Eski yozuvlarda http://localhost:5000 bo'lishi mumkin — uni ham almashtiramiz
export const assetUrl = (path) => {
  if (!path || typeof path !== 'string') return ''
  // Tashqi URL (Cloudflare R2, S3, YouTube va h.k.) — to'g'ri o'tkazish
  if (/^https?:\/\//i.test(path)) {
    // Eski cache'da `http://localhost:5000/uploads/...` bo'lishi mumkin — almashtiramiz
    return path
      .replace(/^https?:\/\/localhost:\d+/i, API_URL)
      .replace(/^http:\/\/127\.0\.0\.1:\d+/i, API_URL)
  }
  // Relative path — API_URL ga ulaymiz
  if (path.startsWith('/')) return API_URL + path
  return API_URL + '/' + path
}

// 2-bosqich: REAL JWT endi httpOnly cookie'da — localStorage'da SAQLANMAYDI (XSS
// himoyasi). 'token' kaliti faqat "cookie orqali login bo'lgan" sentinel'ini
// saqlaydi (maxfiy emas). Shu sabab eski kod o'zgarishsiz ishlaydi: getToken()
// va to'g'ridan-to'g'ri getItem('token') guard'lari truthy ko'radi; Bearer
// header'lar "Bearer cookie" yuboradi — backend uni e'tiborsiz qoldiradi (cookie ustun).
export const AUTH_SENTINEL = 'cookie'

export const getToken = () => {
  try { return localStorage.getItem('token') } catch { return null }
}

// Eski (1-bosqich) sessiyalardan localStorage'da qolgan REAL JWT'ni sentinel
// bilan almashtiramiz — maxfiy qiymat darhol o'chadi.
try {
  const t = localStorage.getItem('token')
  if (t && t !== AUTH_SENTINEL) localStorage.setItem('token', AUTH_SENTINEL)
} catch {}

export const getUser = () => {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// 2-bosqich: REAL token localStorage'ga YOZILMAYDI. user obyekti UI uchun, va
// 'token' kaliti faqat sentinel (login holati signali). token argumenti orqaga
// moslik uchun qabul qilinadi, lekin saqlanmaydi.
export const setAuth = ({ user }) => {
  try {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', AUTH_SENTINEL)
  } catch {}
}

export const clearAuth = () => {
  try {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  } catch {}
}

const buildUrl = (path) => {
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/')) return API_URL + path
  return `${API_URL}/${path}`
}

export const api = async (path, opts = {}) => {
  const { headers = {}, body, auth = true, signal, ...rest } = opts
  const token = auth ? getToken() : null

  const finalHeaders = { ...headers }
  if (body && !(body instanceof FormData) && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json'
  }
  if (token) finalHeaders.Authorization = `Bearer ${token}`

  const finalBody =
    body && !(body instanceof FormData) && typeof body !== 'string'
      ? JSON.stringify(body)
      : body

  const res = await fetch(buildUrl(path), {
    ...rest,
    headers: finalHeaders,
    body: finalBody,
    signal
  })

  if (res.status === 401) {
    clearAuth()
  }

  let data = null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    try { data = await res.json() } catch {}
  } else {
    try { data = await res.text() } catch {}
  }

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

export const apiGet = (path, opts) => api(path, { ...opts, method: 'GET' })
export const apiPost = (path, body, opts) => api(path, { ...opts, method: 'POST', body })
export const apiPut = (path, body, opts) => api(path, { ...opts, method: 'PUT', body })
export const apiDelete = (path, opts) => api(path, { ...opts, method: 'DELETE' })

// CSRF token cookie'dan o'qish (csrf_token httpOnly EMAS — JS o'qiy oladi).
export const getCsrfToken = () => {
  try {
    const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : null
  } catch { return null }
}

// Global fetch o'rovchi. Ikki vazifa:
//  1) API so'rovlariga httpOnly cookie auth uchun credentials:'include' qo'shadi
//     va mutatsion so'rovlarga X-CSRF-Token header'ini biriktiradi.
//  2) 401 (sessiya tugadi / boshqa qurilmadan chiqarildi) bo'lsa — foydalanuvchini
//     login sahifasiga sabab bilan yo'naltiradi.
// Barcha sahifalar to'g'ridan-to'g'ri fetch ishlatgani uchun window.fetch'ni o'raymiz.
if (typeof window !== 'undefined' && !window.__authInterceptor) {
  window.__authInterceptor = true
  const origFetch = window.fetch.bind(window)
  const MUTATING = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input?.url || '')
    if (url.startsWith(API_URL)) {
      init = { ...init, credentials: 'include' }
      const method = (init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase()
      if (MUTATING.has(method)) {
        const csrf = getCsrfToken()
        if (csrf) {
          const headers = new Headers(init.headers || {})
          headers.set('X-CSRF-Token', csrf)
          init.headers = headers
        }
      }
    }
    const res = await origFetch(input, init)
    // Token/user mavjud bo'lsa va istalgan 401 qaytsa — sessiya yaroqsiz
    // (muddati o'tgan, imzo noto'g'ri, sessiya o'chirilgan va h.k.).
    // Foydalanuvchini tozalab, login sahifasiga sabab bilan yo'naltiramiz.
    // Guest (tokensiz) uchun yo'naltirmaymiz — u shunchaki bo'sh ma'lumot oladi.
    if (res.status === 401 && (getToken() || getUser())) {
      let msg = 'Sessiya tugagan, qaytadan kiring'
      try {
        const data = await res.clone().json()
        if (data?.message) msg = data.message
      } catch {}
      clearAuth()
      if (!window.location.pathname.startsWith('/login')) {
        try { sessionStorage.setItem('authKickReason', msg) } catch {}
        window.location.href = '/login'
      }
    }
    return res
  }
}
