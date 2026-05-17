const jwt = require('jsonwebtoken')
const pool = require('../db')

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET kuchli (>=32 belgi) bo\'lishi shart')
}

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'Token yo\'q' })

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: '7d'
    })
  } catch {
    return res.status(401).json({ message: 'Token noto\'g\'ri yoki muddati o\'tgan' })
  }

  // jti yo'q — eski (sessiyasiz) token. Qurilma boshqaruvi joriy etilgach
  // bunday tokenlar kuchsiz: foydalanuvchi qayta kirishi kerak.
  if (!decoded.jti) {
    return res.status(401).json({ message: 'Sessiya tugagan, qayta kiring' })
  }

  // Token versiyasi + role + sessiya mavjudligi — bitta query'da.
  try {
    const r = await pool.query(
      `SELECT u.token_version, u.role,
              EXISTS(
                SELECT 1 FROM user_sessions s
                WHERE s.id = $2 AND s.user_id = u.id
              ) AS session_ok
       FROM users u WHERE u.id = $1`,
      [decoded.id, decoded.jti]
    )
    if (r.rows.length === 0) {
      return res.status(401).json({ message: 'Foydalanuvchi topilmadi' })
    }
    const row = r.rows[0]
    const dbVersion = row.token_version || 0
    const tokenVersion = decoded.tv || 0
    if (dbVersion !== tokenVersion) {
      return res.status(401).json({ message: 'Sessiya tugagan, qayta kiring' })
    }
    // Sessiya o'chirilgan — bu qurilma boshqa qurilmadan chiqarib yuborilgan.
    if (!row.session_ok) {
      return res.status(401).json({ message: 'Bu qurilma boshqa joydan chiqarib yuborilgan. Qayta kiring.' })
    }
    // Oxirgi faollik vaqti — har so'rovda emas, 5 daqiqada bir marta (yuk kam).
    pool.query(
      "UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1 AND last_active_at < NOW() - INTERVAL '5 minutes'",
      [decoded.jti]
    ).catch(() => {})
    req.user = { ...decoded, role: row.role || 'student' }
    next()
  } catch (err) {
    console.error('Auth DB error:', err.message)
    return res.status(500).json({ message: 'Auth tekshiruvida xato' })
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Ruxsat yo\'q' })
  }
  next()
}

const adminOnly = requireRole('admin')
const teacherOrAdmin = requireRole('teacher', 'admin')

// Token versiyasini ko'tarish (rol o'zgarganda chaqiriladi)
const bumpTokenVersion = async (userId) => {
  await pool.query(
    'UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1',
    [userId]
  )
}

module.exports = { auth, requireRole, adminOnly, teacherOrAdmin, bumpTokenVersion }
