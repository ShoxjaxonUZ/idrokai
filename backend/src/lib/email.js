// Email yuborish — 3 ta provayder qo'llab-quvvatlanadi (prioritet bo'yicha):
// 1. Brevo (BREVO_API_KEY) — HTTPS API, har qanday emailga yuboradi, 300/kun bepul
// 2. Resend (RESEND_API_KEY) — HTTPS API, bepul rejada faqat o'z emailga
// 3. SMTP (Gmail va h.k.) — SMTP_HOST + SMTP_USER + SMTP_PASS
// Hech qaysi sozlanmasa: dev rejimda console'ga yoziladi

const nodemailer = require('nodemailer')

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 587
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const RESEND_API_KEY = process.env.RESEND_API_KEY
const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_FROM = process.env.BREVO_FROM || process.env.SMTP_FROM || 'Eduzy <noreply@eduzy.uz>'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

// Gmail uchun From address SMTP_USER bilan mos kelishi shart (aks holda block qiladi)
// Boshqa SMTP'lar (Brevo, SendGrid) uchun esa custom From'ga ruxsat bor
let SMTP_FROM = process.env.SMTP_FROM
if (SMTP_HOST?.includes('gmail') && SMTP_USER) {
  // Gmail — From email aynan SMTP_USER bo'lishi shart
  SMTP_FROM = `Eduzy <${SMTP_USER}>`
} else if (!SMTP_FROM) {
  SMTP_FROM = `Eduzy <${SMTP_USER || 'noreply@eduzy.uz'}>`
}

const RESEND_FROM = process.env.RESEND_FROM || 'Eduzy <onboarding@resend.dev>'

let transporter = null
let provider = 'none'

if (BREVO_API_KEY) {
  provider = 'brevo'
  // Diagnostika: kalit boshlanishi va oxirini ko'rsatish (sironi buzmaydi)
  const keyPreview = BREVO_API_KEY.length > 12
    ? `${BREVO_API_KEY.slice(0, 10)}...${BREVO_API_KEY.slice(-4)}`
    : '(juda qisqa)'
  console.log(`📧 Email provayder: Brevo (kalit: ${keyPreview}, uzunlik: ${BREVO_API_KEY.length})`)
  console.log(`📧 Brevo sender: ${BREVO_FROM}`)
} else if (RESEND_API_KEY) {
  provider = 'resend'
  console.log('📧 Email provayder: Resend (RESEND_API_KEY topildi)')
} else if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: true },
    // Render bepul rejada IPv6 ishlamaydi — IPv4 ga majburlash
    family: 4,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000
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

// Brevo "from" maydonini parse qiladi: "Name <email@host.com>" -> {name, email}
const parseFrom = (str) => {
  if (!str) return { name: 'Eduzy', email: 'noreply@eduzy.uz' }
  const m = String(str).match(/^(.*?)\s*<([^>]+)>$/)
  if (m) return { name: m[1].trim() || 'Eduzy', email: m[2].trim() }
  return { name: 'Eduzy', email: String(str).trim() }
}

const sendViaBrevo = async ({ to, subject, html, text, from }) => {
  try {
    const sender = parseFrom(from || BREVO_FROM)
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[Brevo] xato:', res.status, data)
      return { ok: false, reason: data.message || data.code || `Brevo ${res.status}` }
    }
    return { ok: true, messageId: data.messageId }
  } catch (err) {
    console.error('[Brevo] tarmoq xatosi:', err.message)
    return { ok: false, reason: err.message }
  }
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

  if (provider === 'brevo') return sendViaBrevo(args)
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
      <h1>🎓 Eduzy</h1>
      <p style="margin: 8px 0 0; opacity: 0.9;">Bilim — kelajagingiz kaliti</p>
    </div>
    <div class="body">
      <h2>Salom, ${escapeHtml(name)}!</h2>
      <p>Eduzy platformasiga ro'yxatdan o'tganingiz uchun rahmat 🎉</p>
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
      © Eduzy — bepul ta'lim platformasi<br>
      <a href="${APP_URL}" style="color: #8b5cf6;">${APP_URL.replace(/^https?:\/\//, '')}</a>
    </div>
  </div>
</body>
</html>`

const sendVerificationEmail = async (toEmail, name, token) => {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`
  const subject = 'Eduzy — Email manzilingizni tasdiqlang'
  const html = buildVerificationHtml(name, link)
  const text = `Salom, ${name}!\n\nEduzy'ga ro'yxatdan o'tganingiz uchun rahmat.\n\nHisobingizni faollashtirish uchun quyidagi havolani oching:\n${link}\n\nHavola 24 soat amal qiladi.\n\nAgar ro'yxatdan o'tmagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring.\n\nEduzy`

  return sendMail({ to: toEmail, subject, html, text })
}

// Test xabar — admin SMTP ulanishini tekshirish uchun
const sendTestEmail = async (toEmail) => {
  return sendMail({
    to: toEmail,
    subject: 'Eduzy — SMTP test xabari',
    html: `<h2>✅ SMTP to'g'ri sozlangan!</h2><p>Bu test xabari. Agar buni o'qib turgan bo'lsangiz, email tizimi ishlayapti.</p><p>Provayder: <strong>${provider}</strong></p>`,
    text: `SMTP test — provayder: ${provider}`
  })
}

const getProvider = () => provider

module.exports = { sendMail, sendVerificationEmail, sendTestEmail, isConfigured, getProvider }
