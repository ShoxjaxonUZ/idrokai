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

// GET /api/stats/graduates — real bitiruvchilar (sertifikatli), portfel bilan boyitilgan.
// Hikoyasi bor (portfel headline yozgan) bitiruvchilar avval ko'rsatiladi.
router.get('/graduates', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name,
        COALESCE(p.headline, '') AS headline,
        COALESCE(p.bio, '') AS bio,
        COALESCE(p.looking_for_work, false) AS looking_for_work,
        COUNT(c.id)::int AS certificates,
        (ARRAY_AGG(c.course_title ORDER BY c.issued_at DESC))[1] AS latest_course
      FROM certificates c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN portfolios p ON p.user_id = u.id
      WHERE u.role <> 'admin'
      GROUP BY u.id, u.name, p.headline, p.bio, p.looking_for_work
      ORDER BY (COALESCE(p.headline, '') <> '') DESC, COUNT(c.id) DESC, MAX(c.issued_at) DESC
      LIMIT 6
    `)
    res.json(result.rows)
  } catch (err) {
    console.error('[stats] graduates error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
