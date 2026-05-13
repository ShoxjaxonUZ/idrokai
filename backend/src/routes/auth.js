const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const pool = require('../db')
const { auth: authMiddleware } = require('../middleware/auth')
const { validatePassword, loginLimiter } = require('../middleware/security')
const { logFailedLogin } = require('../middleware/threatDetector')
const { isDisposable, looksFake } = require('../lib/disposableDomains')
const email = require('../lib/email')
const telegram = require('../lib/telegram')

// 6 raqamli tasdiqlash kodini generatsiya qilish
const generate6DigitCode = () => String(Math.floor(100000 + Math.random() * 900000))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN_TTL = '7d'
const VERIFY_TOKEN_TTL_HOURS = 24
const RESEND_COOLDOWN_SECONDS = 60

const NAME_BLOCK_RE = /[<>"'`{};|&$\\]|javascript:|onerror|onclick|onload|<script|\/etc\/|\.\.\//i

const validateName = (name) => {
  if (typeof name !== 'string') return 'Ism noto\'g\'ri'
  const t = name.trim()
  if (t.length < 2 || t.length > 50) return 'Ism 2-50 belgi bo\'lishi kerak'
  if (NAME_BLOCK_RE.test(t)) return 'Ismda taqiqlangan belgilar bor'
  return null
}

const validateEmail = (raw) => {
  if (typeof raw !== 'string') return { error: 'Email noto\'g\'ri' }
  const trimmed = raw.trim().toLowerCase()
  if (!EMAIL_RE.test(trimmed) || trimmed.length > 100) {
    return { error: 'Email noto\'g\'ri formatda' }
  }
  if (isDisposable(trimmed)) {
    return { error: 'Vaqtinchalik (disposable) email manzillariga ruxsat berilmaydi. Haqiqiy emaildan foydalaning.' }
  }
  if (looksFake(trimmed)) {
    return { error: 'Bu email soxta ko\'rinadi. Haqiqiy email manzilini kiriting.' }
  }
  return { ok: trimmed }
}

const generateVerificationToken = () => crypto.randomBytes(32).toString('hex')

const signToken = (user) => jwt.sign(
  { id: user.id, email: user.email, tv: user.token_version || 0 },
  process.env.JWT_SECRET,
  { expiresIn: TOKEN_TTL }
)

router.post('/register', async (req, res) => {
  try {
    const { name, email: rawEmail, password, telegram_chat_id } = req.body

    if (typeof name !== 'string' || typeof rawEmail !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Maydonlar to\'liq emas' })
    }
    const nameErr = validateName(name)
    if (nameErr) return res.status(400).json({ message: nameErr })
    const trimmedName = name.trim()

    const emailRes = validateEmail(rawEmail)
    if (emailRes.error) return res.status(400).json({ message: emailRes.error })
    const trimmedEmail = emailRes.ok

    const pwdErr = validatePassword(password)
    if (pwdErr) return res.status(400).json({ message: pwdErr })

    if (trimmedEmail === (process.env.ADMIN_EMAIL || '').toLowerCase()) {
      return res.status(400).json({ message: 'Bu email taqiqlangan' })
    }

    // Telegram chat_id — string, faqat raqamlardan (Telegram chat ID minus bo'lishi mumkin)
    const chatId = typeof telegram_chat_id === 'string' || typeof telegram_chat_id === 'number'
      ? String(telegram_chat_id).trim()
      : ''
    if (!chatId || !/^-?\d{5,20}$/.test(chatId)) {
      return res.status(400).json({ message: 'Telegram chat ID noto\'g\'ri (faqat raqam, 5-20 belgi)' })
    }

    const exists = await pool.query(
      'SELECT id FROM users WHERE email = $1', [trimmedEmail]
    )
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'Bu email allaqachon mavjud' })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    // verification_token endi 6 raqamli kod
    const code = generate6DigitCode()
    // Kod 15 daqiqa amal qiladi
    const expires = new Date(Date.now() + 15 * 60 * 1000)

    // Avval Telegram'ga kod yuborib ko'ramiz — agar chat_id noto'g'ri bo'lsa, user'ni
    // umuman yaratmaymiz (lekin chat_id allaqachon mavjud bo'lsa qayta yaratish)
    const tgResult = await telegram.sendVerificationCode(chatId, trimmedName, code)
    if (!tgResult.ok) {
      const reason = tgResult.reason || 'noma\'lum xato'
      const userFriendly = reason.includes('chat not found')
        ? 'Telegram chat ID topilmadi. Avval botga /start yuborganmisiz?'
        : `Telegram xatosi: ${reason}`
      return res.status(400).json({ message: userFriendly })
    }

    // Telegram muvaffaqiyatli — endi user'ni saqlaymiz
    const result = await pool.query(
      `INSERT INTO users (name, email, password, email_verified, verification_token, verification_expires, verification_sent_at, telegram_chat_id)
       VALUES ($1, $2, $3, FALSE, $4, $5, NOW(), $6)
       RETURNING id, name, email, role`,
      [trimmedName, trimmedEmail, hashedPassword, code, expires, chatId]
    )

    const user = result.rows[0]

    res.json({
      message: 'Tasdiqlash kodi Telegram\'ga yuborildi. Kodni kiriting.',
      verificationRequired: true,
      email: trimmedEmail,
      method: 'telegram'
    })

  } catch (err) {
    console.error('Register error:', err.message)
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

// Email tasdiqlash — token bo'yicha
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query
    if (typeof token !== 'string' || !token || token.length > 128) {
      return res.status(400).json({ message: 'Token noto\'g\'ri' })
    }

    const result = await pool.query(
      `SELECT id, name, email, email_verified, verification_expires
       FROM users
       WHERE verification_token = $1`,
      [token]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Havola noto\'g\'ri yoki muddati o\'tgan' })
    }

    const user = result.rows[0]

    if (user.email_verified) {
      return res.json({ message: 'Email allaqachon tasdiqlangan', alreadyVerified: true })
    }

    if (user.verification_expires && new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ message: 'Havola muddati o\'tgan. Yangi havola so\'rang.', expired: true })
    }

    await pool.query(
      `UPDATE users
       SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL
       WHERE id = $1`,
      [user.id]
    )

    res.json({
      message: 'Email muvaffaqiyatli tasdiqlandi! Endi tizimga kirishingiz mumkin.',
      verified: true,
      email: user.email
    })

  } catch (err) {
    console.error('Verify email error:', err.message)
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

// Kod orqali tasdiqlash (Telegram)
router.post('/verify-code', async (req, res) => {
  try {
    const rawEmail = req.body?.email
    const code = String(req.body?.code || '').trim()

    const emailRes = validateEmail(rawEmail)
    if (emailRes.error) return res.status(400).json({ message: emailRes.error })
    const trimmedEmail = emailRes.ok

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: 'Kod 6 raqamdan iborat bo\'lishi kerak' })
    }

    const result = await pool.query(
      `SELECT id, name, email, email_verified, verification_token, verification_expires
       FROM users WHERE email = $1`,
      [trimmedEmail]
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Email yoki kod noto\'g\'ri' })
    }

    const user = result.rows[0]

    if (user.email_verified) {
      return res.json({ message: 'Allaqachon tasdiqlangan', alreadyVerified: true })
    }

    if (!user.verification_token || user.verification_token !== code) {
      return res.status(400).json({ message: 'Kod noto\'g\'ri' })
    }

    if (user.verification_expires && new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ message: 'Kod muddati o\'tgan. Yangi kod so\'rang.', expired: true })
    }

    await pool.query(
      `UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL
       WHERE id = $1`,
      [user.id]
    )

    res.json({
      message: 'Muvaffaqiyatli tasdiqlandi! Endi tizimga kirishingiz mumkin.',
      verified: true,
      email: user.email
    })
  } catch (err) {
    console.error('Verify code error:', err.message)
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

// Tasdiqlash kodini qayta yuborish (Telegram)
router.post('/resend-verification', async (req, res) => {
  try {
    const rawEmail = req.body?.email
    const emailRes = validateEmail(rawEmail)
    if (emailRes.error) return res.status(400).json({ message: emailRes.error })
    const trimmedEmail = emailRes.ok

    const result = await pool.query(
      `SELECT id, name, email_verified, verification_sent_at, telegram_chat_id
       FROM users
       WHERE email = $1`,
      [trimmedEmail]
    )

    if (result.rows.length === 0) {
      return res.json({ message: 'Agar email tizimda mavjud bo\'lsa, yangi kod yuborildi.' })
    }

    const user = result.rows[0]
    if (user.email_verified) {
      return res.json({ message: 'Allaqachon tasdiqlangan. Login qiling.' })
    }

    if (!user.telegram_chat_id) {
      return res.status(400).json({ message: 'Telegram chat ID topilmadi. Qayta ro\'yxatdan o\'ting.' })
    }

    // Cooldown
    if (user.verification_sent_at) {
      const elapsed = (Date.now() - new Date(user.verification_sent_at).getTime()) / 1000
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        return res.status(429).json({
          message: `${Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)} soniyadan keyin qayta urinib ko'ring`,
          retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)
        })
      }
    }

    const newCode = generate6DigitCode()
    const expires = new Date(Date.now() + 15 * 60 * 1000)

    const tgResult = await telegram.sendVerificationCode(user.telegram_chat_id, user.name || 'Foydalanuvchi', newCode)
    if (!tgResult.ok) {
      return res.status(500).json({ message: `Telegram xatosi: ${tgResult.reason || ''}` })
    }

    await pool.query(
      `UPDATE users
       SET verification_token = $1, verification_expires = $2, verification_sent_at = NOW()
       WHERE id = $3`,
      [newCode, expires, user.id]
    )

    res.json({ message: 'Yangi kod Telegram\'ga yuborildi.' })

  } catch (err) {
    console.error('Resend error:', err.message)
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body
    if (typeof rawEmail !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email yoki parol noto\'g\'ri' })
    }
    const trimmedEmail = rawEmail.trim().toLowerCase()

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1', [trimmedEmail]
    )

    if (result.rows.length === 0) {
      await bcrypt.compare(password, '$2a$10$0000000000000000000000.0000000000000000000000000000000')
      logFailedLogin(req, trimmedEmail)
      return res.status(400).json({ message: 'Email yoki parol noto\'g\'ri' })
    }

    const user = result.rows[0]

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      logFailedLogin(req, trimmedEmail)
      return res.status(400).json({ message: 'Email yoki parol noto\'g\'ri' })
    }

    // Email tasdiqlanganligini tekshirish
    if (!user.email_verified) {
      return res.status(403).json({
        message: 'Email manzilingiz hali tasdiqlanmagan. Emailingizdagi havolani bosing yoki yangisini so\'rang.',
        verificationRequired: true,
        email: trimmedEmail
      })
    }

    const token = signToken(user)

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    })

  } catch (err) {
    console.error('Login error:', err.message)
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, email_verified FROM users WHERE id = $1',
      [req.user.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: 'Topilmadi' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

router.put('/update-name', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body
    const nameErr = validateName(name)
    if (nameErr) return res.status(400).json({ message: nameErr })
    const trimmed = name.trim()
    const { id } = req.user
    await pool.query('UPDATE users SET name = $1 WHERE id = $2', [trimmed, id])
    res.json({ message: 'Ism yangilandi' })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

router.put('/update-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (typeof oldPassword !== 'string') return res.status(400).json({ message: 'Parol noto\'g\'ri' })
    const pwdErr = validatePassword(newPassword)
    if (pwdErr) return res.status(400).json({ message: pwdErr })
    const { id } = req.user

    const result = await pool.query('SELECT password FROM users WHERE id = $1', [id])
    if (result.rows.length === 0) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' })
    const user = result.rows[0]

    const isMatch = await bcrypt.compare(oldPassword, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Eski parol noto\'g\'ri' })
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await pool.query(
      'UPDATE users SET password = $1, token_version = COALESCE(token_version, 0) + 1 WHERE id = $2',
      [hashed, id]
    )

    res.json({ message: 'Parol yangilandi. Boshqa qurilmalardagi sessiyalar to\'xtatildi' })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik yuz berdi' })
  }
})

module.exports = router
