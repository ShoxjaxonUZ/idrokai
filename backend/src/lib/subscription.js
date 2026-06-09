// Obuna holatini tekshirish helper'lari.
// "Faol obuna" = status='active' VA expires_at hali o'tmagan.

const pool = require('../db')

// Foydalanuvchining joriy faol obunasini qaytaradi (yoki null).
const getActiveSubscription = async (userId) => {
  if (!userId) return null
  const r = await pool.query(
    `SELECT id, plan, months, price, started_at, expires_at
     FROM subscriptions
     WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
     ORDER BY expires_at DESC
     LIMIT 1`,
    [userId]
  )
  return r.rows[0] || null
}

// Oddiy boolean — faol obuna bormi.
const isSubscribed = async (userId) => {
  const sub = await getActiveSubscription(userId)
  return !!sub
}

module.exports = { getActiveSubscription, isSubscribed }
