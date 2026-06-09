import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Crown, Bot, BookOpen, Award, Swords, Sparkles } from 'lucide-react'
import { API_URL, getToken, getUser } from '../lib/api'
import Navbar from '../components/Navbar'
import { useNotification } from '../context/NotificationContext'
import '../styles/pricing.css'

const BENEFITS = [
  { Icon: BookOpen, text: 'Barcha kurslarga to\'liq kirish' },
  { Icon: Bot, text: 'AI Teacher — kuniga 100 ta savol' },
  { Icon: Award, text: 'Cheksiz sertifikatlar' },
  { Icon: Swords, text: 'Code Battle va kunlik masalalar' },
  { Icon: Sparkles, text: 'Yangi premium funksiyalar' }
]

function Pricing() {
  const navigate = useNavigate()
  const { addNotification } = useNotification() || { addNotification: () => {} }
  const user = getUser()
  const token = getToken()

  const [plans, setPlans] = useState([])
  const [mySub, setMySub] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = "Obuna tariflari — Eduzy"
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/subscription/plans`)
        const data = await res.json()
        setPlans(data.plans || [])
      } catch {}
      if (token) {
        try {
          const r = await fetch(`${API_URL}/api/subscription/me`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          const d = await r.json()
          if (d.active) setMySub(d.subscription)
        } catch {}
      }
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (n) => (Number(n) || 0).toLocaleString('uz-UZ')

  const choosePlan = (plan) => {
    if (!user) {
      navigate('/register', { state: { from: { pathname: '/pricing' } } })
      return
    }
    // To'lov tizimi hali ulanmagan — foydalanuvchini yo'naltiramiz
    addNotification(
      "To'lov tizimi tez kunda ulanadi. Obunani faollashtirish uchun biz bilan bog'laning.",
      'info'
    )
    navigate('/contact')
  }

  return (
    <div>
      <Navbar />
      <div className="pricing-page">
        <div className="pricing-header">
          <div className="pricing-badge"><Crown size={16} /> Premium obuna</div>
          <h1>O'zingizga mos tarifni tanlang</h1>
          <p>Barcha kurslar, kengaytirilgan AI va premium funksiyalar — bitta obunada</p>
        </div>

        {mySub && (
          <div className="pricing-active-banner">
            <Check size={18} />
            <span>
              Sizda faol obuna bor — <strong>{mySub.months} oylik</strong>.
              Tugash sanasi: {new Date(mySub.expiresAt).toLocaleDateString('uz-UZ')}
            </span>
          </div>
        )}

        {loading ? (
          <div className="pricing-loading">Yuklanmoqda...</div>
        ) : (
          <div className="pricing-grid">
            {plans.map((p) => (
              <div key={p.id} className={`pricing-card ${p.popular ? 'is-popular' : ''}`}>
                {p.popular && <div className="pricing-popular-tag">Eng foydali</div>}
                {p.discountPct > 0 && (
                  <div className="pricing-discount">−{p.discountPct}%</div>
                )}
                <div className="pricing-card-title">{p.label}</div>
                <div className="pricing-price">
                  <span className="pricing-amount">{fmt(p.price)}</span>
                  <span className="pricing-currency">so'm</span>
                </div>
                <div className="pricing-permonth">
                  ≈ {fmt(p.perMonth)} so'm / oy
                </div>
                <button className="pricing-btn" onClick={() => choosePlan(p)}>
                  Tanlash
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pricing-benefits">
          <h2>Obuna nimani ochadi?</h2>
          <ul>
            {BENEFITS.map((b, i) => (
              <li key={i}>
                <span className="pricing-benefit-icon"><b.Icon size={18} /></span>
                {b.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="pricing-note">
          💳 To'lov tizimi (Click / Payme) tez kunda ulanadi. Hozircha obunani
          faollashtirish uchun biz bilan bog'laning.
        </p>
      </div>
    </div>
  )
}

export default Pricing
