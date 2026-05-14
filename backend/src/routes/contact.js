// Aloqa formi — guest yoki auth user xabar yuboradi.
// Xabar DB'ga saqlanadi + Telegram orqali admin'ga yuboriladi.

const express = require('express')
const rateLimit = require('express-rate-limit')
const pool = require('../db')
const telegram = require('../lib/telegram')

const router = express.Router()

// Kuchli rate limit — bir IP'dan soatiga maks 5 ta xabar
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Juda ko'p xabar yubordingiz. Bir soatdan keyin urinib ko'ring" }
})

// Email regex (basic)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/', contactLimiter, async (req, res) => {
  try {
    const { name, email, message } = req.body || {}

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ message: "Barcha maydonlarni to'ldiring" })
    }
    const cleanName = String(name).trim()
    const cleanEmail = String(email).trim().toLowerCase()
    const cleanMessage = String(message).trim()

    if (cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({ message: "Ism 2-100 belgi bo'lishi kerak" })
    }
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 200) {
      return res.status(400).json({ message: "Email noto'g'ri" })
    }
    if (cleanMessage.length < 10 || cleanMessage.length > 2000) {
      return res.status(400).json({ message: "Xabar 10-2000 belgi bo'lishi kerak" })
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown'
    const userAgent = req.headers['user-agent'] || ''
    const userId = req.user?.id || null

    // DB'ga saqlash
    const dbResult = await pool.query(
      `INSERT INTO contact_messages (name, email, message, ip, user_agent, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [cleanName, cleanEmail, cleanMessage, ip, userAgent.slice(0, 500), userId]
    )
    const messageId = dbResult.rows[0].id

    // Telegram'ga jo'natish
    let telegramSent = false
    if (telegram.isConfigured()) {
      const md = telegram.md
      const tgText = [
        '✉️ *Yangi xabar — Aloqa formi*',
        '',
        `*ID:* \\#${messageId}`,
        `*Ism:* ${md(cleanName)}`,
        `*Email:* \`${md(cleanEmail)}\``,
        '',
        '*Xabar:*',
        `${md(cleanMessage.slice(0, 1500))}${cleanMessage.length > 1500 ? '...' : ''}`,
        '',
        `_IP: ${md(ip)}_`,
        `_Vaqt: ${md(new Date().toISOString())}_`
      ].join('\n')

      const result = await telegram.sendToAdmin(tgText, { silent: false })
      telegramSent = result.ok === true

      // DB'da telegram_sent flag yangilash (fire-and-forget)
      if (telegramSent) {
        pool.query(
          'UPDATE contact_messages SET telegram_sent = TRUE WHERE id = $1',
          [messageId]
        ).catch(() => {})
      }
    }

    return res.json({
      ok: true,
      messageId,
      telegramSent,
      message: "Xabaringiz qabul qilindi! Tez orada javob beramiz."
    })
  } catch (err) {
    console.error('[Contact] error:', err.message)
    return res.status(500).json({ message: 'Server xatosi. Birozdan keyin urinib ko\'ring' })
  }
})

// Admin uchun — barcha xabarlar (faqat admin role)
router.get('/admin/list', async (req, res) => {
  try {
    // auth middleware barcha route'larga global emas, shu yerda lazy check
    const auth = require('../middleware/auth')
    auth.adminOnly(req, res, async () => {
      const { status = 'all', limit = 50 } = req.query
      let query = `SELECT id, name, email, message, status, telegram_sent, created_at, ip
                   FROM contact_messages`
      const params = []
      if (status !== 'all') {
        query += ' WHERE status = $1'
        params.push(status)
      }
      query += ` ORDER BY created_at DESC LIMIT ${Math.min(parseInt(limit) || 50, 200)}`
      const result = await pool.query(query, params)
      res.json(result.rows)
    })
  } catch (err) {
    console.error('[Contact] admin list error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// Admin: status o'zgartirish (read/replied/archived)
router.put('/admin/:id/status', async (req, res) => {
  try {
    const auth = require('../middleware/auth')
    auth.adminOnly(req, res, async () => {
      const { id } = req.params
      const { status } = req.body
      if (!['new', 'read', 'replied', 'archived'].includes(status)) {
        return res.status(400).json({ message: "Status noto'g'ri" })
      }
      await pool.query(
        'UPDATE contact_messages SET status = $1 WHERE id = $2',
        [status, id]
      )
      res.json({ ok: true })
    })
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
