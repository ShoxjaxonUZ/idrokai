export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

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
