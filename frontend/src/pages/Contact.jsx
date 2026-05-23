import { useEffect, useState } from 'react'
import {
  Mail, Phone, MapPin, Send, MessageCircle,
  Clock, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react'
import { API_URL, getUser } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import '../styles/pages.css'

function Contact() {
  const user = getUser()
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    message: ''
  })
  const [status, setStatus] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = "Aloqa — Eduzy"
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus({ type: '', text: '' })

    const name = form.name.trim()
    const email = form.email.trim()
    const message = form.message.trim()

    if (!name || !email || !message) {
      return setStatus({ type: 'error', text: "Barcha maydonlarni to'ldiring" })
    }
    if (name.length < 2) {
      return setStatus({ type: 'error', text: "Ism juda qisqa" })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setStatus({ type: 'error', text: "Email noto'g'ri" })
    }
    if (message.length < 10) {
      return setStatus({ type: 'error', text: "Xabar kamida 10 ta belgi bo'lishi kerak" })
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message })
      })
      const data = await res.json()

      if (res.ok) {
        setStatus({ type: 'success', text: data.message || "Xabar yuborildi!" })
        setForm({ name: user?.name || '', email: user?.email || '', message: '' })
        setTimeout(() => setStatus({ type: '', text: '' }), 6000)
      } else {
        setStatus({ type: 'error', text: data.message || "Yuborishda xatolik" })
      }
    } catch {
      setStatus({ type: 'error', text: "Server bilan bog'lanib bo'lmadi. Internetni tekshiring" })
    }
    setLoading(false)
  }

  return (
    <div>
      <Navbar />
      <div className="page-wrap">

        <div className="page-hero">
          <div className="page-badge">
            <MessageCircle size={14} /> Aloqa
          </div>
          <h1>Biz bilan <span className="gradient-text">bog'laning</span></h1>
          <p>Savollaringiz, takliflaringiz yoki hamkorlik uchun yozing — tez orada javob beramiz</p>
        </div>

        <div className="page-section">
          <div className="contact-grid">

            {/* Contact info */}
            <div className="contact-info">
              <div className="contact-info-item">
                <div className="contact-info-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                  <Mail size={20} />
                </div>
                <div>
                  <div className="contact-info-label">Email</div>
                  <a href="mailto:shoxjaxon007a@gmail.com" className="contact-info-value">shoxjaxon007a@gmail.com</a>
                </div>
              </div>

              <div className="contact-info-item">
                <div className="contact-info-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                  <Phone size={20} />
                </div>
                <div>
                  <div className="contact-info-label">Telefon</div>
                  <a href="tel:+998332357070" className="contact-info-value">+998 33 235 70 70</a>
                </div>
              </div>

              <div className="contact-info-item">
                <div className="contact-info-icon" style={{ background: 'var(--secondary-bg)', color: 'var(--secondary)' }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <div className="contact-info-label">Manzil</div>
                  <div className="contact-info-value">Toshkent, O'zbekiston</div>
                </div>
              </div>

              <div className="contact-info-item">
                <div className="contact-info-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                  <Clock size={20} />
                </div>
                <div>
                  <div className="contact-info-label">Ish vaqti</div>
                  <div className="contact-info-value">Dushanba — Shanba<br />9:00 — 18:00</div>
                </div>
              </div>
            </div>

            {/* Contact form */}
            <div className="contact-form">
              <h3>Xabar yuboring</h3>
              {status.type === 'success' && (
                <div className="contact-success">
                  <CheckCircle2 size={18} />
                  {status.text}
                </div>
              )}
              {status.type === 'error' && (
                <div className="contact-error">
                  <AlertCircle size={18} />
                  {status.text}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Ism *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ismingiz"
                    maxLength={100}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="email@example.com"
                    maxLength={200}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Xabar * <span className="form-hint">({form.message.length}/2000)</span></label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value.slice(0, 2000) })}
                    placeholder="Xabaringizni yozing... (kamida 10 belgi)"
                    rows={6}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary contact-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 size={16} className="spin" /> Yuborilmoqda...</>
                  ) : (
                    <><Send size={16} /> Yuborish</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default Contact
