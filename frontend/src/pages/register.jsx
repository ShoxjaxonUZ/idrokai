import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  User, Mail, Lock, Eye, EyeOff, UserPlus, GraduationCap,
  AlertCircle, ArrowRight, CheckCircle2
} from 'lucide-react'
import { API_URL } from '../lib/api'
import '../styles/auth.css'

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)

  useEffect(() => {
    document.title = "Ro'yxatdan o'tish — IdrokAI"
  }, [])

  const passwordStrength = () => {
    const pw = form.password
    if (!pw) return { level: 0, text: '', color: '' }
    const hasLetter = /[A-Za-z]/.test(pw)
    const hasDigit = /\d/.test(pw)
    if (pw.length < 8) return { level: 1, text: 'Juda kuchsiz (kamida 8 belgi)', color: '#ef4444' }
    if (!hasLetter || !hasDigit) return { level: 2, text: 'Harf va raqam kerak', color: '#f59e0b' }
    if (pw.length < 12) return { level: 3, text: 'Yaxshi', color: '#22c55e' }
    return { level: 4, text: 'Juda kuchli', color: '#16a34a' }
  }

  const strength = passwordStrength()

  const handleRegister = async () => {
    setError('')
    if (!form.name || !form.email || !form.password) {
      return setError('Barcha maydonlarni to\'ldiring')
    }
    if (form.password.length < 8) {
      return setError('Parol kamida 8 ta belgi bo\'lishi kerak')
    }
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return setError('Parolda harf ham, raqam ham bo\'lishi kerak')
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (res.ok) {
        if (data.verificationRequired) {
          setVerificationSent(true)
        } else if (data.token) {
          localStorage.setItem('token', data.token)
          localStorage.setItem('user', JSON.stringify(data.user))
          navigate('/onboarding')
        }
      } else {
        setError(data.message || 'Ro\'yxatdan o\'tishda xatolik')
      }
    } catch {
      setError('Server bilan bog\'lanib bo\'lmadi')
    }
    setLoading(false)
  }

  const resendVerification = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email })
      })
      const data = await res.json()
      alert(data.message)
    } catch {
      alert('Server xatosi')
    }
  }

  if (verificationSent) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(139, 92, 246, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <Mail size={40} color="#8b5cf6" />
          </div>
          <h1 className="auth-title">Emailingizni tekshiring 📬</h1>
          <p style={{ color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
            <strong>{form.email}</strong> manziliga tasdiqlash havolasi yubordik.<br />
            Inboxingizni oching va havolani bosing.
          </p>
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, textAlign: 'left'
          }}>
            ⚠️ <strong>Spam papkasini ham tekshiring!</strong> Ba'zan email u yerga tushishi mumkin.
          </div>
          <button className="btn-outline full" onClick={resendVerification} style={{ marginBottom: 12 }}>
            Havolani qayta yuborish
          </button>
          <Link to="/login" style={{ display: 'block', marginTop: 16, color: '#8b5cf6' }}>
            ← Login sahifasiga qaytish
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <GraduationCap size={28} />
          </div>
          <div className="auth-logo-text">IdrokAI</div>
        </div>

        <h1 className="auth-title">Ro'yxatdan o'tish</h1>
        <p className="auth-sub">Bepul akkaunt yarating va o'rganishni boshlang</p>

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="form-group">
          <label>Ism</label>
          <div className="input-with-icon">
            <User size={18} className="input-icon" />
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ism va familiya"
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Email</label>
          <div className="input-with-icon">
            <Mail size={18} className="input-icon" />
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Parol</label>
          <div className="input-with-icon">
            <Lock size={18} className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Kamida 8 belgi (harf+raqam)"
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
            />
            <button
              type="button"
              className="input-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {form.password && (
            <div className="password-strength">
              <div className="strength-bars">
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="strength-bar"
                    style={{
                      background: i <= strength.level ? strength.color : 'var(--border)'
                    }}
                  ></div>
                ))}
              </div>
              <span style={{ color: strength.color }}>{strength.text}</span>
            </div>
          )}
        </div>

        <button
          className="btn-primary full auth-btn"
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <>Yaratilmoqda...</>
          ) : (
            <><UserPlus size={18} /> Ro'yxatdan o'tish</>
          )}
        </button>

        <div className="auth-benefits">
          <div className="benefit-item">
            <CheckCircle2 size={14} color="#22c55e" /> Bepul
          </div>
          <div className="benefit-item">
            <CheckCircle2 size={14} color="#22c55e" /> Sertifikat
          </div>
          <div className="benefit-item">
            <CheckCircle2 size={14} color="#22c55e" /> AI yordam
          </div>
        </div>

        <div className="auth-divider">
          <span>yoki</span>
        </div>

        <div className="auth-link">
          Hisobingiz bormi?{' '}
          <Link to="/login">
            Kirish <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Register