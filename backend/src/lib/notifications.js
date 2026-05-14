// In-app notification helper — boshqa modullardan chaqirish uchun.
// Misol: lib/notifications.notify(userId, 'admin_reply', 'Admin javob berdi', '...', '/dashboard?tab=messages')

const pool = require('../db')

/**
 * Yangi notification yaratish (fire-and-forget — xato bo'lsa log, lekin throw qilmaydi).
 * @param {number} userId
 * @param {string} type   — 'admin_reply' | 'daily_remind' | 'cert_ready' | 'battle_invite' | 'system'
 * @param {string} title
 * @param {string} message
 * @param {string|null} link  — masalan '/dashboard'
 * @param {string|null} icon  — lucide icon name (frontend ishlatadi)
 */
async function notify(userId, type, title, message = '', link = null, icon = null) {
  if (!userId || !type || !title) return null
  try {
    const r = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link, icon)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [userId, type, String(title).slice(0, 200), String(message).slice(0, 1000), link, icon]
    )
    return r.rows[0]
  } catch (err) {
    console.error('[notify] error:', err.message)
    return null
  }
}

/**
 * Bir nechta user'lar uchun bir xil notification (bulk).
 */
async function notifyMany(userIds, type, title, message = '', link = null, icon = null) {
  if (!Array.isArray(userIds) || userIds.length === 0) return 0
  try {
    const values = []
    const placeholders = []
    let idx = 1
    for (const uid of userIds) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`)
      values.push(uid, type, String(title).slice(0, 200), String(message).slice(0, 1000), link, icon)
    }
    const r = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link, icon)
       VALUES ${placeholders.join(', ')}`,
      values
    )
    return r.rowCount || userIds.length
  } catch (err) {
    console.error('[notifyMany] error:', err.message)
    return 0
  }
}

module.exports = { notify, notifyMany }
