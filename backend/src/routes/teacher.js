// Kurs ro'yxati endpoint'i (ommaviy). Tarixiy sabablarga ko'ra "/api/teacher" nomi ostida —
// o'qituvchi roli olib tashlangan (faqat admin bor), lekin URL nomi saqlangan (ko'p joyda ishlatiladi).
// Kurs yaratish/tahrirlash endi /api/admin/courses orqali.

const express = require('express')
const router = express.Router()
const pool = require('../db')

router.get('/all-courses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        COUNT(DISTINCT e.user_id) as students_count,
        COALESCE(rating_summary.avg_rating, 0)::float as avg_rating,
        COALESCE(rating_summary.ratings_count, 0)::int as ratings_count
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN (
        SELECT course_id,
               ROUND(AVG(rating)::numeric, 1)::float AS avg_rating,
               COUNT(*)::int AS ratings_count
        FROM course_ratings
        GROUP BY course_id
      ) rating_summary ON rating_summary.course_id = c.id
      GROUP BY c.id, rating_summary.avg_rating, rating_summary.ratings_count
      ORDER BY c.created_at ASC
    `)
    const courses = result.rows.map(c => ({
      ...c,
      desc: c.description,
      image: c.image || '',
      lessons: c.lessons || [],
      students_count: parseInt(c.students_count) || 0,
      avg_rating: c.avg_rating || 0,
      ratings_count: c.ratings_count || 0
    }))
    res.json(courses)
  } catch (err) {
    console.error('[all-courses] error:', err.message)
    res.status(500).json({ message: 'Xatolik' })
  }
})

module.exports = router
