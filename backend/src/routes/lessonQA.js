// Dars Q&A — har dars uchun student savol berib, boshqalar javob berishi mumkin
const express = require('express')
const pool = require('../db')
const { auth } = require('../middleware/auth')
const notifications = require('../lib/notifications')

const router = express.Router()

// GET /api/lesson-qa/:courseId/:lessonIndex — barcha savollar
router.get('/:courseId/:lessonIndex(\\d+)', async (req, res) => {
  try {
    const { courseId, lessonIndex } = req.params
    const idx = parseInt(lessonIndex, 10)
    if (!Number.isInteger(idx) || idx < 0 || idx > 9999) {
      return res.status(400).json({ message: "Lesson index noto'g'ri" })
    }
    const userId = req.headers.authorization
      ? (() => {
          try {
            const jwt = require('jsonwebtoken')
            const tok = req.headers.authorization.split(' ')[1]
            const d = jwt.verify(tok, process.env.JWT_SECRET, { algorithms: ['HS256'], maxAge: '7d' })
            return d.id
          } catch { return null }
        })()
      : null

    const result = await pool.query(`
      SELECT q.id, q.question, q.answer, q.answered_at, q.upvotes, q.status, q.created_at,
             u.name AS user_name, u.id AS user_id,
             au.name AS answered_by_name,
             au.role AS answered_by_role,
             CASE WHEN $3::int IS NULL THEN false
                  ELSE EXISTS (
                    SELECT 1 FROM lesson_question_votes v
                    WHERE v.question_id = q.id AND v.user_id = $3
                  )
             END AS my_vote
      FROM lesson_questions q
      JOIN users u ON u.id = q.user_id
      LEFT JOIN users au ON au.id = q.answered_by
      WHERE q.course_id = $1 AND q.lesson_index = $2
      ORDER BY
        CASE WHEN q.answer IS NOT NULL THEN 1 ELSE 0 END DESC,
        q.upvotes DESC,
        q.created_at DESC
      LIMIT 100
    `, [courseId, idx, userId])

    res.json(result.rows)
  } catch (err) {
    console.error('[lesson-qa] get error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST — yangi savol berish
router.post('/:courseId/:lessonIndex(\\d+)', auth, async (req, res) => {
  try {
    const { courseId, lessonIndex } = req.params
    const idx = parseInt(lessonIndex, 10)
    if (!Number.isInteger(idx) || idx < 0 || idx > 9999) {
      return res.status(400).json({ message: "Lesson index noto'g'ri" })
    }
    const { question } = req.body || {}

    const cleanQ = String(question || '').trim()
    if (cleanQ.length < 5 || cleanQ.length > 1000) {
      return res.status(400).json({ message: "Savol 5-1000 belgi bo'lishi kerak" })
    }

    const result = await pool.query(`
      INSERT INTO lesson_questions (user_id, course_id, lesson_index, question)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at
    `, [req.user.id, courseId, idx, cleanQ])

    res.json({ ok: true, id: result.rows[0].id })
  } catch (err) {
    console.error('[lesson-qa] post error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST /api/lesson-qa/:id/answer — javob yozish (admin/teacher yoki boshqa student)
router.post('/:id/answer', auth, async (req, res) => {
  try {
    const { id } = req.params
    const { answer } = req.body || {}

    const cleanA = String(answer || '').trim()
    if (cleanA.length < 5 || cleanA.length > 2000) {
      return res.status(400).json({ message: "Javob 5-2000 belgi bo'lishi kerak" })
    }

    // Faqat teacher/admin yoki kursga yozilgan student javob bera oladi
    const q = await pool.query('SELECT user_id, course_id, lesson_index FROM lesson_questions WHERE id = $1', [id])
    if (q.rows.length === 0) {
      return res.status(404).json({ message: 'Savol topilmadi' })
    }
    const ques = q.rows[0]

    const canAnswer = req.user.role === 'admin' || req.user.role === 'teacher' ||
      (await pool.query('SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [req.user.id, ques.course_id])).rows.length > 0

    if (!canAnswer) {
      return res.status(403).json({ message: 'Faqat kursga yozilganlar javob bera oladi' })
    }

    await pool.query(`
      UPDATE lesson_questions
      SET answer = $1, answered_by = $2, answered_at = NOW(), status = 'answered'
      WHERE id = $3
    `, [cleanA, req.user.id, id])

    // Notification — savol bergan studentga
    if (ques.user_id !== req.user.id) {
      const answererName = req.user.name || (req.user.role === 'admin' ? 'Admin' : 'Foydalanuvchi')
      notifications.notify(
        ques.user_id,
        'system',
        `Savolingizga javob berildi`,
        `${answererName}: ${cleanA.slice(0, 150)}${cleanA.length > 150 ? '...' : ''}`,
        `/courses/${ques.course_id}/lessons/${ques.lesson_index}`,
        'mail'
      ).catch(() => {})
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[lesson-qa] answer error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST /api/lesson-qa/:id/upvote — like/unlike
router.post('/:id/upvote', auth, async (req, res) => {
  try {
    const { id } = req.params

    // Toggle: agar mavjud bo'lsa o'chirish, yo'q bo'lsa qo'shish
    const existing = await pool.query(
      'SELECT 1 FROM lesson_question_votes WHERE question_id = $1 AND user_id = $2',
      [id, req.user.id]
    )

    if (existing.rows.length > 0) {
      await pool.query(
        'DELETE FROM lesson_question_votes WHERE question_id = $1 AND user_id = $2',
        [id, req.user.id]
      )
      await pool.query(
        'UPDATE lesson_questions SET upvotes = GREATEST(0, upvotes - 1) WHERE id = $1',
        [id]
      )
      return res.json({ ok: true, voted: false })
    } else {
      await pool.query(
        'INSERT INTO lesson_question_votes (question_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, req.user.id]
      )
      await pool.query(
        'UPDATE lesson_questions SET upvotes = upvotes + 1 WHERE id = $1',
        [id]
      )
      return res.json({ ok: true, voted: true })
    }
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// DELETE — o'z savolini o'chirish
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(
      'DELETE FROM lesson_questions WHERE id = $1 AND (user_id = $2 OR $3 = $4) RETURNING id',
      [id, req.user.id, req.user.role, 'admin']
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Topilmadi yoki ruxsat yo\'q' })
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
