const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth, adminOnly } = require('../middleware/auth')
const { getPlan } = require('../lib/plans')

// STATS
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const usersRes = await pool.query("SELECT COUNT(*) FROM users WHERE role != 'admin'")
    const coursesRes = await pool.query('SELECT COUNT(*) FROM courses')
    const enrollmentsRes = await pool.query('SELECT COUNT(*) FROM enrollments')

    res.json({
      users: parseInt(usersRes.rows[0].count) || 0,
      courses: parseInt(coursesRes.rows[0].count) || 0,
      enrollments: parseInt(enrollmentsRes.rows[0].count) || 0
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// USERS
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// REPORTS — kurslar bo'yicha ro'yxatdan o'tish + kurs egasiga to'lov hisoboti.
// ?month=YYYY-MM (default joriy oy). Har kurs uchun: jami va shu oydagi o'quvchilar,
// faol/tugatgan, va narx × o'quvchi = to'lanadigan summa. Kurs egasi bo'yicha
// jamlanma ham qaytariladi (kimga qancha to'lash).
router.get('/reports/courses', auth, adminOnly, async (req, res) => {
  try {
    const monthParam = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : new Date().toISOString().slice(0, 7)
    const start = `${monthParam}-01`
    const [y, m] = monthParam.split('-').map(Number)
    const nextMonth = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`

    const result = await pool.query(
      `SELECT c.id AS course_id, c.title,
              COALESCE(c.price, 0)::float AS price,
              c.teacher_id,
              u.name AS owner_name, u.email AS owner_email,
              COUNT(e.id) AS total_students,
              COUNT(e.id) FILTER (WHERE e.created_at >= $1 AND e.created_at < $2) AS month_students,
              COUNT(e.id) FILTER (WHERE e.progress > 0) AS active_students,
              COUNT(e.id) FILTER (WHERE e.progress = 100) AS completed_students
       FROM courses c
       LEFT JOIN users u ON u.id = c.teacher_id
       LEFT JOIN enrollments e ON e.course_id = c.id
       GROUP BY c.id, c.title, c.price, c.teacher_id, u.name, u.email
       ORDER BY month_students DESC, total_students DESC`,
      [start, nextMonth]
    )

    const courses = result.rows.map(r => {
      const price = Number(r.price) || 0
      const total = parseInt(r.total_students) || 0
      const month = parseInt(r.month_students) || 0
      return {
        courseId: r.course_id,
        title: r.title,
        price,
        ownerId: r.teacher_id,
        ownerName: r.owner_name || null,
        ownerEmail: r.owner_email || null,
        totalStudents: total,
        monthStudents: month,
        activeStudents: parseInt(r.active_students) || 0,
        completedStudents: parseInt(r.completed_students) || 0,
        monthAmount: month * price,
        totalAmount: total * price
      }
    })

    // Kurs egasi bo'yicha jamlanma — kimga qancha to'lash kerakligi
    const ownerMap = new Map()
    for (const c of courses) {
      const key = c.ownerId == null ? 'platform' : c.ownerId
      if (!ownerMap.has(key)) {
        ownerMap.set(key, {
          ownerId: c.ownerId,
          ownerName: c.ownerName || (c.ownerId != null ? `#${c.ownerId}` : "Platforma (egasiz)"),
          ownerEmail: c.ownerEmail || null,
          courses: 0, monthStudents: 0, totalStudents: 0, monthAmount: 0, totalAmount: 0
        })
      }
      const o = ownerMap.get(key)
      o.courses += 1
      o.monthStudents += c.monthStudents
      o.totalStudents += c.totalStudents
      o.monthAmount += c.monthAmount
      o.totalAmount += c.totalAmount
    }
    const owners = [...ownerMap.values()].sort((a, b) => b.monthAmount - a.monthAmount)

    const totals = courses.reduce((acc, c) => {
      acc.monthStudents += c.monthStudents
      acc.totalStudents += c.totalStudents
      acc.monthAmount += c.monthAmount
      acc.totalAmount += c.totalAmount
      return acc
    }, { courses: courses.length, monthStudents: 0, totalStudents: 0, monthAmount: 0, totalAmount: 0 })

    res.json({ month: monthParam, courses, owners, totals })
  } catch (err) {
    console.error('[admin reports]', err.message)
    res.status(500).json({ message: 'Hisobot xatosi' })
  }
})

// ====== OBUNALAR (admin qo'lda boshqaradi — to'lov hozircha yo'q) ======

