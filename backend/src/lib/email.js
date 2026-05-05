// Email yuborish — 2 ta provayder qo'llab-quvvatlanadi:
// 1. Resend (tavsiya etiladi — production uchun) — RESEND_API_KEY
// 2. SMTP (Gmail va h.k.) — SMTP_USER + SMTP_PASS
// Hech qaysi sozlanmasa: dev rejimda console'ga yoziladi

const nodemailer = require('nodemailer')

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 587
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const RESEND_API_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

// Gmail uchun From address SMTP_USER bilan mos kelishi shart (aks holda block qiladi)
// Boshqa SMTP'lar (Brevo, SendGrid) uchun esa custom From'ga ruxsat bor
let SMTP_FROM = process.env.SMTP_FROM
if (SMTP_HOST?.includes('gmail') && SMTP_USER) {
  // Gmail — From email aynan SMTP_USER bo'lishi shart
  SMTP_FROM = `IdrokAI <${SMTP_USER}>`
} else if (!SMTP_FROM) {
  SMTP_FROM = `IdrokAI <${SMTP_USER || 'noreply@idrokai.uz'}>`
}

const RESEND_FROM = process.env.RESEND_FROM || 'IdrokAI <onboarding@resend.dev>'

let transporter = null
let provider = 'none'

if (RESEND_API_KEY) {
  provider = 'resend'
  console.log('📧 Email provayder: Resend (RESEND_API_KEY topildi)')
} else if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: true }
  })
  provider = 'smtp'

  transporter.verify().then(() => {
    console.log(`📧 SMTP konfiguratsiyasi to'g'ri: ${SMTP_HOST} (user: ${SMTP_USER})`)
  }).catch(err => {
    console.warn('⚠️  SMTP ulanish xatosi:', err.message)
    if (err.message.includes('Username and Password not accepted')) {
      console.warn('   Gmail uchun: 16-belgili App Password kerak (oddiy parol emas!)')
      console.warn('   https://myaccount.google.com/apppasswords')
    }
  })
} else {
  console.warn('⚠️  Email provayder sozlanmagan — emaillar console\'ga yoziladi (DEV mode)')
}

const isConfigured = () => provider !== 'none'

const escapeHtml = (s) => {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const sendViaResend = async ({ to, subject, html, text, from }) => {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: from || RESEND_FROM,
        to: [to],
        subject,
        html,
        text
      })
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('[Resend] xato:', data)
      return { ok: false, reason: data.message || 'Resend xatosi' }
    }
    return { ok: true, messageId: data.id }
  } catch (err) {
    console.error('[Resend] tarmoq xatosi:', err.message)
    return { ok: false, reason: err.message }
  }
}

const sendViaSmtp = async ({ to, subject, html, text, from }) => {
  try {
    const info = await transporter.sendMail({
      from: from || SMTP_FROM,
      to,
      subject,
      html,
      text: text || html?.replace(/<[^>]+>/g, '')
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    console.error('[SMTP] yuborish xatosi:', err.message)
    return { ok: false, reason: err.message }
  }
}

// Email yuborish
const sendMail = async ({ to, subject, html, text, from }) => {
  const args = { to, subject, html, text, from }

  if (provider === 'resend') return sendViaResend(args)
  if (provider === 'smtp') return sendViaSmtp(args)

  // Dev rejim — console'ga yozamiz
  console.log('\n══════════════════════════════════════════════')
  console.log('📧 [DEV MODE] Email yuborilmadi (provayder sozlanmagan)')
  console.log('   To:', to)
  console.log('   Subject:', subject)
  console.log('   Content:', text || html?.replace(/<[^>]+>/g, '').slice(0, 300))
  console.log('══════════════════════════════════════════════\n')
  return { ok: false, reason: 'Email provayder sozlanmagan' }
}

const buildVerificationHtml = (name, link) => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; padding: 24px; color: #111827; margin: 0; }
  .card { max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 32px; text-align: center; color: white; }
  .header h1 { margin: 0; font-size: 26px; }
  .body { padding: 32px; line-height: 1.6; }
  .body h2 { margin-top: 0; color: #111827; }
  .button { display: inline-block; background: #8b5cf6; color: white !important; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; margin: 20px 0; }
  .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 13px; background: #f9fafb; }
  .link { word-break: break-all; color: #8b5cf6; font-size: 12px; background: #f3f4f6; padding: 12px; border-radius: 6px; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🎓 IdrokAI</h1>
      <p style="margin: 8px 0 0; opacity: 0.9;">Bilim — kelajagingiz kaliti</p>
    </div>
    <div class="body">
      <h2>Salom, ${escapeHtml(name)}!</h2>
      <p>IdrokAI platformasiga ro'yxatdan o'tganingiz uchun rahmat 🎉</p>
      <p>Hisobingizni faollashtirish uchun quyidagi tugmani bosing:</p>
      <div style="text-align: center;">
        <a href="${link}" class="button">✓ Emailni tasdiqlash</a>
      </div>
      <p style="color: #6b7280; font-size: 13px;">
        Yoki ushbu havolani brauzerga nusxalang:
      </p>
      <p class="link">${link}</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        ⏱ Havola <strong>24 soat</strong> davomida amal qiladi.
      </p>
      <p style="color: #6b7280; font-size: 13px;">
        Agar siz ro'yxatdan o'tmagan bo'lsangiz — bu xabarni e'tiborsiz qoldiring.
      </p>
    </div>
    <div class="footer">
      © IdrokAI — bepul ta'lim platformasi<br>
      <a href="${APP_URL}" style="color: #8b5cf6;">${APP_URL.replace(/^https?:\/\//, '')}</a>
    </div>
  </div>
</body>
</html>`

const sendVerificationEmail = async (toEmail, name, token) => {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`
  const subject = 'IdrokAI — Email manzilingizni tasdiqlang'
  const html = buildVerificationHtml(name, link)
  const text = `Salom, ${name}!\n\nIdrokAI'ga ro'yxatdan o'tganingiz uchun rahmat.\n\nHisobingizni faollashtirish uchun quyidagi havolani oching:\n${link}\n\nHavola 24 soat amal qiladi.\n\nAgar ro'yxatdan o'tmagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring.\n\nIdrokAI`

  return sendMail({ to: toEmail, subject, html, text })
}

// Test xabar — admin SMTP ulanishini tekshirish uchun
const sendTestEmail = async (toEmail) => {
  return sendMail({
    to: toEmail,
    subject: 'IdrokAI — SMTP test xabari',
    html: `<h2>✅ SMTP to'g'ri sozlangan!</h2><p>Bu test xabari. Agar buni o'qib turgan bo'lsangiz, email tizimi ishlayapti.</p><p>Provayder: <strong>${provider}</strong></p>`,
    text: `SMTP test — provayder: ${provider}`
  })
}

const getProvider = () => provider

module.exports = { sendMail, sendVerificationEmail, sendTestEmail, isConfigured, getProvider }
