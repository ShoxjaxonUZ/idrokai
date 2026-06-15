// Ijtimoiy o'rganish — do'stlar (study buddies) + faollik tasmasi.
// Do'stlik: friendships (requester_id, addressee_id, status pending|accepted).
// Faollik tasmasi MAVJUD jadvallardan yig'iladi (yangi yozuv shart emas).

const express = require('express')
const pool = require('../db')
const { auth } = require('../middleware/auth')
const notifications = require('../lib/notifications')

const router = express.Router()

// Ikki user orasidagi do'stlik qatori (har ikki yo'nalishda qidiriladi)
async function relation(meId, otherId) {
  const r = await pool.query(
    `SELECT * FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)
     LIMIT 1`,
    [meId, otherId]
  )
  return r.rows[0] || null
}

// GET /api/social/friends — do'stlar (stats bilan) + kelgan/yuborilgan so'rovlar
router.get('/friends', auth, async (req, res) => {
  try {
    const me = req.user.id
    const friends = await pool.query(`
      SELECT u.id, u.name,
        COALESCE(s.current_streak, 0) AS streak,
        COALESCE(s.total_points, 0) AS points,
        (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS courses,
        (SELECT COUNT(*) FROM certificates c WHERE c.user_id = u.id) AS certificates
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
      LEFT JOIN user_streaks s ON s.user_id = u.id
      WHERE f.status = 'accepted' AND $1 IN (f.requester_id, f.addressee_id)
      ORDER BY streak DESC, points DESC
    `, [me])

    const incoming = await pool.query(`
      SELECT u.id, u.name, f.created_at
      FROM friendships f JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [me])

    const outgoing = await pool.query(`
      SELECT u.id, u.name, f.created_at
      FROM friendships f JOIN users u ON u.id = f.addressee_id
      WHERE f.requester_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [me])

    res.json({ friends: friends.rows, incoming: incoming.rows, outgoing: outgoing.rows })
  } catch (err) {
    console.error('[social] friends error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// GET /api/social/suggestions — do'st bo'lmagan faol o'quvchilar
router.get('/suggestions', auth, async (req, res) => {
  try {
    const me = req.user.id
    const r = await pool.query(`
      SELECT u.id, u.name,
        COALESCE(s.current_streak, 0) AS streak,
        COALESCE(s.total_points, 0) AS points
      FROM users u
      LEFT JOIN user_streaks s ON s.user_id = u.id
      WHERE u.id <> $1
        AND u.role = 'student'
        AND NOT EXISTS (
          SELECT 1 FROM friendships f
          WHERE (f.requester_id = $1 AND f.addressee_id = u.id)
             OR (f.requester_id = u.id AND f.addressee_id = $1)
        )
      ORDER BY COALESCE(s.total_points, 0) DESC, COALESCE(s.current_streak, 0) DESC, u.created_at DESC
      LIMIT 8
    `, [me])
    res.json(r.rows)
  } catch (err) {
    console.error('[social] suggestions error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// GET /api/social/feed — do'stlarning so'nggi faolligi (mavjud jadvallardan)
router.get('/feed', auth, async (req, res) => {
  try {
    const me = req.user.id
    const r = await pool.query(`
      WITH friend_ids AS (
        SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS fid
        FROM friendships
        WHERE status = 'accepted' AND $1 IN (requester_id, addressee_id)
      )
      SELECT * FROM (
        SELECT c.user_id, u.name, 'certificate' AS type,
               c.course_title AS title, c.issued_at AS at
        FROM certificates c JOIN users u ON u.id = c.user_id
        WHERE c.user_id IN (SELECT fid FROM friend_ids)
        UNION ALL
        SELECT e.user_id, u.name, 'enroll' AS type,
               co.title AS title, e.created_at AS at
        FROM enrollments e JOIN users u ON u.id = e.user_id
        JOIN courses co ON co.id = e.course_id
        WHERE e.user_id IN (SELECT fid FROM friend_ids)
        UNION ALL
        SELECT mt.user_id, u.name, 'module_test' AS type,
               ('Modul test #' || (mt.module_index + 1)) AS title, mt.completed_at AS at
        FROM module_tests mt JOIN users u ON u.id = mt.user_id
        WHERE mt.passed = TRUE AND mt.completed_at IS NOT NULL
          AND mt.user_id IN (SELECT fid FROM friend_ids)
        UNION ALL
        SELECT d.user_id, u.name, 'daily' AS type,
               COALESCE(d.problem_title, 'Kunlik masala') AS title, d.completed_at AS at
        FROM daily_challenges d JOIN users u ON u.id = d.user_id
        WHERE d.status = 'completed' AND d.completed_at IS NOT NULL
          AND d.user_id IN (SELECT fid FROM friend_ids)
      ) feed
      WHERE at IS NOT NULL
      ORDER BY at DESC
      LIMIT 30
    `, [me])
    res.json(r.rows)
  } catch (err) {
    console.error('[social] feed error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST /api/social/request/:userId — do'stlik so'rovi yuborish
router.post('/request/:userId', auth, async (req, res) => {
  try {
    const me = req.user.id
    const other = parseInt(req.params.userId, 10)
    if (!Number.isInteger(other) || other === me) {
      return res.status(400).json({ message: "Noto'g'ri foydalanuvchi" })
    }
    const target = await pool.query('SELECT id, name FROM users WHERE id = $1', [other])
    if (target.rows.length === 0) {
      return res.status(404).json({ message: 'Foydalanuvchi topilmadi' })
    }

    const existing = await relation(me, other)
    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(409).json({ message: "Allaqachon do'stsiz" })
      }
      // U menga so'rov yuborgan bo'lsa — avtomatik qabul qilamiz
      if (existing.addressee_id === me) {
        await pool.query("UPDATE friendships SET status = 'accepted', updated_at = NOW() WHERE id = $1", [existing.id])
        notifications.notify(other, 'system', "Do'stlik qabul qilindi",
          `${req.user.name || 'Foydalanuvchi'} bilan endi do'stsiz`, '/friends', 'users').catch(() => {})
        return res.json({ ok: true, status: 'accepted' })
      }
      return res.status(409).json({ message: "So'rov allaqachon yuborilgan" })
    }

    await pool.query(
      "INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')",
      [me, other]
    )
    notifications.notify(other, 'system', "Yangi do'stlik so'rovi",
      `${req.user.name || 'Foydalanuvchi'} sizni do'st qo'shmoqchi`, '/friends', 'users').catch(() => {})
    res.json({ ok: true, status: 'pending' })
  } catch (err) {
    console.error('[social] request error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// POST /api/social/accept/:userId — kelgan so'rovni qabul qilish
router.post('/accept/:userId', auth, async (req, res) => {
  try {
    const me = req.user.id
    const other = parseInt(req.params.userId, 10)
    if (!Number.isInteger(other)) return res.status(400).json({ message: "Noto'g'ri foydalanuvchi" })
    const r = await pool.query(
      `UPDATE friendships SET status = 'accepted', updated_at = NOW()
       WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
       RETURNING id`,
      [other, me]
    )
    if (r.rows.length === 0) return res.status(404).json({ message: "So'rov topilmadi" })
    notifications.notify(other, 'system', "Do'stlik qabul qilindi",
      `${req.user.name || 'Foydalanuvchi'} so'rovingizni qabul qildi`, '/friends', 'users').catch(() => {})
    res.json({ ok: true })
  } catch (err) {
    console.error('[social] accept error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

// DELETE /api/social/:userId — do'stlikni o'chirish / so'rovni bekor qilish yoki rad etish
router.delete('/:userId', auth, async (req, res) => {
  try {
    const me = req.user.id
    const other = parseInt(req.params.userId, 10)
    if (!Number.isInteger(other)) return res.status(400).json({ message: "Noto'g'ri foydalanuvchi" })
    await pool.query(
      `DELETE FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [me, other]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[social] delete error:', err.message)
    res.status(500).json({ message: 'Server xatosi' })
  }
})

module.exports = router
