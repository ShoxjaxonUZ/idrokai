// Obuna tariflari — 1 / 3 / 6 / 12 oy.
// Narxlar so'mda. Bu yerda o'zgartiring (kelajakda admin panel orqali ham
// boshqarish mumkin). discountPct — 1 oylik narxga nisbatan tejamkorlik (UI uchun).

const MONTHLY = 49000 // 1 oylik bazaviy narx

const PLANS = [
  { id: '1m',  months: 1,  label: '1 oy',   price: 49000,  popular: false },
  { id: '3m',  months: 3,  label: '3 oy',   price: 129000, popular: false },
  { id: '6m',  months: 6,  label: '6 oy',   price: 239000, popular: true  },
  { id: '12m', months: 12, label: '12 oy',  price: 399000, popular: false }
]

// Har tarif uchun oylik narx va tejamkorlikni hisoblab beramiz (UI ko'rsatadi).
const withMeta = (p) => {
  const perMonth = Math.round(p.price / p.months)
  const discountPct = Math.max(0, Math.round((1 - perMonth / MONTHLY) * 100))
  return { ...p, perMonth, discountPct }
}

const getPlans = () => PLANS.map(withMeta)

const getPlan = (id) => {
  const p = PLANS.find(x => x.id === id)
  return p ? withMeta(p) : null
}

module.exports = { getPlans, getPlan }
