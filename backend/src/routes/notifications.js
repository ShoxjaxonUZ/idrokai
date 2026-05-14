// In-app notifications endpoint'lari
const express = require('express')
const pool = require('../db')
const { auth } = require('../middleware/auth')

const router = express.Router()

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

module.exports = router
