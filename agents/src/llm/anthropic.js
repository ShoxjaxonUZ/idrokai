// Claude (Anthropic) Messages API klienti — NATIVE API, tashqi paketsiz (Node fetch).
// Eslatma: rasmiy SDK (@anthropic-ai/sdk) ham bor; bu yerda loyihaning "nol bog'liqlik"
// dizaynini saqlash uchun to'g'ridan-to'g'ri barqaror wire endpoint ishlatilgan.
// Bu OpenAI-mos shim EMAS — haqiqiy Anthropic Messages API.

const { config } = require('../config')

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

// Qaysi model adaptiv fikrlash / effort'ni qo'llab-quvvatlaydi (aks holda 400 beradi).
// Opus 4.5+/4.6/4.7/4.8, Sonnet 4.6, Fable 5 — ha. Haiku 4.5 / Sonnet 4.5 — yo'q.
function supportsThinkingEffort(model) {
  return /opus-4-(5|6|7|8)|sonnet-4-6|fable-5|mythos-5/.test(String(model))
}

async function callOnce(body, ms = 60000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': API_VERSION
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

function usageOf(data) {
  if (!data || !data.usage) return null
  const i = data.usage.input_tokens || 0
  const o = data.usage.output_tokens || 0
  return { input_tokens: i, output_tokens: o, total_tokens: i + o }
}

// { system, user, model, maxTokens, effort } -> { text, usage }
// MUHIM: temperature/top_p YUBORILMAYDI (Opus 4.8/Fable'da 400). adaptive thinking + effort
// faqat qo'llab-quvvatlovchi modellarga.
async function anthropicChat({ system, user, model, maxTokens, effort }) {
  const m = model || config.defaultModel
  const body = {
    model: m,
    max_tokens: maxTokens || config.maxTokens,
    messages: [{ role: 'user', content: String(user || '') }]
  }
  if (system) body.system = String(system)
  if (supportsThinkingEffort(m)) {
    body.thinking = { type: 'adaptive' }
    body.output_config = { effort: effort || config.effort }
  }

  let res
  try {
    res = await callOnce(body)
  } catch (err) {
    const net = err.name === 'AbortError' ||
      /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|UND_ERR/i.test(err.message || '')
    if (!net) throw err
    await new Promise(r => setTimeout(r, 1000))
    res = await callOnce(body)
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Anthropic HTTP ${res.status}`
    const e = new Error(msg)
    e.status = res.status
    throw e
  }

  // Refusal — content bo'sh yoki qisman bo'lishi mumkin (content'dan oldin tekshiramiz)
  if (data && data.stop_reason === 'refusal') {
    return { text: '(rad etildi: xavfsizlik klassifikatori)', usage: usageOf(data), refusal: true }
  }

  let text = ''
  for (const block of (data && data.content) || []) {
    if (block && block.type === 'text') text += block.text
  }
  return { text, usage: usageOf(data) }
}

module.exports = { anthropicChat, supportsThinkingEffort }
