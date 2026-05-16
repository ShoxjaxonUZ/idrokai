// Video pozitsiyani saqlash — student qayerda to'xtaganini eslash
const express = require('express')
const pool = require('../db')
const { auth } = require('../middleware/auth')

const router = express.Router()

// GET /api/video-progress/:courseId/:lessonIndex
router.get('/:courseId/:lessonIndex', auth, async (req, res) => {
  try {
    const { courseId, lessonIndex } = req.params
    const idx = parseInt(lessonIndex, 10)
    if (!Number.isInteger(idx) || idx < 0 || idx > 9999) {
      return res.status(400).json({ message: "Lesson index noto'g'ri" })
    }
    const result = await pool.query(
      `SELECT position_seconds, duration_seconds, updated_at
       FROM lesson_video_progress
       WHERE user_id = $1 AND course_id = $2 AND lesson_index = $3`,
      [req.user.id, courseId, idx]
    )
    res.json(result.rows[0] || { position_seconds: 0, duration_seconds: null })
  } catch (err) {
    console.error('[video-progress] get error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// PUT /api/video-progress/:courseId/:lessonIndex
router.put('/:courseId/:lessonIndex', auth, async (req, res) => {
  try {
    const { courseId, lessonIndex } = req.params
    const idx = parseInt(lessonIndex, 10)
    if (!Number.isInteger(idx) || idx < 0 || idx > 9999) {
      return res.status(400).json({ message: "Lesson index noto'g'ri" })
    }
    const { position, duration } = req.body || {}

    const pos = Math.max(0, parseFloat(position) || 0)
    const dur = duration ? Math.max(0, parseFloat(duration)) : null

    await pool.query(
      `INSERT INTO lesson_video_progress (user_id, course_id, lesson_index, position_seconds, duration_seconds, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, course_id, lesson_index)
       DO UPDATE SET
         position_seconds = EXCLUDED.position_seconds,
         duration_seconds = COALESCE(EXCLUDED.duration_seconds, lesson_video_progress.duration_seconds),
         updated_at = NOW()`,
      [req.user.id, courseId, idx, pos, dur]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[video-progress] put error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// DELETE /api/video-progress/:courseId/:lessonIndex — reset (lesson tugaganda)
router.delete('/:courseId/:lessonIndex', auth, async (req, res) => {
  try {
    const { courseId, lessonIndex } = req.params
    const idx = parseInt(lessonIndex, 10)
    if (!Number.isInteger(idx) || idx < 0 || idx > 9999) {
      return res.status(400).json({ message: "Lesson index noto'g'ri" })
    }
    await pool.query(
      `DELETE FROM lesson_video_progress
       WHERE user_id = $1 AND course_id = $2 AND lesson_index = $3`,
      [req.user.id, courseId, idx]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
