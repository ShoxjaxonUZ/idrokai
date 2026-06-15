// Groq API klienti — loyihaning backend/src/lib/groq.js uslubida.
// Chat completion qaytaradi: { text, usage }. Network/timeout xatosida 1 ta retry.

const { config } = require('../config')

async function groqChatOnce(messages, opts = {}, ms = 45000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const body = {
      model: opts.model || config.model,
      messages,
      temperature: opts.temperature ?? config.temperature,
      max_tokens: opts.maxTokens ?? config.maxTokens
    }
    // JSON rejim (Groq qo'llab-quvvatlaydi; prompt ichida "JSON" so'zi bo'lishi shart)
    if (opts.json) body.response_format = { type: 'json_object' }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// Faqat network/timeout uchun retry — HTTP 4xx/5xx ni qaytarmaymiz (logik xato)
async function groqChat(messages, opts = {}) {
  let res
  try {
    res = await groqChatOnce(messages, opts)
  } catch (err) {
    const isNetwork = err.name === 'AbortError' ||
      /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|UND_ERR/i.test(err.message || '') ||
      err.code === 'UND_ERR_SOCKET'
    if (!isNetwork) throw err
    await new Promise(r => setTimeout(r, 1000))
    res = await groqChatOnce(messages, opts)
  }

  const data = await res.json()
  if (!res.ok) {
    const msg = data?.error?.message || `Groq HTTP ${res.status}`
    const e = new Error(msg)
    e.status = res.status
    throw e
  }

  const text = data?.choices?.[0]?.message?.content
  return { text: typeof text === 'string' ? text : '', usage: data?.usage || null }
}

module.exports = { groqChat }