// Faol obunalar ro'yxati
router.get('/subscriptions', auth, adminOnly, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT s.id, s.plan, s.months, s.price, s.status,
              s.started_at, s.expires_at,
              u.id AS user_id, u.name AS user_name, u.email AS user_email
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       WHERE s.status = 'active' AND s.expires_at > NOW()
       ORDER BY s.expires_at DESC`
    )
    res.json(r.rows)
  } catch (err) {
    console.error('[admin subscriptions list]', err.message)
    res.status(500).json({ message: 'Xatolik' })
  }
})

// Obunani faollashtirish — {email, plan}. Mavjud faol obuna bo'lsa, muddati
// uzaytiriladi (joriy tugash sanasidan boshlab).
router.post('/subscriptions', auth, adminOnly, async (req, res) => {
  try {
    const { email, plan: planId } = req.body || {}
    const plan = getPlan(planId)
    if (!plan) return res.status(400).json({ message: 'Tarif noto\'g\'ri' })
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ message: 'Email kiriting' })
    }

    const userRes = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]
    )
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Bunday foydalanuvchi topilmadi' })
    }
    const userId = userRes.rows[0].id

    // Mavjud faol obuna — yangi muddat uning tugashidan boshlanadi (uzaytirish)
    const activeRes = await pool.query(
      `SELECT id, expires_at FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 1`,
      [userId]
    )
    const base = activeRes.rows[0] ? new Date(activeRes.rows[0].expires_at) : new Date()
    const expires = new Date(base)
    expires.setMonth(expires.getMonth() + plan.months)

    // Eski faol obunani 'cancelled' qilamiz (bittasi faol qolsin), yangisini ochamiz
    if (activeRes.rows[0]) {
      await pool.query(
        "UPDATE subscriptions SET status = 'cancelled' WHERE id = $1",
        [activeRes.rows[0].id]
      )
    }

    const ins = await pool.query(
      `INSERT INTO subscriptions (user_id, plan, months, price, status, started_at, expires_at, activated_by)
       VALUES ($1, $2, $3, $4, 'active', NOW(), $5, $6)
       RETURNING id, expires_at`,
      [userId, plan.id, plan.months, plan.price, expires.toISOString(), req.user.id]
    )

    res.json({ message: 'Obuna faollashtirildi', id: ins.rows[0].id, expiresAt: ins.rows[0].expires_at })
  } catch (err) {
    console.error('[admin subscriptions activate]', err.message)
    res.status(500).json({ message: 'Xatolik' })
  }
})

// Obunani bekor qilish
router.delete('/subscriptions/:id', auth, adminOnly, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE subscriptions SET status = 'cancelled' WHERE id = $1 RETURNING id",
      [req.params.id]
    )
    if (r.rows.length === 0) return res.status(404).json({ message: 'Topilmadi' })
    res.json({ message: 'Obuna bekor qilindi' })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

// CREATE / UPDATE COURSE
router.post('/courses', auth, adminOnly, async (req, res) => {
  try {
    const {
      id, title, category, daraja, description, about,
      image, lessons, darslar, price
    } = req.body

    if (!id || !title) {
      return res.status(400).json({ message: 'ID va sarlavha to\'ldirilishi kerak' })
    }

    // Narx — manfiy bo'lmagan son (so'm). Noto'g'ri qiymat 0 ga tushadi.
    const safePrice = Math.max(0, Number(price) || 0)

    const existing = await pool.query('SELECT id FROM courses WHERE id = $1', [id])
    const lessonsJson = JSON.stringify(lessons || [])

    if (existing.rows.length > 0) {
      await pool.query(`
        UPDATE courses
        SET title = $1, category = $2, daraja = $3, description = $4,
            about = $5, image = $6, lessons = $7::jsonb, darslar = $8, price = $9
        WHERE id = $10
      `, [
        title,
        category || 'Dasturlash',
        daraja || 'Boshlang\'ich',
        description || '',
        about || '',
        image || '',
        lessonsJson,
        darslar || (lessons?.length || 0),
        safePrice,
        id
      ])
      res.json({ message: 'Kurs yangilandi', id })
    } else {
      await pool.query(`
        INSERT INTO courses (id, title, category, daraja, description, about, image, lessons, darslar, price, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, NOW())
      `, [
        id,
        title,
        category || 'Dasturlash',
        daraja || 'Boshlang\'ich',
        description || '',
        about || '',
        image || '',
        lessonsJson,
        darslar || (lessons?.length || 0),
        safePrice
      ])
      res.json({ message: 'Kurs yaratildi', id })
    }
  } catch (err) {
    console.error('Course save error:', err)
    res.status(500).json({ message: err.message })
  }
})

// DELETE COURSE
router.delete('/courses/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM courses WHERE id = $1', [req.params.id])
    res.json({ message: 'Kurs o\'chirildi' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
