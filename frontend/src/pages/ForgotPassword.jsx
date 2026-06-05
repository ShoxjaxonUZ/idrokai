import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Mail, GraduationCap, AlertCircle, ArrowLeft, CheckCircle2, Send } from 'lucide-react'
import { API_URL } from '../lib/api'
import '../styles/auth.css'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    document.title = "Parolni tiklash — Eduzy"
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (!email.trim()) return setError('Email manzilingizni kiriting')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSent(true)
      } else {
        setError(data.message || 'Xatolik yuz berdi')
      }
    } catch {
      setError('Server bilan bog\'lanib bo\'lmadi')
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <GraduationCap size={28} />
          </div>
          <div className="auth-logo-text">Eduzy</div>
        </div>

        {sent ? (
          <>
            <div className="auth-success-icon">
              <CheckCircle2 size={48} />
            </div>
            <h1 className="auth-title">Havola yuborildi</h1>
            <p className="auth-sub">
              Agar <strong>{email}</strong> ro'yxatdan o'tgan bo'lsa, parolni
              tiklash havolasi shu emailga yuborildi. Pochtangizni (va "Spam"
              papkasini) tekshiring — havola 1 soat amal qiladi.
            </p>
            <Link to="/login" className="btn-primary full auth-btn" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={18} /> Kirishga qaytish
            </Link>
          </>
        ) : (
          <>
            <h1 className="auth-title">Parolni unutdingizmi?</h1>
            <p className="auth-sub">Email manzilingizni kiriting — tiklash havolasini yuboramiz</p>

            {error && (
              <div className="auth-error">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="form-group">
              <label>Email</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            </div>

            <button
              className="btn-primary full auth-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <>Yuborilmoqda...</> : <><Send size={18} /> Havola yuborish</>}
            </button>

            <div className="auth-divider"><span>yoki</span></div>

            <div className="auth-link">
              <Link to="/login"><ArrowLeft size={14} /> Kirishga qaytish</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ForgotPassword
