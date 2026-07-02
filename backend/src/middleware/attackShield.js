// Hujum qalqoni — takroriy zararli so'rov yuborgan IP'ni avtomatik bloklaydi.
//
// Falsafa: hujumchi/skaner SAYTDAN HECH QANDAY HAQIQIY MA'LUMOT OLMASIN.
// - Zararli naqsh (SQLi/XSS/probe/skaner) ball to'playdi.
// - Ball chegaradan oshsa — IP "ban" qilinadi.
// - Ban qilingan IP'ga haqiqiy route'lar O'RNIGA soxta (decoy) ma'lumot va
//   sun'iy kechikish (tarpit) beriladi → skaner vaqtini behuda sarflaydi va
//   bloklangani BILINMAYDI (200 javob).
//
// MUHIM: ban faqat ANIQ zararli naqshlardan (critical/high/medium) keladi.
// Oddiy foydalanuvchi xatti-harakati (login xatosi, bo'sh User-Agent) HISOBGA
// OLINMAYDI — shu sabab haqiqiy foydalanuvchi hech qachon bloklanmaydi.

// ip -> { score, bannedUntil, last, bans }
const store = new Map()

const SEVERITY_WEIGHT = { critical: 5, high: 3, medium: 1, low: 0 }
const BAN_THRESHOLD = 6        // ball shu chegaraga yetsa — ban
const BASE_BAN_MS = 60 * 60 * 1000   // 1 soat
const MAX_BAN_MS = 24 * 60 * 60 * 1000 // takror buzg'unchilar uchun maksimal
const DECAY_MS = 30 * 60 * 1000      // 30 daqiqa tinch tursa — ball nolga tushadi

const normalizeIp = (ip) => (ip || '0.0.0.0').replace(/^::ffff:/, '')

const now = () => Date.now()

// Zararli so'rov qayd etish — ball qo'shadi, kerak bo'lsa banlaydi.
const recordOffense = (rawIp, severity) => {
  const weight = SEVERITY_WEIGHT[severity] || 0
  if (weight === 0) return // low/no'malum — hisobga olinmaydi

  const ip = normalizeIp(rawIp)
  const t = now()
  let rec = store.get(ip)
  if (!rec) {
    rec = { score: 0, bannedUntil: 0, last: t, bans: 0 }
    store.set(ip, rec)
  }
  // Uzoq tinchlikdan keyin ballni tiklaymiz (vaqtinchalik false-positive uchun)
  if (t - rec.last > DECAY_MS) rec.score = 0
  rec.last = t
  rec.score += weight

  if (rec.score >= BAN_THRESHOLD) {
    rec.bans += 1
    // Har takror banda muddat ikkilanadi (24s gacha)
    const dur = Math.min(BASE_BAN_MS * Math.pow(2, rec.bans - 1), MAX_BAN_MS)
    rec.bannedUntil = t + dur
    rec.score = 0
  }
}

const isBanned = (rawIp) => {
  const rec = store.get(normalizeIp(rawIp))
  return !!rec && rec.bannedUntil > now()
}

// Soxta (decoy) javob — ban qilingan IP haqiqiy route'ga umuman yetib bormaydi.
// Ko'p endpoint shaklini qoplaydigan bo'sh-soxta tuzilma; status 200 — hujumchi
// bloklangani bilmaydi va skaneri "ishlayapti" deb o'ylab vaqt sarflaydi.
const DECOY_BODY = {
  ok: true,
  data: [],
  items: [],
  results: [],
  message: 'OK'
}

// Sun'iy kechikish (tarpit) — skanerni sekinlashtiradi (1.5–4s tasodifiy)
const tarpitDelay = () => 1500 + Math.floor(Math.random() * 2500)

const attackShield = (req, res, next) => {
  // /health har doim ochiq — uptime monitor ban qilingan IP'dan kelsa ham haqiqiy
  // javob olsin (aks holda soxta 200 monitorni chalg'itadi).
  if (req.path === '/health') return next()

  const ip = req.ip || req.socket?.remoteAddress
  if (!isBanned(ip)) return next()

  // Ban qilingan IP — haqiqiy route o'rniga soxta (decoy) javob + tarpit.
  const timer = setTimeout(() => {
    if (res.headersSent) return
    res.status(200).json(DECOY_BODY)
  }, tarpitDelay())
  // Ulanish uzilsa — taymerni tozalaymiz
  res.on('close', () => clearTimeout(timer))
}

const banStats = () => {
  const t = now()
  let banned = 0
  for (const rec of store.values()) if (rec.bannedUntil > t) banned++
  return { tracked: store.size, banned }
}

// Davriy tozalash — eskirgan yozuvlarni o'chiramiz (xotira o'smasligi uchun)
setInterval(() => {
  const t = now()
  for (const [ip, rec] of store.entries()) {
    if (rec.bannedUntil < t && t - rec.last > DECAY_MS) store.delete(ip)
  }
}, 10 * 60 * 1000).unref?.()

module.exports = { attackShield, recordOffense, isBanned, banStats }
