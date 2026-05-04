// `javascript:`, `data:`, `vbscript:` kabi xavfli URL'larni filtr qiladi.
// Faqat http/https/mailto va relative URL'lar ruxsat etiladi.
const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:']

export const safeUrl = (url) => {
  if (typeof url !== 'string' || !url) return '#'
  const trimmed = url.trim()
  if (!trimmed) return '#'

  // Relative URL — har doim xavfsiz (path, query, fragment)
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed, window.location.origin)
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return '#'
    return parsed.href
  } catch {
    return '#'
  }
}

// Tashqi link bo'lsa true qaytaradi (target=_blank uchun)
export const isExternalUrl = (url) => {
  if (typeof url !== 'string' || !url) return false
  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.origin !== window.location.origin
  } catch {
    return false
  }
}
