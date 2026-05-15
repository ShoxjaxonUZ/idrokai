// Groq API'ga so'rov yuborish — vaqtinchalik network/timeout xato uchun 1 ta retry
// Barcha AI routelar shu helper'ni ishlatadi (oldindan har faylda alohida edi)

const groqFetchOnce = async (body, ms = 30000) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// Retry: AI vaqtinchalik bo'lmasa qayta urinish (faqat network/timeout uchun)
// HTTP 4xx/5xx ni retry qilmaymiz (bu logik xato, qaytarmaslik kerak)
async function groqFetch(body, ms = 30000) {
  try {
    const res = await groqFetchOnce(body, ms)
    return res
  } catch (err) {
    const isNetworkError = err.name === 'AbortError' || err.code === 'UND_ERR_SOCKET' ||
      /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(err.message || '')
    if (!isNetworkError) throw err

    // 1 sek pauza va qayta urinish
    console.warn('[groq] retry after:', err.message)
    await new Promise(r => setTimeout(r, 1000))
    return groqFetchOnce(body, ms)
  }
}

module.exports = { groqFetch }
