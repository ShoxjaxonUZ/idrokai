/* eslint-disable */
// Telegram bot Chat ID'ni avtomatik topish.
// Avval @BotFather'da bot yaratib, .env da TELEGRAM_BOT_TOKEN o'rnating.
// Keyin botingiz bilan suhbatda "/start" yuboring.
// Bu skript chat ID'ni getUpdates orqali topadi va sizga ko'rsatadi.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const TOKEN = process.env.TELEGRAM_BOT_TOKEN

;(async () => {
  if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN .env da yo\'q!')
    console.error('\n📝 Ko\'rsatma:')
    console.error('   1. Telegram\'da @BotFather ni oching')
    console.error('   2. /newbot yuboring va botingizga nom bering')
    console.error('   3. Olingan tokenni .env ga qo\'ying:')
    console.error('      TELEGRAM_BOT_TOKEN=1234567890:AaBbCc...')
    console.error('   4. Botingiz bilan suhbatda "/start" yuboring')
    console.error('   5. Bu skriptni qayta ishga tushiring\n')
    process.exit(1)
  }

  console.log('🔍 Telegram updates so\'ralmoqda...\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates`)
    const data = await res.json()

    if (!data.ok) {
      console.error('❌ Telegram API xatosi:', data.description)
      console.error('   Token noto\'g\'ri bo\'lishi mumkin.')
      process.exit(1)
    }

    if (!data.result || data.result.length === 0) {
      console.error('❌ Hech qanday xabar topilmadi!')
      console.error('   Botingiz bilan Telegram\'da "/start" yuboring va keyin qayta urinib ko\'ring.')
      process.exit(1)
    }

    // Eng oxirgi xabardan chat ma\'lumotlarini olamiz
    const chats = new Map()
    for (const upd of data.result) {
      const msg = upd.message || upd.edited_message || upd.channel_post
      if (msg && msg.chat) {
        chats.set(msg.chat.id, {
          id: msg.chat.id,
          type: msg.chat.type,
          title: msg.chat.title || `${msg.chat.first_name || ''} ${msg.chat.last_name || ''}`.trim() || msg.chat.username,
          username: msg.chat.username
        })
      }
    }

    console.log(`✅ ${chats.size} ta chat topildi:\n`)
    for (const [id, info] of chats) {
      console.log(`   Chat ID:  ${id}`)
      console.log(`   Turi:     ${info.type}`)
      console.log(`   Nomi:     ${info.title}`)
      if (info.username) console.log(`   Username: @${info.username}`)
      console.log('')
    }

    const recommended = [...chats.values()].find(c => c.type === 'private') || [...chats.values()][0]
    console.log(`💡 Tavsiya etiladi (private chat):`)
    console.log(`   .env ga qo\'shing: TELEGRAM_CHAT_ID=${recommended.id}\n`)

    // Test xabari yuboramiz
    console.log('🧪 Test xabari yuborilmoqda...')
    const testRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: recommended.id,
        text: '🛡️ Eduzy xavfsizlik bot ishladi!\n\nBu test xabari. Endi haqiqiy hujumlar aniqlansa sizga xabar keladi.',
        disable_notification: false
      })
    })
    const testData = await testRes.json()
    if (testData.ok) {
      console.log('✅ Test xabari yuborildi! Telegram\'ni tekshiring.')
    } else {
      console.log('❌ Test xabar xatosi:', testData.description)
    }

    process.exit(0)
  } catch (err) {
    console.error('❌ Xato:', err.message)
    process.exit(1)
  }
})()
