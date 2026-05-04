const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth } = require('../middleware/auth')

// Auth talab qilinadi va email/created_at qaytarilmaydi (PII himoyasi)
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        COALESCE(r.points, 1000) as points,
        COALESCE(r.wins, 0) as wins,
        COALESCE(r.losses, 0) as losses,
        COUNT(DISTINCT e.course_id) as enrolled_courses,
        COUNT(DISTINCT CASE WHEN e.progress = 100 THEN e.course_id END) as completed_courses
      FROM users u
      LEFT JOIN ratings r ON u.id = r.user_id
      LEFT JOIN enrollments e ON u.id = e.user_id
      WHERE u.role != 'admin'
      GROUP BY u.id, u.name, r.points, r.wins, r.losses
      ORDER BY points DESC, completed_courses DESC
      LIMIT 50
    `)

    const leaderboard = result.rows.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      name: u.name,
      points: parseInt(u.points) || 1000,
      wins: parseInt(u.wins) || 0,
      losses: parseInt(u.losses) || 0,
      enrolled_courses: parseInt(u.enrolled_courses) || 0,
      completed_courses: parseInt(u.completed_courses) || 0
    }))

    res.json(leaderboard)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

module.exports = router
