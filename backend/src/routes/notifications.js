// In-app notifications endpoint'lari
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const { auth, adminOnly } = require('../middleware/auth')
const notifyLib = require('../lib/notifications')
const sse = require('../lib/sse')

const router = express.Router()

// SSE stream — real-time notifications
// Token URL'da query parameter sifatida (EventSource'da headers qo'shib bo'lmaydi)
router.get('/stream', async (req, res) => {
  const token = req.query.token
  if (!token) {
    return res.status(401).end()
  }

  let userId
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: '7d'
    })
    userId = decoded.id
  } catch {
    return res.status(401).end()
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  // Initial greeting
  res.write('event: connected\n')
  res.write(`data: ${JSON.stringify({ ts: Date.now() })}\n\n`)

  const entry = sse.addClient(userId, res)

  req.on('close', () => {
    sse.removeClient(userId, entry)
  })
})

// GET /api/notifications — user'ning so'nggi bildirishnomalari
router.get('/', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100)
    const onlyUnread = req.query.unread === 'true'

    const where = onlyUnread ? 'WHERE user_id = $1 AND read = FALSE' : 'WHERE user_id = $1'
    const result = await pool.query(
      `SELECT id, type, title, message, link, icon, read, created_at
       FROM notifications
       ${where}
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      [req.user.id]
    )

    // O'qilmagan soni alohida
    const unreadResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = FALSE',
      [req.user.id]
    )

    res.json({
      items: result.rows,
      unread: unreadResult.rows[0]?.count || 0
    })
  } catch (err) {
    console.error('[notifications] list error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Topilmadi' })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// PUT /api/notifications/read-all
router.put('/read-all', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE',
      [req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// DELETE /api/notifications/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// DELETE /api/notifications — hammasini o'chirish
router.delete('/', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.user.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// ===== ADMIN BROADCAST =====
// POST /api/notifications/admin/broadcast
// body: { title, message, link?, audience: 'all'|'students'|'active7d', type? }
router.post('/admin/broadcast', auth, adminOnly, async (req, res) => {
  try {
    const { title, message, link, audience = 'all', type = 'system' } = req.body || {}

    if (!title || String(title).trim().length < 3) {
      return res.status(400).json({ message: "Sarlavha kamida 3 ta belgi bo'lishi kerak" })
    }
    if (message && String(message).length > 1000) {
      return res.status(400).json({ message: "Xabar 1000 belgi dan oshmasin" })
    }

    // Auditoriya bo'yicha userlar
    let query = 'SELECT id FROM users WHERE 1=1'
    if (audience === 'students') {
      query += " AND role = 'student'"
    } else if (audience === 'active7d') {
      // Oxirgi 7 kun ichida aktiv (notification, lesson_progress, battle_submissions'da harakat bor)
      query = `
        SELECT DISTINCT u.id FROM users u
        WHERE u.created_at > NOW() - INTERVAL '180 days'
          AND (
            EXISTS (SELECT 1 FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.id > 0)
            OR EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id)
          )
      `
    }

    const usersResult = await pool.query(query)
    const userIds = usersResult.rows.map(r => r.id)

    if (userIds.length === 0) {
      return res.json({ ok: true, sent: 0, message: 'Auditoriya bo\'sh' })
    }

    const sent = await notifyLib.notifyMany(
      userIds,
      String(type),
      String(title).trim().slice(0, 200),
      String(message || '').trim().slice(0, 1000),
      link ? String(link).slice(0, 500) : null,
      'sparkles'
    )

    res.json({ ok: true, sent, total: userIds.length })
  } catch (err) {
    console.error('[notifications] broadcast error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// Admin: oxirgi broadcast'lar tarixi
router.get('/admin/recent-broadcasts', auth, adminOnly, async (req, res) => {
  try {
    // Bir xil title+message+created_at bilan ko'p user uchun yuborilgan
    // Oddiy yondashuv: so'nggi system notification'lar guruh bo'yicha
    const result = await pool.query(`
      SELECT title, message, link, created_at,
             COUNT(*)::int AS recipients,
             SUM(CASE WHEN read THEN 1 ELSE 0 END)::int AS read_count
      FROM notifications
      WHERE type = 'system'
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY title, message, link, created_at
      HAVING COUNT(*) > 1
      ORDER BY created_at DESC
      LIMIT 20
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
