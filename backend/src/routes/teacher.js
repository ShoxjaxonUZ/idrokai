const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth, adminOnly, teacherOrAdmin, bumpTokenVersion } = require('../middleware/auth')

const ALLOWED_STATUSES = ['pending', 'approved', 'rejected']

const generateCourseId = () => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

router.post('/apply', auth, async (req, res) => {
  try {
    const { full_name, subject, experience } = req.body

    if (typeof full_name !== 'string' || typeof subject !== 'string' || typeof experience !== 'string') {
      return res.status(400).json({ message: 'Maydonlar to\'liq emas' })
    }
    const fn = full_name.trim()
    const sub = subject.trim()
    const exp = experience.trim()
    if (fn.length < 2 || fn.length > 100) return res.status(400).json({ message: 'Ism noto\'g\'ri' })
    if (sub.length < 2 || sub.length > 100) return res.status(400).json({ message: 'Fan noto\'g\'ri' })
    if (exp.length < 2 || exp.length > 1000) return res.status(400).json({ message: 'Tajriba noto\'g\'ri' })

    const user_id = req.user.id

    const existing = await pool.query(
      'SELECT 1 FROM teacher_requests WHERE user_id = $1 AND status = $2',
      [user_id, 'pending']
    )

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Arizangiz ko\'rib chiqilmoqda' })
    }

    await pool.query(
      'INSERT INTO teacher_requests (user_id, full_name, subject, experience) VALUES ($1, $2, $3, $4)',
      [user_id, fn, sub, exp]
    )

    res.json({ message: 'Ariza yuborildi!' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.get('/my-status', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT status FROM teacher_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    )
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    )
    res.json({
      status: result.rows[0]?.status || 'none',
      role: userResult.rows[0]?.role || 'student'
    })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.get('/requests', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tr.*, u.name, u.email
       FROM teacher_requests tr
       JOIN users u ON tr.user_id = u.id
       ORDER BY tr.created_at DESC`
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.put('/requests/:id', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Status noto\'g\'ri' })
    }

    const request = await pool.query(
      'SELECT user_id FROM teacher_requests WHERE id = $1',
      [req.params.id]
    )

    if (request.rows.length === 0) {
      return res.status(404).json({ message: 'Topilmadi' })
    }

    await pool.query(
      'UPDATE teacher_requests SET status = $1 WHERE id = $2',
      [status, req.params.id]
    )

    if (status === 'approved') {
      await pool.query(
        "UPDATE users SET role = 'teacher' WHERE id = $1 AND role != 'admin'",
        [request.rows[0].user_id]
      )
      await bumpTokenVersion(request.rows[0].user_id)
    } else if (status === 'rejected') {
      await pool.query(
        "UPDATE users SET role = 'student' WHERE id = $1 AND role != 'admin'",
        [request.rows[0].user_id]
      )
      await bumpTokenVersion(request.rows[0].user_id)
    }

    res.json({ message: status === 'approved' ? 'Tasdiqlandi!' : status === 'rejected' ? 'Rad etildi' : 'Saqlandi' })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/courses', auth, teacherOrAdmin, async (req, res) => {
  try {
    const { title, category, daraja, emoji, desc, about, lessons } = req.body
    if (typeof title !== 'string' || title.trim().length < 2) {
      return res.status(400).json({ message: 'Sarlavha kerak' })
    }
    const id = generateCourseId()

    await pool.query(
      `INSERT INTO courses (id, title, category, daraja, emoji, description, about, lessons, darslar, teacher_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
      [id, title.trim().slice(0, 200), category || 'Boshqa', daraja || 'Boshlovchi',
       emoji || '📚', String(desc || '').slice(0, 1000), String(about || '').slice(0, 5000),
       JSON.stringify(Array.isArray(lessons) ? lessons : []),
       Array.isArray(lessons) ? lessons.length : 0,
       req.user.id]
    )

    res.json({ message: 'Kurs qo\'shildi!', id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.get('/my-courses', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM courses WHERE teacher_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/save-course', auth, teacherOrAdmin, async (req, res) => {
  try {
    const { id, title, category, daraja, emoji, desc, about, lessons, darslar } = req.body
    if (typeof title !== 'string' || title.trim().length < 2) {
      return res.status(400).json({ message: 'Sarlavha kerak' })
    }

    const cleanLessons = JSON.stringify(Array.isArray(lessons) ? lessons : [])
    const lessonsCount = Number.isInteger(darslar) ? darslar : (Array.isArray(lessons) ? lessons.length : 0)

    if (id) {
      // Mavjud kurs — ownership tekshiruvi (admin'dan tashqari)
      const existing = await pool.query('SELECT teacher_id FROM courses WHERE id = $1', [String(id)])
      if (existing.rows.length > 0) {
        const owner = existing.rows[0].teacher_id
        if (req.user.role !== 'admin' && owner !== req.user.id) {
          return res.status(403).json({ message: 'Bu kurs sizniki emas' })
        }
        await pool.query(
          `UPDATE courses
           SET title = $1, category = $2, daraja = $3, emoji = $4,
               description = $5, about = $6, lessons = $7::jsonb, darslar = $8
           WHERE id = $9`,
          [
            title.trim().slice(0, 200),
            category || 'Boshqa',
            daraja || 'Boshlovchi',
            emoji || '📚',
            String(desc || '').slice(0, 1000),
            String(about || '').slice(0, 5000),
            cleanLessons,
            lessonsCount,
            String(id)
          ]
        )
        return res.json({ message: 'Kurs saqlandi!', id: String(id) })
      }
    }

    const newId = id ? String(id) : generateCourseId()
    await pool.query(
      `INSERT INTO courses (id, title, category, daraja, emoji, description, about, lessons, darslar, teacher_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
      [
        newId,
        title.trim().slice(0, 200),
        category || 'Boshqa',
        daraja || 'Boshlovchi',
        emoji || '📚',
        String(desc || '').slice(0, 1000),
        String(about || '').slice(0, 5000),
        cleanLessons,
        lessonsCount,
        req.user.id
      ]
    )

    res.json({ message: 'Kurs saqlandi!', id: newId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.get('/all-courses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        COUNT(DISTINCT e.user_id) as students_count
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `)
    const courses = result.rows.map(c => ({
      ...c,
      desc: c.description,
      image: c.image || '',
      lessons: c.lessons || [],
      students_count: parseInt(c.students_count) || 0
    }))
    res.json(courses)
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

module.exports = router
