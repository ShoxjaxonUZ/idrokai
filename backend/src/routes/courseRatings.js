// Kurs reytinglari va sharhlar
const express = require('express')
const pool = require('../db')
const { auth } = require('../middleware/auth')

const router = express.Router()

// GET /api/course-ratings/:courseId — kurs barcha sharhlari va avg
router.get('/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params

    const summaryResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        ROUND(AVG(rating)::numeric, 2)::float AS avg_rating,
        COUNT(*) FILTER (WHERE rating = 5)::int AS r5,
        COUNT(*) FILTER (WHERE rating = 4)::int AS r4,
        COUNT(*) FILTER (WHERE rating = 3)::int AS r3,
        COUNT(*) FILTER (WHERE rating = 2)::int AS r2,
        COUNT(*) FILTER (WHERE rating = 1)::int AS r1
      FROM course_ratings WHERE course_id = $1
    `, [courseId])

    const reviewsResult = await pool.query(`
      SELECT cr.id, cr.rating, cr.review, cr.created_at,
             u.name AS user_name
      FROM course_ratings cr
      JOIN users u ON u.id = cr.user_id
      WHERE cr.course_id = $1
      ORDER BY cr.created_at DESC
      LIMIT 50
    `, [courseId])

    const summary = summaryResult.rows[0] || { total: 0, avg_rating: 0 }
    res.json({
      total: summary.total,
      avg_rating: summary.avg_rating || 0,
      distribution: {
        5: summary.r5, 4: summary.r4, 3: summary.r3, 2: summary.r2, 1: summary.r1
      },
      reviews: reviewsResult.rows
    })
  } catch (err) {
    console.error('[ratings] get error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// GET /api/course-ratings/:courseId/my — user'ning shu kursdagi reytingi
router.get('/:courseId/my', auth, async (req, res) => {
  try {
    const { courseId } = req.params
    const result = await pool.query(
      'SELECT rating, review, created_at FROM course_ratings WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    )
    res.json(result.rows[0] || null)
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST /api/course-ratings/:courseId — baholash (faqat enrolled)
router.post('/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params
    const { rating, review } = req.body || {}

    const r = parseInt(rating)
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: "Reyting 1-5 oralig'ida bo'lishi kerak" })
    }
    const cleanReview = review ? String(review).trim().slice(0, 1000) : null

    // Faqat enrolled student'lar
    const enrollResult = await pool.query(
      'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    )
    if (enrollResult.rows.length === 0) {
      return res.status(403).json({ message: "Faqat kursga yozilganlar baholay oladi" })
    }

    await pool.query(`
      INSERT INTO course_ratings (user_id, course_id, rating, review, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, course_id) DO UPDATE SET
        rating = EXCLUDED.rating,
        review = EXCLUDED.review,
        updated_at = NOW()
    `, [req.user.id, courseId, r, cleanReview])

    res.json({ ok: true })
  } catch (err) {
    console.error('[ratings] post error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// DELETE /api/course-ratings/:courseId/:reviewId — o'zining sharhini o'chirish
router.delete('/:courseId/my', auth, async (req, res) => {
  try {
    const { courseId } = req.params
    await pool.query(
      'DELETE FROM course_ratings WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
