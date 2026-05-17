// Aloqa formi — guest yoki auth user xabar yuboradi.
// Xabar DB'ga saqlanadi + Telegram orqali admin'ga yuboriladi.
// Auth user xabarini va admin javobini /api/contact/my orqali ko'rishi mumkin.

const express = require('express')
const rateLimit = require('express-rate-limit')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const telegram = require('../lib/telegram')
const notifications = require('../lib/notifications')
const { auth, adminOnly } = require('../middleware/auth')

const router = express.Router()

// Soatiga IP'dan maks 5 ta xabar
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Juda ko'p xabar yubordingiz. Bir soatdan keyin urinib ko'ring" }
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Optional auth — token bo'lsa user_id qo'shadi, yo'q bo'lsa hech narsa
const optionalAuth = async (req, _res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return next()
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: '7d'
    })
    req.user = decoded
  } catch {
    // ignore — guest
  }
  next()
}

// ===== POST /api/contact — xabar yuborish =====
router.post('/', contactLimiter, optionalAuth, async (req, res) => {
  try {
    const { name, email, message } = req.body || {}

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

    const dbResult = await pool.query(
      `INSERT INTO contact_messages (name, email, message, ip, user_agent, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [cleanName, cleanEmail, cleanMessage, ip, userAgent.slice(0, 500), userId]
    )
    const messageId = dbResult.rows[0].id

    // Telegram'ga admin xabar
    let telegramSent = false
    if (telegram.isConfigured()) {
      const md = telegram.md
      const userBadge = userId ? '\\(ro\'yxatdan o\'tgan\\)' : '\\(mehmon\\)'
      const tgText = [
        `✉️ *Yangi xabar* \\#${messageId}`,
        '',
        `*Ism:* ${md(cleanName)} ${userBadge}`,
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
      message: userId
        ? "Xabaringiz qabul qilindi! Javobni profilingizdagi 'Xabarlarim' bo'limida ko'rasiz."
        : "Xabaringiz qabul qilindi! Email orqali javob beramiz. Saytda javobni ko'rish uchun ro'yxatdan o'ting."
    })
  } catch (err) {
    console.error('[Contact] error:', err.message)
    return res.status(500).json({ message: 'Server xatosi' })
  }
})

// ===== GET /api/contact/my — user'ning xabarlari + javoblar =====
router.get('/my', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, message, admin_reply, replied_at,
              status, read_by_user, telegram_sent, created_at
       FROM contact_messages
       WHERE user_id = $1 OR LOWER(email) = LOWER((SELECT email FROM users WHERE id = $1))
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('[Contact] my error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// User: javobni "o'qidim" deb belgilash
router.put('/my/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      `UPDATE contact_messages
       SET read_by_user = TRUE
       WHERE id = $1
         AND (user_id = $2 OR LOWER(email) = LOWER((SELECT email FROM users WHERE id = $2)))
       RETURNING id`,
      [id, req.user.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Xabar topilmadi' })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// ===== ADMIN endpoints =====

// Barcha xabarlar
router.get('/admin/list', auth, adminOnly, async (req, res) => {
  try {
    const { status = 'all', limit = 50 } = req.query
    let query = `SELECT id, name, email, message, admin_reply, replied_at,
                        status, telegram_sent, read_by_user, created_at, ip, user_id
                 FROM contact_messages`
    const params = []
    if (status !== 'all') {
      query += ' WHERE status = $1'
      params.push(status)
    }
    query += ` ORDER BY created_at DESC LIMIT ${Math.min(parseInt(limit) || 50, 200)}`
    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err) {
    console.error('[Contact] admin list error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// Admin javob yozadi
router.post('/admin/:id/reply', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { reply } = req.body || {}

    if (!reply || String(reply).trim().length < 5) {
      return res.status(400).json({ message: "Javob kamida 5 ta belgi bo'lishi kerak" })
    }
    const cleanReply = String(reply).trim().slice(0, 2000)

    // Xabarni topish
    const findResult = await pool.query(
      'SELECT id, name, email, user_id FROM contact_messages WHERE id = $1',
      [id]
    )
    if (findResult.rows.length === 0) {
      return res.status(404).json({ message: 'Xabar topilmadi' })
    }
    const msg = findResult.rows[0]

    // Javobni saqlash
    await pool.query(
      `UPDATE contact_messages
       SET admin_reply = $1,
           replied_at = NOW(),
           replied_by = $2,
           status = 'replied',
           read_by_user = FALSE
       WHERE id = $3`,
      [cleanReply, req.user.id, id]
    )

    // Agar xabar ro'yxatdan o'tgan user'dan bo'lsa — in-app notification yaratamiz
    if (msg.user_id) {
      notifications.notify(
        msg.user_id,
        'admin_reply',
        'Admin sizning xabaringizga javob berdi',
        cleanReply.slice(0, 200) + (cleanReply.length > 200 ? '...' : ''),
        '/dashboard',
        'mail'
      ).catch(() => {})
    }

    // Agar user Telegram'da tasdiqlanagan bo'lsa — Telegram'ga ham yuboramiz
    let telegramSent = false
    if (msg.user_id && telegram.isConfigured()) {
      try {
        const userRow = await pool.query(
          'SELECT telegram_chat_id FROM users WHERE id = $1',
          [msg.user_id]
        )
        const chatId = userRow.rows[0]?.telegram_chat_id
        if (chatId) {
          const md = telegram.md
          const text = [
            `📨 *Eduzy \\- Sizning xabaringizga javob*`,
            '',
            `Salom, ${md(msg.name)}\\!`,
            '',
            '*Admin javob berdi:*',
            md(cleanReply),
            '',
            `_Saytda ham ko'rishingiz mumkin: profilingizda "Xabarlarim" bo'limida_`
          ].join('\n')

          const result = await telegram.sendTo(chatId, text)
          telegramSent = result.ok === true
        }
      } catch (e) {
        console.error('[Contact] reply telegram error:', e.message)
      }
    }

    res.json({ ok: true, telegramSent })
  } catch (err) {
    console.error('[Contact] reply error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// Admin: status o'zgartirish
router.put('/admin/:id/status', auth, adminOnly, async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
