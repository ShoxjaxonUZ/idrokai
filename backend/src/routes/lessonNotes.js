// Dars eslatmalari (student'ning shaxsiy)
const express = require('express')
const pool = require('../db')
const { auth } = require('../middleware/auth')

const router = express.Router()

// MUHIM: route tartibi — /course/:courseId AVVAL bo'lishi shart,
// aks holda /:courseId/:lessonIndex bilan to'qnashadi.

// GET /api/lesson-notes/course/:courseId — kurs ichidagi barcha notes
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params
    const result = await pool.query(
      `SELECT lesson_index, LEFT(content, 100) AS preview, updated_at
       FROM lesson_notes
       WHERE user_id = $1 AND course_id = $2 AND LENGTH(TRIM(content)) > 0
       ORDER BY lesson_index ASC`,
      [req.user.id, courseId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('[lesson-notes] course list error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// GET /api/lesson-notes/:courseId/:lessonIndex
router.get('/:courseId/:lessonIndex', auth, async (req, res) => {
  try {
    const { courseId, lessonIndex } = req.params
    const idx = parseInt(lessonIndex, 10)
    if (!Number.isInteger(idx) || idx < 0 || idx > 9999) {
      return res.status(400).json({ message: "Lesson index noto'g'ri" })
    }
    const result = await pool.query(
      `SELECT content, updated_at FROM lesson_notes
       WHERE user_id = $1 AND course_id = $2 AND lesson_index = $3`,
      [req.user.id, courseId, idx]
    )
    res.json(result.rows[0] || { content: '', updated_at: null })
  } catch (err) {
    console.error('[lesson-notes] get error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// PUT /api/lesson-notes/:courseId/:lessonIndex
router.put('/:courseId/:lessonIndex', auth, async (req, res) => {
  try {
    const { courseId, lessonIndex } = req.params
    const idx = parseInt(lessonIndex, 10)
    if (!Number.isInteger(idx) || idx < 0 || idx > 9999) {
      return res.status(400).json({ message: "Lesson index noto'g'ri" })
    }
    const { content } = req.body || {}
    const cleanContent = String(content || '').slice(0, 10000)

    await pool.query(
      `INSERT INTO lesson_notes (user_id, course_id, lesson_index, content, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, course_id, lesson_index)
       DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()`,
      [req.user.id, courseId, idx, cleanContent]
    )
    res.json({ ok: true, updated_at: new Date().toISOString() })
  } catch (err) {
    console.error('[lesson-notes] put error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
