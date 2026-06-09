const express = require('express')
const router = express.Router()
const { auth } = require('../middleware/auth')
const { getPlans } = require('../lib/plans')
const { getActiveSubscription } = require('../lib/subscription')

// Tariflar ro'yxati — ochiq (hamma ko'ra oladi).
router.get('/plans', (req, res) => {
  res.json({ plans: getPlans() })
})

// Mening obunam — faol obuna ma'lumoti (yoki null).
router.get('/me', auth, async (req, res) => {
  try {
    const sub = await getActiveSubscription(req.user.id)
    if (!sub) return res.json({ active: false, subscription: null })
    res.json({
      active: true,
      subscription: {
        plan: sub.plan,
        months: sub.months,
        startedAt: sub.started_at,
        expiresAt: sub.expires_at
      }
    })
  } catch (err) {
    console.error('[subscription/me]', err.message)
    res.status(500).json({ message: 'Xatolik' })
  }
})

module.exports = router
