// Telegram Bot API klienti — admin'ga jimgina xavfsizlik xabarlari yuboradi.
// .env da TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID kerak.

const geoip = require('./geoip')

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

// Xavfsizlik (admin) xabarlarini yoqish/o'chirish.
// Default: o'chirilgan — chunki Verification botiga foydalanuvchilar /start yuborganda
// admin xabarlari o'sha userlar uchun xato yuborilmasligi kerak.
// Yoqish uchun env: TELEGRAM_SECURITY_ALERTS=on
const SECURITY_ALERTS_ENABLED = String(process.env.TELEGRAM_SECURITY_ALERTS || '').toLowerCase() === 'on'

let lastErrorAt = 0
const ERROR_COOLDOWN = 60_000

const isConfigured = () => Boolean(TOKEN && CHAT_ID)

// MarkdownV2 escape
const md = (s) => {
  if (s == null) return ''
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, m => '\\' + m)
}

const sendMessage = async (text, opts = {}) => {
  if (!isConfigured() || !SECURITY_ALERTS_ENABLED) return false
  if (text.length > 4000) text = text.slice(0, 3990) + '...'

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: opts.parseMode || 'MarkdownV2',
        disable_web_page_preview: opts.preview === false,
        disable_notification: opts.silent || false,
        reply_markup: opts.replyMarkup
      }),
      signal: ctrl.signal
    })
    clearTimeout(timer)

    if (!res.ok) {
      const now = Date.now()
      if (now - lastErrorAt > ERROR_COOLDOWN) {
        lastErrorAt = now
        const data = await res.json().catch(() => ({}))
        console.error('[Telegram] error:', data.description || res.status)
      }
      return false
    }
    return true
  } catch (err) {
    const now = Date.now()
    if (now - lastErrorAt > ERROR_COOLDOWN) {
      lastErrorAt = now
      console.error('[Telegram] fetch error:', err.message)
    }
    return false
  }
}

// Joylashuvni alohida xabar sifatida yuborish (Telegram'da xarita ko'rinadi)
const sendLocation = async (latitude, longitude, opts = {}) => {
  if (!isConfigured() || !SECURITY_ALERTS_ENABLED || latitude == null || longitude == null) return false
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendLocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        latitude,
        longitude,
        disable_notification: opts.silent || false
      }),
      signal: ctrl.signal
    })
    clearTimeout(timer)
    return true
  } catch {
    return false
  }
}

// Hujum xabari — formatlangan, joylashuv bilan
const sendAttackAlert = async (entry) => {
  if (!SECURITY_ALERTS_ENABLED) return false
  const sevEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  }[entry.severity] || '⚪'

  const flag = geoip.flagEmoji(entry.countryCode || '')
  const locationStr = geoip.formatLocation({
    countryCode: entry.countryCode,
    country: entry.country,
    region: entry.region,
    city: entry.city
  })
  const mapsLink = geoip.mapsUrl(entry.latitude, entry.longitude)

  const lines = [
    `${sevEmoji} *Kiber hujum aniqlandi*`,
    '',
    `*Toifa:* ${md(entry.category)}`,
    `*Darajasi:* ${md(entry.severity)}`,
    `*Naqsh:* \`${md((entry.pattern || '').slice(0, 100))}\``,
    '',
    `📍 *Joylashuv*`,
    `${flag} ${md(locationStr)}`
  ]

  if (entry.postal) lines.push(`*Indeks:* ${md(entry.postal)}`)
  if (entry.timezone) lines.push(`*Vaqt zonasi:* ${md(entry.timezone)}`)
  if (entry.latitude != null && entry.longitude != null) {
    lines.push(`*Koordinatalar:* \`${entry.latitude}, ${entry.longitude}\``)
    if (mapsLink) lines.push(`[🗺 Xaritada ochish](${md(mapsLink)})`)
  }

  lines.push('')
  lines.push(`🌐 *Tarmoq*`)
  lines.push(`*IP:* \`${md(entry.ip)}\``)
  if (entry.isp) lines.push(`*ISP:* ${md(entry.isp)}`)
  if (entry.asn) lines.push(`*ASN:* ${md(entry.asn)}`)

  lines.push('')
  lines.push(`🔍 *So'rov*`)
  lines.push(`\`${md((entry.method || 'GET') + ' ' + entry.url)}\``)
  lines.push(`*UA:* \`${md((entry.user_agent || '').slice(0, 100))}\``)
  if (entry.user_id) lines.push(`*User ID:* ${entry.user_id}`)

  lines.push('')
  lines.push(`*Vaqt:* ${md(new Date().toISOString())}`)

  const text = lines.join('\n')

  // critical/high — ovozli xabar, low/medium — jim
  const silent = ['low', 'medium'].includes(entry.severity)
  const ok = await sendMessage(text, { silent, preview: false })

  // Yuqori darajadagi hujumlarda haqiqiy joylashuvni ham yuboramiz (xarita pinned)
  if (ok && (entry.severity === 'critical' || entry.severity === 'high') &&
      entry.latitude != null && entry.longitude != null) {
    await sendLocation(entry.latitude, entry.longitude, { silent: true })
  }

  return ok
}

