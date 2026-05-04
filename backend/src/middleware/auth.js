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

  // Token versiyasini tekshirish — DB'dagi joriy versiya bilan moslik
  // (parol o'zgarganda yoki rol o'zgarganda eski tokenlar bekor qilinadi)
  try {
    const r = await pool.query('SELECT id, token_version FROM users WHERE id = $1', [decoded.id])
    if (r.rows.length === 0) {
      return res.status(401).json({ message: 'Foydalanuvchi topilmadi' })
    }
    const dbVersion = r.rows[0].token_version || 0
    const tokenVersion = decoded.tv || 0
    if (dbVersion !== tokenVersion) {
      return res.status(401).json({ message: 'Sessiya tugagan, qayta kiring' })
    }
    req.user = decoded
    next()
  } catch (err) {
    console.error('Auth DB error:', err.message)
    return res.status(500).json({ message: 'Auth tekshiruvida xato' })
  }
}

const requireRole = (...roles) => async (req, res, next) => {
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id])
    const role = result.rows[0]?.role || 'student'
    req.user.role = role
    if (!roles.includes(role)) {
      return res.status(403).json({ message: 'Ruxsat yo\'q' })
    }
    next()
  } catch (err) {
    res.status(500).json({ message: 'Auth tekshiruvida xato' })
  }
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
