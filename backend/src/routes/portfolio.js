// Natija halqasi — ulashiladigan portfel (profil + loyihalar + avtomatik yutuqlar).
// Yutuqlar (sertifikat, kurs, streak, reyting) MAVJUD jadvallardan yig'iladi.

const express = require('express')
const pool = require('../db')
const { auth } = require('../middleware/auth')

const router = express.Router()

// Faqat http(s) URL — javascript:/data: kabilarni rad etamiz
const httpUrl = (s) => {
  const v = String(s || '').trim()
  if (!v || v.length > 500) return null
  return /^https?:\/\//i.test(v) ? v : null
}

// Bitta foydalanuvchi portfeli (profil + loyihalar + yutuqlar)
async function buildPortfolio(userId) {
  const u = await pool.query('SELECT id, name FROM users WHERE id = $1', [userId])
  if (u.rows.length === 0) return null

  const [p, projects, certs, streak, rating, courses] = await Promise.all([
    pool.query('SELECT headline, bio, github_url, telegram_url, looking_for_work FROM portfolios WHERE user_id = $1', [userId]),
    pool.query('SELECT id, title, description, url, tech, created_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    pool.query('SELECT course_title, cert_code, issued_at FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC', [userId]),
    pool.query('SELECT current_streak, longest_streak, total_points FROM user_streaks WHERE user_id = $1', [userId]),
    pool.query('SELECT points, wins FROM ratings WHERE user_id = $1', [userId]),
    pool.query('SELECT COUNT(*)::int AS n FROM enrollments WHERE user_id = $1', [userId])
  ])

  const s = streak.rows[0] || {}
  const r = rating.rows[0] || {}
  return {
    user: u.rows[0],
    portfolio: p.rows[0] || { headline: '', bio: '', github_url: '', telegram_url: '', looking_for_work: false },
    projects: projects.rows,
    certificates: certs.rows,
    stats: {
      certificates: certs.rows.length,
      courses: courses.rows[0].n,
      streak: s.current_streak || 0,
      longest_streak: s.longest_streak || 0,
      points: s.total_points || 0,
      battle_rating: r.points || 0,
      wins: r.wins || 0
    }
  }
}

// GET /api/portfolio/me — o'z portfelim (tahrirlash uchun)
router.get('/me', auth, async (req, res) => {
  try {
    res.json(await buildPortfolio(req.user.id))
  } catch (err) {
    console.error('[portfolio] me error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// PUT /api/portfolio/me — profil maydonlari
router.put('/me', auth, async (req, res) => {
  try {
    const { headline, bio, github_url, telegram_url, looking_for_work } = req.body || {}
    await pool.query(`
      INSERT INTO portfolios (user_id, headline, bio, github_url, telegram_url, looking_for_work, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        headline = EXCLUDED.headline,
        bio = EXCLUDED.bio,
        github_url = EXCLUDED.github_url,
        telegram_url = EXCLUDED.telegram_url,
        looking_for_work = EXCLUDED.looking_for_work,
        updated_at = NOW()
    `, [
      req.user.id,
      String(headline || '').slice(0, 120),
      String(bio || '').slice(0, 600),
      httpUrl(github_url),
      httpUrl(telegram_url),
      !!looking_for_work
    ])
    res.json({ ok: true })
  } catch (err) {
    console.error('[portfolio] put me error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST /api/portfolio/projects — yangi loyiha
router.post('/projects', auth, async (req, res) => {
  try {
    const { title, description, url, tech } = req.body || {}
    const t = String(title || '').trim()
    if (t.length < 2 || t.length > 120) {
      return res.status(400).json({ message: "Sarlavha 2–120 belgi bo'lishi kerak" })
    }
    const cnt = await pool.query('SELECT COUNT(*)::int AS n FROM projects WHERE user_id = $1', [req.user.id])
    if (cnt.rows[0].n >= 30) {
      return res.status(400).json({ message: "Loyihalar limiti (30) to'ldi" })
    }
    const r = await pool.query(
      'INSERT INTO projects (user_id, title, description, url, tech) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
      [req.user.id, t, String(description || '').slice(0, 800), httpUrl(url), String(tech || '').slice(0, 120)]
    )
    res.json({ ok: true, id: r.rows[0].id, created_at: r.rows[0].created_at })
  } catch (err) {
    console.error('[portfolio] post project error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// PUT /api/portfolio/projects/:id — loyihani tahrirlash
router.put('/projects/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Noto'g'ri id" })
    const { title, description, url, tech } = req.body || {}
    const t = String(title || '').trim()
    if (t.length < 2 || t.length > 120) {
      return res.status(400).json({ message: "Sarlavha 2–120 belgi bo'lishi kerak" })
    }
    const r = await pool.query(
      'UPDATE projects SET title = $1, description = $2, url = $3, tech = $4 WHERE id = $5 AND user_id = $6 RETURNING id',
      [t, String(description || '').slice(0, 800), httpUrl(url), String(tech || '').slice(0, 120), id, req.user.id]
    )
    if (r.rows.length === 0) return res.status(404).json({ message: 'Loyiha topilmadi' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[portfolio] put project error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// DELETE /api/portfolio/projects/:id
router.delete('/projects/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Noto'g'ri id" })
    await pool.query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [id, req.user.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('[portfolio] delete project error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// GET /api/portfolio/:userId — ommaviy portfel (ulashish uchun). ENG OXIRIDA.
router.get('/:userId', async (req, res) => {
  try {
    const id = parseInt(req.params.userId, 10)
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Noto'g'ri foydalanuvchi" })
    const data = await buildPortfolio(id)
    if (!data) return res.status(404).json({ message: 'Portfel topilmadi' })
    res.json(data)
  } catch (err) {
    console.error('[portfolio] public error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
