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

export const getToken = () => {
  try { return localStorage.getItem('token') } catch { return null }
}

export const getUser = () => {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const setAuth = ({ token, user }) => {
  try {
    if (token) localStorage.setItem('token', token)
    if (user) localStorage.setItem('user', JSON.stringify(user))
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

// Global 401 ushlovchi — qurilma sessiyasi boshqa joydan chiqarib yuborilsa
// (yoki sessiya tugasa) istalgan fetch 401 qaytaradi. Bunda foydalanuvchini
// darhol login sahifasiga, sabab bilan, olib o'tamiz. Barcha sahifalar
// to'g'ridan-to'g'ri fetch ishlatgani uchun window.fetch'ni o'raymiz.
if (typeof window !== 'undefined' && !window.__authInterceptor) {
  window.__authInterceptor = true
  const origFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const res = await origFetch(...args)
    if (res.status === 401) {
      try {
        const data = await res.clone().json()
        const msg = data?.message || ''
        if (/chiqarib yuborilgan|sessiya tug/i.test(msg)) {
          clearAuth()
          if (!window.location.pathname.startsWith('/login')) {
            try { sessionStorage.setItem('authKickReason', msg) } catch {}
            window.location.href = '/login'
          }
        }
      } catch {}
    }
    return res
  }
}