const sendStartup = async () => {
  if (!isConfigured() || !SECURITY_ALERTS_ENABLED) return false
  return sendMessage(
    `🛡️ *IdrokAI xavfsizlik tizimi yoqildi*\n\nServer vaqti: ${md(new Date().toISOString())}`,
    { silent: true }
  )
}

// Ma'lum chat_id'ga xabar yuborish (admin emas, oddiy foydalanuvchi)
const sendTo = async (chatId, text, opts = {}) => {
  if (!TOKEN) return { ok: false, reason: 'Telegram bot sozlanmagan' }
  if (!chatId) return { ok: false, reason: 'chat_id berilmagan' }
  if (text.length > 4000) text = text.slice(0, 3990) + '...'

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts.parseMode || 'MarkdownV2'
      }),
      signal: ctrl.signal
    })
    clearTimeout(timer)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // 400 + "chat not found" — foydalanuvchi botga /start yubormagan
      const desc = data.description || `HTTP ${res.status}`
      return { ok: false, reason: desc }
    }
    return { ok: true, messageId: data.result?.message_id }
  } catch (err) {
    return { ok: false, reason: err.message }
  }
}

// Tasdiqlash kodini yuborish
const sendVerificationCode = async (chatId, name, code) => {
  const text = [
    `🎓 *IdrokAI tasdiqlash kodi*`,
    '',
    `Salom, ${md(name || 'foydalanuvchi')}\\!`,
    '',
    `Ro'yxatdan o'tishni yakunlash uchun quyidagi kodni kiriting:`,
    '',
    `*${md(code)}*`,
    '',
    `_Kod 15 daqiqa davomida amal qiladi\\._`,
    `_Agar siz ro'yxatdan o'tmagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring\\._`
  ].join('\n')

  return sendTo(chatId, text)
}

// Webhook URL'ni Telegram'ga o'rnatish
const setWebhook = async (url, secret) => {
  if (!TOKEN) return { ok: false, reason: 'TELEGRAM_BOT_TOKEN yo\'q' }
  try {
    const body = { url, allowed_updates: ['message'] }
    if (secret) body.secret_token = secret
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    return { ok: data.ok === true, description: data.description, result: data.result }
  } catch (err) {
    return { ok: false, reason: err.message }
  }
}

// Webhook holatini olish (diagnostika uchun)
const getWebhookInfo = async () => {
  if (!TOKEN) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`)
    const data = await res.json()
    return data.result
  } catch {
    return null
  }
}

module.exports = { sendMessage, sendLocation, sendAttackAlert, sendStartup, sendTo, sendVerificationCode, setWebhook, getWebhookInfo, isConfigured }
