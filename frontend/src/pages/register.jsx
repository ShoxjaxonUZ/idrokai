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
  const [form, setForm] = useState({ name: '', email: '', password: '', telegram_chat_id: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

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
    if (!form.name || !form.email || !form.password || !form.telegram_chat_id) {
      return setError('Barcha maydonlarni to\'ldiring')
    }
    if (form.password.length < 8) {
      return setError('Parol kamida 8 ta belgi bo\'lishi kerak')
    }
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return setError('Parolda harf ham, raqam ham bo\'lishi kerak')
    }
    if (!/^-?\d{5,20}$/.test(form.telegram_chat_id.trim())) {
      return setError('Telegram chat ID faqat raqamlardan iborat (5-20 belgi)')
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          telegram_chat_id: form.telegram_chat_id.trim()
        })
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

  const handleVerifyCode = async () => {
    setError('')
    if (!/^\d{6}$/.test(code)) {
      return setError('Kod 6 raqamdan iborat bo\'lishi kerak')
    }
    setVerifying(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code })
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Tasdiqlandi! Endi tizimga kiring.')
        navigate('/login')
      } else {
        setError(data.message || 'Kod noto\'g\'ri')
      }
    } catch {
      setError('Server xatosi')
    }
    setVerifying(false)
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
            background: 'rgba(34, 158, 217, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <span style={{ fontSize: 40 }}>📲</span>
          </div>
          <h1 className="auth-title">Telegram'ni tekshiring</h1>
          <p style={{ color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
            Sizning Telegram'ingizga <strong>6 raqamli kod</strong> yubordik.<br />
            Kodni quyiga kiriting.
          </p>

          {error && (
            <div className="auth-error" style={{ marginBottom: 16 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="form-group">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
              placeholder="123456"
              style={{
                fontSize: 28, textAlign: 'center', letterSpacing: 8,
                fontWeight: 700, padding: '14px 16px'
              }}
              autoFocus
            />
          </div>

          <button
            className="btn-primary full"
            onClick={handleVerifyCode}
            disabled={verifying || code.length !== 6}
            style={{ marginBottom: 12 }}
          >
            {verifying ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
          </button>

          <button className="btn-outline full" onClick={resendVerification} style={{ marginBottom: 12 }}>
            Kodni qayta yuborish
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
          <label>Telegram chat ID</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.telegram_chat_id}
            onChange={e => setForm({ ...form, telegram_chat_id: e.target.value.replace(/[^\d-]/g, '') })}
            placeholder="masalan: 5272168689"
            onKeyDown={e => e.key === 'Enter' && handleRegister()}
          />
          <small style={{ display: 'block', marginTop: 6, color: '#666', fontSize: 12, lineHeight: 1.5 }}>
            💡 <strong>Qanday topish kerak:</strong>
            <br />
            1. Telegramda <a href="https://t.me/userinfobot" target="_blank" rel="noopener" style={{ color: '#8b5cf6' }}>@userinfobot</a> ni oching
            <br />
            2. <code>/start</code> yuboring
            <br />
            3. Bot yuborgan <strong>Id</strong> raqamini nusxalab shu yerga yopishtiring
            <br />
            <br />
            <strong>Muhim:</strong> Avval bizning <a href={`https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'idrokai_bot'}`} target="_blank" rel="noopener" style={{ color: '#8b5cf6' }}>IdrokAI botiga</a> ham <code>/start</code> yuboring — aks holda kod yetib bormaydi.
          </small>
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