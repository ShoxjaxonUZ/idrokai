// Dashboard tavsiyalari — "Bugun nimani boshlaysiz?" widgeti uchun.
// Hamma signal (kunlik, kurslar progress, sertifikat eligibility, streak)
// BITTA so'rovda hisoblanadi (avval har kurs uchun alohida API edi — N+1).
// Har tavsiyaga ball beriladi, eng yuqori 4 tasi qaytariladi.

const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth } = require('../middleware/auth')

router.get('/recommendations', auth, async (req, res) => {
  try {
    const userId = req.user.id

    // Barcha ma'lumot parallel (bitta yo'l-yo'lakay)
    const [enrollRes, testsRes, certsRes, dailyRes, streakRes] = await Promise.all([
      pool.query(
        `SELECT e.course_id, e.progress, c.title,
                CASE WHEN jsonb_typeof(c.lessons) = 'array'
                     THEN jsonb_array_length(c.lessons) ELSE 0 END AS lessons_count
         FROM enrollments e JOIN courses c ON c.id = e.course_id
         WHERE e.user_id = $1`, [userId]),
      pool.query(
        `SELECT course_id, module_index FROM module_tests
         WHERE user_id = $1 AND passed = TRUE`, [userId]),
      pool.query(`SELECT course_id FROM certificates WHERE user_id = $1`, [userId]),
      pool.query(
        `SELECT status FROM daily_challenges
         WHERE user_id = $1 AND challenge_date = CURRENT_DATE`, [userId]),
      pool.query(`SELECT current_streak FROM user_streaks WHERE user_id = $1`, [userId])
    ])

    const courses = enrollRes.rows
    const issued = new Set(certsRes.rows.map(r => String(r.course_id)))
    const dailyDone = dailyRes.rows[0]?.status === 'completed'
    const streak = streakRes.rows[0]?.current_streak || 0

    // Har kurs bo'yicha topshirilgan modullar
    const passedByCourse = {}
    for (const r of testsRes.rows) {
      const cid = String(r.course_id)
      if (!passedByCourse[cid]) passedByCourse[cid] = new Set()
      passedByCourse[cid].add(r.module_index)
    }

    // Per-course eligibility + jarayondagi kurslar
    const certEligible = []
    const inProgress = []
    for (const c of courses) {
      const total = c.lessons_count || 0
      const totalModules = Math.ceil(total / 5)
      const passed = passedByCourse[String(c.course_id)] || new Set()
      let allPassed = totalModules > 0
      for (let i = 0; i < totalModules; i++) {
        if (!passed.has(i)) { allPassed = false; break }
      }
      if (allPassed && total > 0) certEligible.push(String(c.course_id))
      if (c.progress > 0 && c.progress < 100) inProgress.push(c)
    }
    inProgress.sort((a, b) => b.progress - a.progress)

    // Ballash — eng dolzarbi yuqori ballga ega
    const recs = []

    const certReady = certEligible.find(cid => !issued.has(cid))
    if (certReady) {
      const c = courses.find(x => String(x.course_id) === certReady)
      recs.push({ score: 95, key: 'cert', icon: 'award', tone: 'warning',
        title: 'Sertifikatingiz tayyor!',
        desc: `${c?.title || 'Kurs'} — sertifikatni oling`,
        btnLabel: 'Olish', route: `/certificate/${certReady}` })
    }
    if (!dailyDone) {
      recs.push({ score: 90, key: 'daily', icon: 'target', tone: 'warning',
        title: 'Bugungi masalani yeching',
        desc: streak > 0 ? `${streak} kunlik streak'ingizni saqlang!` : "Streak'ingizni boshlang — 5-10 daqiqa",
        btnLabel: 'Boshlash', route: '/daily' })
    }
    if (courses.length === 0) {
      recs.push({ score: 85, key: 'start', icon: 'book', tone: 'secondary',
        title: 'Birinchi kursingizni tanlang',
        desc: "Bizda bepul kurslar bor — o'zingizga mosini boshlang",
        btnLabel: 'Kurslar', route: '/courses' })
    }
    if (inProgress[0]) {
      const c = inProgress[0]
      recs.push({ score: 80 + c.progress / 10, key: 'continue', icon: 'play', tone: 'primary',
        title: `Davom ettiring: ${c.title}`,
        desc: `${c.progress}% bajarildi — qolgan darslarni yakunlang`,
        btnLabel: 'Davom etish', route: `/courses/${c.course_id}` })
    }
    // To'ldiruvchilar (har doim mavjud, past ball)
    recs.push({ score: 40, key: 'ai', icon: 'bot', tone: 'info',
      title: 'AI Teacher bilan suhbat',
      desc: '4 sohada professional yordam — kuniga 20 ta savol',
      btnLabel: 'Boshlash', route: '/ai-teacher' })
    recs.push({ score: 35, key: 'battle', icon: 'swords', tone: 'primary',
      title: 'Code Battle',
      desc: 'Boshqalar bilan real vaqtda kod musobaqasi',
      btnLabel: "O'ynash", route: '/battle' })

    recs.sort((a, b) => b.score - a.score)
    const recommendations = recs.slice(0, 4).map(({ score, ...rest }) => rest)

    res.json({ recommendations, certEligibleCourseIds: certEligible })
  } catch (err) {
    console.error('[dashboard recommendations]', err.message)
    res.status(500).json({ message: 'Xatolik' })
  }
})

module.exports = router
