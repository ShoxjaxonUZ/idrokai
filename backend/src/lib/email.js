// Email yuborish — Nodemailer SMTP (Gmail yoki boshqa provayder).
// .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
// Sozlanmagan bo'lsa, console'ga "yuborilgan" deb log yoziladi (dev rejim).

const nodemailer = require('nodemailer')

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 587
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_FROM = process.env.SMTP_FROM || `IdrokAI <${SMTP_USER || 'noreply@idrokai.uz'}>`
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

let transporter = null
let configured = false

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  })
  configured = true

  // Boshlanishida ulanishni tekshirish
  transporter.verify().then(() => {
    console.log('📧 SMTP konfiguratsiyasi to\'g\'ri:', SMTP_HOST)
  }).catch(err => {
    console.warn('⚠️  SMTP ulanish xatosi:', err.message)
    console.warn('   Email yuborilmaydi. .env da SMTP_USER/SMTP_PASS tekshiring.')
  })
}

const isConfigured = () => configured

// Email yuborish — sozlanmagan bo'lsa console'ga yozadi
const sendMail = async ({ to, subject, html, text }) => {
  if (!configured) {
    // Dev rejim — console'da ko'rsatamiz
    console.log('\n══════════════════════════════════════════════')
    console.log('📧 [DEV MODE] Email yuborilmadi (SMTP sozlanmagan)')
    console.log('   To:', to)
    console.log('   Subject:', subject)
    console.log('   Text:', text || html?.replace(/<[^>]+>/g, '').slice(0, 200))
    console.log('══════════════════════════════════════════════\n')
    return { ok: false, reason: 'SMTP sozlanmagan' }
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
      text: text || html?.replace(/<[^>]+>/g, '')
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    console.error('[Email] yuborish xatosi:', err.message)
    return { ok: false, reason: err.message }
  }
}

// Email tasdiqlash xabari
const sendVerificationEmail = async (toEmail, name, token) => {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`
  const subject = 'IdrokAI — Email manzilingizni tasdiqlang'

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; padding: 24px; color: #111827; }
  .card { max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 32px; text-align: center; color: white; }
  .header h1 { margin: 0; font-size: 24px; }
  .body { padding: 32px; }
  .body h2 { margin-top: 0; color: #111827; }
  .button { display: inline-block; background: #8b5cf6; color: white !important; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin: 20px 0; }
  .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 13px; }
  .link { word-break: break-all; color: #8b5cf6; font-size: 13px; }
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
      <p>IdrokAI platformasiga ro'yxatdan o'tganingiz uchun rahmat.</p>
      <p>Hisobingizni faollashtirish uchun quyidagi tugmani bosing:</p>
      <div style="text-align: center;">
        <a href="${link}" class="button">Emailni tasdiqlash</a>
      </div>
      <p style="color: #6b7280; font-size: 13px;">
        Yoki ushbu havolani brauzerga nusxalang:
      </p>
      <p class="link">${link}</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
        ⏱ Havola <strong>24 soat</strong> davomida amal qiladi.
      </p>
      <p style="color: #6b7280; font-size: 13px;">
        Agar siz ro'yxatdan o'tmagan bo'lsangiz — bu xabarni e'tiborsiz qoldiring.
      </p>
    </div>
    <div class="footer">
      © IdrokAI — bepul ta'lim platformasi
    </div>
  </div>
</body>
</html>`

  const text = `Salom, ${name}!\n\nIdrokAI'ga ro'yxatdan o'tganingiz uchun rahmat.\n\nHisobingizni faollashtirish uchun quyidagi havolani oching:\n${link}\n\nHavola 24 soat amal qiladi.\n\nAgar ro'yxatdan o'tmagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring.\n\nIdrokAI`

  return sendMail({ to: toEmail, subject, html, text })
}

// XSS himoyasi — HTML escape
const escapeHtml = (s) => {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

module.exports = { sendMail, sendVerificationEmail, isConfigured }
