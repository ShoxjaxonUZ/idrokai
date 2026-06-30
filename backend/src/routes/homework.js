// Uyga vazifa — talaba javob yuboradi, AI (Groq) avtomatik baholaydi.
// Vazifa MATNI darsda saqlanadi (courses.lessons[idx].homework), bu yerda faqat JAVOB + ball.

const express = require('express')
const pool = require('../db')
const { auth } = require('../middleware/auth')
const { gradeHomework } = require('../lib/homeworkGrade')

const router = express.Router()

const parseIdx = (v) => {
  const n = parseInt(v, 10)
  return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : null
}

// Darsdagi vazifa matnini courses.lessons[idx] dan olish
async function getLessonHomework(courseId, idx) {
  const r = await pool.query('SELECT title, lessons FROM courses WHERE id = $1', [String(courseId)])
  if (!r.rows[0]) return null
  const lessons = Array.isArray(r.rows[0].lessons) ? r.rows[0].lessons : []
  const lesson = lessons[idx]
  if (!lesson || typeof lesson !== 'object') return null
  return {
    courseTitle: r.rows[0].title,
    lessonTitle: lesson.title || `${idx + 1}-dars`,
    task: (lesson.homework || '').trim()
  }
}

// GET /api/homework/:courseId/:lessonIndex — joriy talabaning topshirig'i (bo'lsa)
router.get('/:courseId/:lessonIndex', auth, async (req, res) => {
  try {
    const idx = parseIdx(req.params.lessonIndex)
    if (idx === null) return res.status(400).json({ message: "Lesson index noto'g'ri" })

    const r = await pool.query(
      `SELECT answer, score, feedback, attempts, updated_at
       FROM homework_submissions
       WHERE user_id = $1 AND course_id = $2 AND lesson_index = $3`,
      [req.user.id, String(req.params.courseId), idx]
    )
    res.json(r.rows[0] || null)
  } catch (err) {
    console.error('[homework] get error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST /api/homework/submit — { courseId, lessonIndex, answer } → AI baholaydi, saqlaydi
router.post('/submit', auth, async (req, res) => {
  try {
    const { courseId, lessonIndex, answer } = req.body || {}
    const idx = parseIdx(lessonIndex)
    if (!courseId || idx === null) return res.status(400).json({ message: "Noto'g'ri so'rov" })

    const ans = String(answer || '').trim().slice(0, 8000)
    if (ans.length < 3) return res.status(400).json({ message: 'Javob bo\'sh' })

    const hw = await getLessonHomework(courseId, idx)
    if (!hw) return res.status(404).json({ message: 'Dars topilmadi' })
    if (!hw.task) return res.status(400).json({ message: 'Bu darsda uy vazifasi yo\'q' })

    // Bir martalik — allaqachon topshirilgan bo'lsa qayta yuborib bo'lmaydi
    const prev = await pool.query(
      'SELECT 1 FROM homework_submissions WHERE user_id = $1 AND course_id = $2 AND lesson_index = $3',
      [req.user.id, String(courseId), idx]
    )
    if (prev.rows.length > 0) {
      return res.status(409).json({ message: 'Vazifa allaqachon topshirilgan — qayta yuborib bo\'lmaydi' })
    }

    const result = await gradeHomework({
      courseTitle: hw.courseTitle,
      lessonTitle: hw.lessonTitle,
      task: hw.task,
      answer: ans
    })

    // AI xatoligi — saqlamaymiz, talaba qayta urinsin
    if (result.score === null) {
      return res.status(503).json({ message: result.feedback })
    }

    // Bir martalik yozuv — poyga bo'lsa (DO NOTHING) ikkinchisi rad etiladi
    const saved = await pool.query(
      `INSERT INTO homework_submissions (user_id, course_id, lesson_index, answer, score, feedback)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, course_id, lesson_index) DO NOTHING
       RETURNING answer, score, feedback, attempts, updated_at`,
      [req.user.id, String(courseId), idx, ans, result.score, result.feedback]
    )

    if (saved.rows.length === 0) {
      return res.status(409).json({ message: 'Vazifa allaqachon topshirilgan — qayta yuborib bo\'lmaydi' })
    }

    res.json(saved.rows[0])
  } catch (err) {
    console.error('[homework] submit error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
