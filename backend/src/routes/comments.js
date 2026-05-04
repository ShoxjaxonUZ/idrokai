const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth } = require('../middleware/auth')

const MAX_LEN = 500

router.get('/:course_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.text, c.created_at, u.name, u.id as user_id
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.course_id = $1
       ORDER BY c.created_at DESC
       LIMIT 200`,
      [String(req.params.course_id)]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/', auth, async (req, res) => {
  try {
    const { course_id, text } = req.body
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Izoh bo\'sh bo\'lmasin' })
    }
    const trimmed = text.trim()
    if (trimmed.length > MAX_LEN) {
      return res.status(400).json({ message: `Izoh ${MAX_LEN} belgidan oshmasin` })
    }
    if (!course_id) return res.status(400).json({ message: 'course_id kerak' })

    const course = await pool.query('SELECT 1 FROM courses WHERE id = $1', [String(course_id)])
    if (course.rows.length === 0) return res.status(404).json({ message: 'Kurs topilmadi' })

    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO comments (user_id, course_id, text)
         VALUES ($1, $2, $3)
         RETURNING id, text, created_at, user_id
       )
       SELECT i.id, i.text, i.created_at, i.user_id, u.name
       FROM inserted i JOIN users u ON i.user_id = u.id`,
      [req.user.id, String(course_id), trimmed]
    )

    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.delete('/:id', auth, async (req, res) => {
  try {
    const comment = await pool.query('SELECT user_id FROM comments WHERE id = $1', [req.params.id])
    if (comment.rows.length === 0) return res.status(404).json({ message: 'Topilmadi' })

    const userRow = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id])
    const role = userRow.rows[0]?.role

    if (comment.rows[0].user_id !== req.user.id && role !== 'admin') {
      return res.status(403).json({ message: 'Ruxsat yo\'q' })
    }
    await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id])
    res.json({ message: 'O\'chirildi' })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

module.exports = router
