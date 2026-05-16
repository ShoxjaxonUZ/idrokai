// Sertifikat — berish (issue) va QR orqali tekshirish (verify)
const express = require('express')
const pool = require('../db')
const { auth } = require('../middleware/auth')

const router = express.Router()

// JSONB lessons array'dagi darslar sonini hisoblash
const countLessons = (lessons) => {
  if (Array.isArray(lessons)) return lessons.length
  if (typeof lessons === 'string') {
    try {
      const parsed = JSON.parse(lessons)
      return Array.isArray(parsed) ? parsed.length : 0
    } catch { return 0 }
  }
  return 0
}

// Unique cert_code generatsiya: IDR-XXXXXX (6 belgi, harf+raqam)
const genCertCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // chalkash belgilar yo'q (0/O, 1/I)
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `IDR-${code}`
}

// POST /api/certificate/issue/:courseId — sertifikat berish (eligible bo'lsa)
router.post('/issue/:courseId', auth, async (req, res) => {
  try {
    const courseId = String(req.params.courseId)
    const userId = req.user.id

    // Mavjud sertifikat bormi?
    const existing = await pool.query(
      'SELECT cert_code, course_title, user_name, lessons_count, issued_at FROM certificates WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    )
    if (existing.rows.length > 0) {
      return res.json({ ok: true, ...existing.rows[0], alreadyIssued: true })
    }

    // Eligibility tekshirish
    const enrolled = await pool.query(
      'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [userId, courseId]
    )
    if (enrolled.rows.length === 0) {
      return res.status(403).json({ message: 'Kursga yozilmagansiz' })
    }

    const courseRes = await pool.query('SELECT title, lessons FROM courses WHERE id = $1', [courseId])
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ message: 'Kurs topilmadi' })
    }
    const course = courseRes.rows[0]
    const totalLessons = countLessons(course.lessons)
    const totalModules = Math.ceil(totalLessons / 5)

    if (totalModules === 0) {
      return res.status(400).json({ message: "Kursda darslar yo'q" })
    }

    const passed = await pool.query(
      `SELECT module_index FROM module_tests
       WHERE user_id = $1 AND course_id = $2 AND passed = TRUE`,
      [userId, courseId]
    )
    const passedSet = new Set(passed.rows.map(r => r.module_index))
    for (let i = 0; i < totalModules; i++) {
      if (!passedSet.has(i)) {
        return res.status(400).json({ message: 'Barcha modul testlari topshirilmagan' })
      }
    }

    // User ismi
    const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId])
    const userName = userRes.rows[0]?.name || 'Foydalanuvchi'

    // Unique cert_code (kollizyon bo'lsa qayta urinish)
    let certCode
    for (let attempt = 0; attempt < 5; attempt++) {
      certCode = genCertCode()
      const clash = await pool.query('SELECT 1 FROM certificates WHERE cert_code = $1', [certCode])
      if (clash.rows.length === 0) break
    }

    const result = await pool.query(
      `INSERT INTO certificates (cert_code, user_id, course_id, user_name, course_title, lessons_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, course_id) DO UPDATE SET course_title = EXCLUDED.course_title
       RETURNING cert_code, course_title, user_name, lessons_count, issued_at`,
      [certCode, userId, courseId, userName, course.title, totalLessons]
    )

    res.json({ ok: true, ...result.rows[0], alreadyIssued: false })
  } catch (err) {
    console.error('[certificate] issue error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// GET /api/certificate/my — foydalanuvchining barcha sertifikatlari
router.get('/my', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cert_code, course_id, course_title, lessons_count, issued_at
       FROM certificates WHERE user_id = $1
       ORDER BY issued_at DESC`,
      [req.user.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('[certificate] my error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// GET /api/certificate/verify/:code — public — QR orqali tekshirish
router.get('/verify/:code', async (req, res) => {
  try {
    const code = String(req.params.code).trim().toUpperCase()
    const result = await pool.query(
      `SELECT cert_code, user_name, course_title, lessons_count, issued_at, course_id
       FROM certificates WHERE cert_code = $1`,
      [code]
    )
    if (result.rows.length === 0) {
      return res.json({ valid: false })
    }
    res.json({ valid: true, certificate: result.rows[0] })
  } catch (err) {
    console.error('[certificate] verify error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
