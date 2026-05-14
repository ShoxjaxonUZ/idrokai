const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const path = require('path')

const authRoutes = require('./routes/auth')
const courseRoutes = require('./routes/courses')
const adminRoutes = require('./routes/admin')
const aiRoutes = require('./routes/ai')
const commentRoutes = require('./routes/comments')
const teacherRoutes = require('./routes/teacher')
const uploadRoutes = require('./routes/upload')
const battleRoutes = require('./routes/battle')
const leaderboardRoutes = require('./routes/leaderboard')
const onboardingRoutes = require('./routes/onboarding')
const dailyRoutes = require('./routes/daily')
const moduleTestRoutes = require('./routes/moduleTest')
const securityRoutes = require('./routes/security')
const telegramRoutes = require('./routes/telegram')
const contactRoutes = require('./routes/contact')
const notificationsRoutes = require('./routes/notifications')
const lessonNotesRoutes = require('./routes/lessonNotes')
const { threatDetector } = require('./middleware/threatDetector')
const telegram = require('./lib/telegram')
const { runMigrations } = require('./lib/migrate')

require('./db')

const app = express()
const PORT = process.env.PORT || 5000

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET kuchli emas (>=32 belgi bo\'lishi shart). .env ni tuzating.')
  process.exit(1)
}
if (!process.env.GROQ_API_KEY) {
  console.warn('OGOHLANTIRISH: GROQ_API_KEY o\'rnatilmagan — AI funksiyalari ishlamaydi')
}

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.set('trust proxy', 1)
app.disable('x-powered-by')
app.set('etag', false)

// Helmet — to'liq xavfsizlik headerlari
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // CSP — ushbu API faqat JSON qaytaradi, lekin /uploads media ham xizmat qiladi.
  // strict-mode: hech qanday inline script/style ruxsat berilmaydi.
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'none'"],
      baseUri: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 63072000, includeSubDomains: true, preload: true }
    : false,
  frameguard: { action: 'deny' }
}))

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) return cb(null, true)
    return cb(new Error('CORS: ruxsat berilmagan origin'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}))

app.use(express.json({ limit: '6mb' }))

// Threat detector — body parse'dan KEYIN, lekin route'lardan OLDIN.
// Async fire-and-forget log qiladi, request bloklanmaydi.
app.use(threatDetector)

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Juda ko\'p so\'rov. Birozdan keyin urinib ko\'ring' }
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Juda ko\'p urinish. Birozdan keyin urinib ko\'ring' }
})

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'AI so\'rovlari juda ko\'p. Bir daqiqadan keyin urinib ko\'ring' }
})

app.use('/api/', apiLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/ai/', aiLimiter)
app.use('/api/onboarding/chat', aiLimiter)
app.use('/api/daily/submit', aiLimiter)
app.use('/api/module-test/generate', aiLimiter)
app.use('/api/battle/submit', aiLimiter)

// Static uploads — xavfsizroq sozlamalar:
// - dotfiles: deny (yashirin fayllar)
// - index: false (papka ro'yxatini chiqarmaslik)
// - immutable cache + nosniff
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    // HTML/JS sifatida talqin qilinmasligi uchun:
    if (/\.(html?|js|svg)$/i.test(filePath)) {
      res.setHeader('Content-Disposition', 'attachment')
    }
  }
}))

app.get('/', (req, res) => {
  res.json({ message: 'IdrokAI API ishlamoqda!' })
})

// Health check (UptimeRobot, Render uchun)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), ts: Date.now() })
})

app.use('/api/auth', authRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/teacher', teacherRoutes)
app.use('/api/battle', battleRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/onboarding', onboardingRoutes)
app.use('/api/daily', dailyRoutes)
app.use('/api/module-test', moduleTestRoutes)
app.use('/api/security', securityRoutes)
app.use('/api/telegram', telegramRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/lesson-notes', lessonNotesRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Topilmadi' })
})

// Global xato ushlovchi — production'da batafsil xato matnlari foydalanuvchiga ko'rsatilmaydi
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.stack || err.message)
  if (res.headersSent) return
  const status = err.status || 500
  const isProd = process.env.NODE_ENV === 'production'
  // CORS xatosi — aniq xabar
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ message: 'CORS taqiqlangan' })
  }
  res.status(status).json({
    message: isProd && status >= 500
      ? 'Server xatosi'
      : (err.message || 'Server xatosi')
  })
})

// Server ishga tushirish — migration tugagandan keyin
const start = async () => {
  try {
    await runMigrations()
  } catch (err) {
    console.error('Migration xatosi — server boshlamayman:', err.message)
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server ${PORT} portda ishlamoqda`)
    const alertsOn = String(process.env.TELEGRAM_SECURITY_ALERTS || '').toLowerCase() === 'on'
    if (telegram.isConfigured() && alertsOn) {
      console.log('🛡️  Telegram security alerts: yoqilgan')
      telegram.sendStartup().catch(() => {})
    } else {
      console.log('🔕 Telegram security alerts: o\'chirilgan (yoqish uchun TELEGRAM_SECURITY_ALERTS=on)')
    }

    // Telegram webhook'ni avtomatik o'rnatish (production'da)
    // RENDER_EXTERNAL_URL Render avtomatik beradi (masalan https://idrokai-api.onrender.com)
    const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL
    if (process.env.TELEGRAM_BOT_TOKEN && externalUrl) {
      const webhookUrl = `${externalUrl.replace(/\/$/, '')}/api/telegram/webhook`
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
      telegram.setWebhook(webhookUrl, secret).then(r => {
        if (r.ok) {
          console.log(`✅ Telegram webhook: ${webhookUrl}`)
        } else {
          console.warn(`⚠️  Telegram webhook xatosi: ${r.description || r.reason}`)
        }
      }).catch(() => {})
    } else {
      console.log('ℹ️  Telegram webhook o\'rnatilmadi (RENDER_EXTERNAL_URL kerak)')
    }
  })
}

start()
