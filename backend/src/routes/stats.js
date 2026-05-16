// Public statistika — bosh sahifadagi "Bizning ko'rsatkichlar" uchun.
// Auth talab qilmaydi, faqat real bazadan o'qiydi.
const express = require('express')
const pool = require('../db')

const router = express.Router()

// GET /api/stats — real o'quvchi / kurs / dars / mamnunlik
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role != 'admin') AS users,
        (SELECT COUNT(*) FROM courses) AS courses,
        (SELECT COALESCE(SUM(
            CASE WHEN jsonb_typeof(lessons) = 'array'
                 THEN jsonb_array_length(lessons) ELSE 0 END
        ), 0) FROM courses) AS lessons,
        (SELECT COUNT(*) FROM course_ratings) AS ratings_count,
        (SELECT AVG(rating) FROM course_ratings) AS avg_rating,
        (SELECT COUNT(*) FROM certificates) AS certificates
    `)
    const row = result.rows[0]
    res.json({
      users: parseInt(row.users) || 0,
      courses: parseInt(row.courses) || 0,
      lessons: parseInt(row.lessons) || 0,
      certificates: parseInt(row.certificates) || 0,
      ratingsCount: parseInt(row.ratings_count) || 0,
      avgRating: row.avg_rating ? parseFloat(row.avg_rating) : null
    })
  } catch (err) {
    console.error('[stats] error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
