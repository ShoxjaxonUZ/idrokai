// Do'stlar bilan muloqot — to'g'ridan-to'g'ri xabarlar (1:1 chat).
// Faqat qabul qilingan do'stlar yozisha oladi. Real-time SSE 'message' event bilan.

const express = require('express')
const pool = require('../db')
const { auth } = require('../middleware/auth')
const sse = require('../lib/sse')

const router = express.Router()

async function areFriends(a, b) {
  const r = await pool.query(
    `SELECT 1 FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
     LIMIT 1`,
    [a, b]
  )
  return r.rows.length > 0
}

// GET /api/messages/conversations — suhbatlar (oxirgi xabar + o'qilmagan soni)
router.get('/conversations', auth, async (req, res) => {
  try {
    const me = req.user.id
    const r = await pool.query(`
      WITH pairs AS (
        SELECT
          CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id,
          body, created_at, sender_id
        FROM messages
        WHERE sender_id = $1 OR recipient_id = $1
      ),
      last_msg AS (
        SELECT DISTINCT ON (other_id) other_id, body, created_at, sender_id
        FROM pairs
        ORDER BY other_id, created_at DESC
      )
      SELECT lm.other_id AS id, u.name,
        lm.body AS last_body, lm.created_at AS last_at,
        (lm.sender_id = $1) AS last_mine,
        (SELECT COUNT(*)::int FROM messages m
         WHERE m.sender_id = lm.other_id AND m.recipient_id = $1 AND m.read_at IS NULL) AS unread
      FROM last_msg lm
      JOIN users u ON u.id = lm.other_id
      ORDER BY lm.created_at DESC
    `, [me])
    res.json(r.rows)
  } catch (err) {
    console.error('[messages] conversations error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// GET /api/messages/unread-count — jami o'qilmagan xabarlar
router.get('/unread-count', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT COUNT(*)::int AS n FROM messages WHERE recipient_id = $1 AND read_at IS NULL',
      [req.user.id]
    )
    res.json({ unread: r.rows[0].n })
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// GET /api/messages/:userId — suhbat tarixi (+ kelganlarni o'qilgan deb belgilash)
router.get('/:userId', auth, async (req, res) => {
  try {
    const me = req.user.id
    const other = parseInt(req.params.userId, 10)
    if (!Number.isInteger(other)) return res.status(400).json({ message: "Noto'g'ri foydalanuvchi" })
    const friend = await pool.query('SELECT id, name FROM users WHERE id = $1', [other])
    if (friend.rows.length === 0) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' })

    const msgs = await pool.query(`
      SELECT id, sender_id, recipient_id, body, created_at, read_at
      FROM messages
      WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
      ORDER BY created_at ASC
      LIMIT 200
    `, [me, other])

    await pool.query(
      'UPDATE messages SET read_at = NOW() WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL',
      [me, other]
    )

    res.json({ friend: friend.rows[0], messages: msgs.rows })
  } catch (err) {
    console.error('[messages] history error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST /api/messages/:userId — xabar yuborish (faqat do'stga)
router.post('/:userId', auth, async (req, res) => {
  try {
    const me = req.user.id
    const other = parseInt(req.params.userId, 10)
    if (!Number.isInteger(other) || other === me) {
      return res.status(400).json({ message: "Noto'g'ri foydalanuvchi" })
    }
    const body = String(req.body?.body || '').trim()
    if (body.length < 1 || body.length > 2000) {
      return res.status(400).json({ message: "Xabar 1–2000 belgi bo'lishi kerak" })
    }
    if (!(await areFriends(me, other))) {
      return res.status(403).json({ message: "Faqat do'stlar bilan yozishish mumkin" })
    }

    const r = await pool.query(
      'INSERT INTO messages (sender_id, recipient_id, body) VALUES ($1, $2, $3) RETURNING id, created_at',
      [me, other, body]
    )
    const msg = {
      id: r.rows[0].id,
      sender_id: me,
      recipient_id: other,
      body,
      created_at: r.rows[0].created_at,
      sender_name: req.user.name || 'Foydalanuvchi'
    }
    // Real-time push — qabul qiluvchi onlayn bo'lsa darrov ko'radi
    try { sse.sendToUser(other, 'message', msg) } catch {}

    res.json({ ok: true, message: msg })
  } catch (err) {
    console.error('[messages] send error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
