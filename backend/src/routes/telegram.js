// Telegram bot webhook — `/start TOKEN` komandasini qabul qiladi.
// Token'ga mos kelgan foydalanuvchini email_verified=TRUE qiladi.

const express = require('express')
const router = express.Router()
const pool = require('../db')
const telegram = require('../lib/telegram')

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || ''

// MarkdownV2 escape
const md = (s) => {
  if (s == null) return ''
  return String(s).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, m => '\\' + m)
}

router.post('/webhook', async (req, res) => {
  // Secret token tekshiruv — boshqalar webhook'ni chaqirib bo'lmasin
  if (WEBHOOK_SECRET && req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) {
    return res.status(403).end()
  }

  // Telegram'ga har doim 200 OK qaytaramiz — qayta yuborish urinishlari bo'lmasin
  res.json({ ok: true })

  try {
    const update = req.body
    const message = update?.message
    if (!message) return

    const chatId = String(message.chat?.id || '')
    const text = message.text || ''
    const fromUsername = message.from?.username || null

    if (!chatId) return

    // /start TOKEN — tasdiqlash
    const startMatch = text.match(/^\/start\s+([a-f0-9]{20,64})$/i)
    if (startMatch) {
      const token = startMatch[1]

      const result = await pool.query(
        `SELECT id, name, email, email_verified
         FROM users
         WHERE verification_token = $1`,
        [token]
      )

      if (result.rows.length === 0) {
        await telegram.sendTo(chatId,
          `❌ Tasdiqlash havolasi noto'g'ri yoki muddati o'tgan\\.\n\nSaytga qaytib qayta urinib ko'ring\\.`)
        return
      }

      const user = result.rows[0]

      if (user.email_verified) {
        await telegram.sendTo(chatId,
          `✅ Salom, *${md(user.name)}*\\!\n\nSiz allaqachon tasdiqlangansiz\\. Saytga kirib oling\\.`)
        return
      }

      // Muddatni tekshirish
      const expRow = await pool.query(
        `SELECT verification_expires FROM users WHERE id = $1`,
        [user.id]
      )
      const expires = expRow.rows[0]?.verification_expires
      if (expires && new Date(expires) < new Date()) {
        await telegram.sendTo(chatId,
          `⏰ Havola muddati o'tgan\\.\n\nSaytda yangi havola so'rang\\.`)
        return
      }

      // Tasdiqlash
      await pool.query(
        `UPDATE users
         SET email_verified = TRUE,
             telegram_chat_id = $1,
             verification_token = NULL,
             verification_expires = NULL
         WHERE id = $2`,
        [chatId, user.id]
      )

      await telegram.sendTo(chatId,
        `🎉 *Tasdiqlandingiz\\!*\n\nSalom, *${md(user.name)}*\\!\n\nEndi saytga qaytib tizimga kiring\\.\n\n_Eduzy — bilim olib, kelajakka tayyorlaning\\._`)

      return
    }

    // Oddiy /start (token'siz)
    if (text === '/start') {
      await telegram.sendTo(chatId,
        `👋 *Salom\\!*\n\nBu *Eduzy tasdiqlash boti*\\.\n\nRo'yxatdan o'tish uchun:\n1\\. Saytda *Ro'yxatdan o'tish* sahifasiga kiring\n2\\. Ma'lumotlaringizni to'ldiring\n3\\. *Telegram orqali tasdiqlash* tugmasini bosing\n\nShunda bot avtomatik sizni tanib oladi\\.`)
      return
    }

    // Boshqa xabarlar — javob bermaslik (faqat tasdiqlash bot)
  } catch (err) {
    console.error('Telegram webhook error:', err.message)
  }
})

// Admin endpoint: webhook URL'ni qo'lda o'rnatish (kerak bo'lsa)
const { auth, adminOnly } = require('../middleware/auth')
router.post('/setup-webhook', auth, adminOnly, async (req, res) => {
  try {
    const baseUrl = req.body?.url || process.env.RENDER_EXTERNAL_URL || ''
    if (!baseUrl) {
      return res.status(400).json({ message: 'URL berilmagan' })
    }
    const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`
    const result = await telegram.setWebhook(webhookUrl, WEBHOOK_SECRET)
    res.json({ ok: result.ok, url: webhookUrl, ...result })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
