const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth } = require('../middleware/auth')

const countLessons = (lessonsRaw) => {
  let lessons = lessonsRaw
  if (typeof lessons === 'string') {
    try { lessons = JSON.parse(lessons) } catch { return 0 }
  }
  return Array.isArray(lessons) ? lessons.length : 0
}

router.post('/enroll', auth, async (req, res) => {
  try {
    const { course_id } = req.body
    if (!course_id) return res.status(400).json({ message: 'course_id kerak' })
    const user_id = req.user.id

    const course = await pool.query('SELECT id FROM courses WHERE id = $1', [String(course_id)])
    if (course.rows.length === 0) {
      return res.status(404).json({ message: 'Kurs topilmadi' })
    }

    const exists = await pool.query(
      'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [user_id, String(course_id)]
    )
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'Allaqachon yozilgansiz' })
    }

    await pool.query(
      'INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)',
      [user_id, String(course_id)]
    )

    res.json({ message: 'Kursga muvaffaqiyatli yozildingiz!' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

router.get('/my', auth, async (req, res) => {
  try {
    const user_id = req.user.id

    const result = await pool.query(
      'SELECT course_id, progress, created_at FROM enrollments WHERE user_id = $1',
      [user_id]
    )

    res.json(result.rows)

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

router.post('/progress', auth, async (req, res) => {
  try {
    const { course_id, lesson_index, completed } = req.body
    const lessonIdx = parseInt(lesson_index, 10)
    const isCompleted = completed === true || completed === 'true'

    if (!course_id || Number.isNaN(lessonIdx) || lessonIdx < 0 || lessonIdx > 1000) {
      return res.status(400).json({ message: 'Noto\'g\'ri so\'rov' })
    }
    const user_id = req.user.id
    const cid = String(course_id)

    const enrolled = await pool.query(
      'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [user_id, cid]
    )
    if (enrolled.rows.length === 0) {
      return res.status(403).json({ message: 'Kursga yozilmagansiz' })
    }

    const courseRes = await pool.query('SELECT lessons, darslar FROM courses WHERE id = $1', [cid])
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ message: 'Kurs topilmadi' })
    }
    const course = courseRes.rows[0]
    const total_lessons = countLessons(course.lessons) || parseInt(course.darslar, 10) || 0

    if (total_lessons > 0 && lessonIdx >= total_lessons) {
      return res.status(400).json({ message: 'lesson_index chegaradan tashqari' })
    }

    await pool.query(
      `INSERT INTO lesson_progress (user_id, course_id, lesson_index, completed)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, course_id, lesson_index)
       DO UPDATE SET completed = EXCLUDED.completed`,
      [user_id, cid, lessonIdx, isCompleted]
    )

    const result = await pool.query(
      'SELECT COUNT(*) FROM lesson_progress WHERE user_id = $1 AND course_id = $2 AND completed = TRUE',
      [user_id, cid]
    )

    const completed_count = parseInt(result.rows[0].count, 10)
    const progress = total_lessons > 0 ? Math.min(100, Math.round((completed_count / total_lessons) * 100)) : 0

    await pool.query(
      'UPDATE enrollments SET progress = $1 WHERE user_id = $2 AND course_id = $3',
      [progress, user_id, cid]
    )

    res.json({ progress, completed_count, total_lessons })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

// Sertifikat status — barcha module testlar topshirilganmi?
router.get('/certificate-status/:course_id', auth, async (req, res) => {
  try {
    const cid = String(req.params.course_id)
    const user_id = req.user.id

    const enrolled = await pool.query(
      'SELECT progress FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [user_id, cid]
    )
    if (enrolled.rows.length === 0) {
      return res.json({ eligible: false, reason: 'Kursga yozilmagansiz' })
    }

    const courseRes = await pool.query('SELECT title, lessons FROM courses WHERE id = $1', [cid])
    if (courseRes.rows.length === 0) {
      return res.json({ eligible: false, reason: 'Kurs topilmadi' })
    }
    const course = courseRes.rows[0]

    const totalLessons = countLessons(course.lessons)
    const totalModules = Math.ceil(totalLessons / 5)

    if (totalModules === 0) {
      return res.json({ eligible: false, reason: 'Kursda darslar yo\'q' })
    }

    const passed = await pool.query(
      `SELECT module_index FROM module_tests
       WHERE user_id = $1 AND course_id = $2 AND passed = TRUE`,
      [user_id, cid]
    )
    const passedSet = new Set(passed.rows.map(r => r.module_index))
    let allPassed = true
    for (let i = 0; i < totalModules; i++) {
      if (!passedSet.has(i)) { allPassed = false; break }
    }

    if (!allPassed) {
      return res.json({
        eligible: false,
        reason: 'Hamma module testlari topshirilmagan',
        modulesPassed: passedSet.size,
        modulesTotal: totalModules
      })
    }

    res.json({
      eligible: true,
      courseTitle: course.title,
      modulesTotal: totalModules,
      progress: enrolled.rows[0].progress || 100
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.get('/progress/:course_id', auth, async (req, res) => {
  try {
    const user_id = req.user.id
    const { course_id } = req.params

    const result = await pool.query(
      'SELECT lesson_index, completed FROM lesson_progress WHERE user_id = $1 AND course_id = $2',
      [user_id, String(course_id)]
    )

    res.json(result.rows)

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

module.exports = router
