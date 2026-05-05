const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth, adminOnly } = require('../middleware/auth')
const telegram = require('../lib/telegram')
const email = require('../lib/email')

// So'nggi N hujum log'lari
router.get('/logs', auth, adminOnly, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100))
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0)
    const category = typeof req.query.category === 'string' ? req.query.category : null
    const severity = typeof req.query.severity === 'string' ? req.query.severity : null

    const where = []
    const params = []
    if (category) { params.push(category); where.push(`category = $${params.length}`) }
    if (severity) { params.push(severity); where.push(`severity = $${params.length}`) }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''

    params.push(limit, offset)
    const sql = `
      SELECT id, ts, ip, user_agent, method, url, category, severity, pattern,
             user_id, country, city, region, isp, asn,
             latitude, longitude, timezone, postal
      FROM attack_logs
      ${whereSql}
      ORDER BY ts DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

// Statistika — dashboard uchun
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const [byCat, bySev, topIps, last24h, total] = await Promise.all([
      pool.query(`
        SELECT category, COUNT(*)::int AS count
        FROM attack_logs
        WHERE ts > NOW() - INTERVAL '7 days'
        GROUP BY category ORDER BY count DESC
      `),
      pool.query(`
        SELECT severity, COUNT(*)::int AS count
        FROM attack_logs
        WHERE ts > NOW() - INTERVAL '7 days'
        GROUP BY severity
      `),
      pool.query(`
        SELECT ip, country, region, city, isp, asn,
               latitude, longitude, timezone,
               COUNT(*)::int AS count, MAX(ts) AS last_seen
        FROM attack_logs
        WHERE ts > NOW() - INTERVAL '7 days'
        GROUP BY ip, country, region, city, isp, asn, latitude, longitude, timezone
        ORDER BY count DESC
        LIMIT 20
      `),
      pool.query(`SELECT COUNT(*)::int AS count FROM attack_logs WHERE ts > NOW() - INTERVAL '24 hours'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM attack_logs`)
    ])

    res.json({
      total: total.rows[0].count,
      last24h: last24h.rows[0].count,
      byCategory: byCat.rows,
      bySeverity: bySev.rows,
      topAttackers: topIps.rows,
      telegramConfigured: telegram.isConfigured()
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

// Bitta IP haqida batafsil
router.get('/ip/:ip', auth, adminOnly, async (req, res) => {
  try {
    const ip = req.params.ip.slice(0, 100)
    const result = await pool.query(`
      SELECT id, ts, method, url, category, severity, pattern, user_agent,
             country, region, city, postal, isp, asn,
             latitude, longitude, timezone, details
      FROM attack_logs
      WHERE ip = $1
      ORDER BY ts DESC
      LIMIT 200
    `, [ip])

    // Joylashuv xulosa qo'shamiz (oxirgi yozuvdan)
    const latest = result.rows[0]
    const summary = latest ? {
      ip,
      country: latest.country,
      region: latest.region,
      city: latest.city,
      latitude: latest.latitude,
      longitude: latest.longitude,
      mapsUrl: latest.latitude && latest.longitude
        ? `https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`
        : null,
      isp: latest.isp,
      asn: latest.asn,
      timezone: latest.timezone,
      attackCount: result.rowCount
    } : null

    res.json({ summary, logs: result.rows })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

// SMTP/Email test
router.post('/email-test', auth, adminOnly, async (req, res) => {
  const to = req.body?.to
  if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ message: 'Email manzilini kiriting' })
  }
  if (!email.isConfigured()) {
    return res.status(400).json({
      message: 'Email provayder sozlanmagan',
      hint: 'Render Environment\'da RESEND_API_KEY yoki SMTP_USER+SMTP_PASS o\'rnating'
    })
  }
  const result = await email.sendTestEmail(to)
  res.json({
    ok: result.ok,
    provider: email.getProvider(),
    message: result.ok ? `Test xabar ${to} ga yuborildi` : `Xato: ${result.reason}`,
    details: result
  })
})

// Email holati
router.get('/email-status', auth, adminOnly, (req, res) => {
  res.json({
    configured: email.isConfigured(),
    provider: email.getProvider()
  })
})

// Telegram test xabari
router.post('/telegram-test', auth, adminOnly, async (req, res) => {
  if (!telegram.isConfigured()) {
    return res.status(400).json({ message: 'Telegram sozlanmagan (TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID kerak)' })
  }
  const ok = await telegram.sendMessage(
    `🧪 *Test xabari*\n\nBu admin paneldan jo'natilgan test\\.\nVaqt: ${new Date().toISOString().replace(/[-:.T]/g, '\\$&')}`
  )
  res.json({ ok, configured: true })
})

module.exports = router
