import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Mail, Lock, Eye, EyeOff, LogIn, GraduationCap,
  AlertCircle, ArrowRight, Monitor, LogOut, ShieldAlert
} from 'lucide-react'
import { API_URL } from '../lib/api'
import '../styles/auth.css'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath = location.state?.from?.pathname || '/dashboard'
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [needVerification, setNeedVerification] = useState(false)
  const [resendStatus, setResendStatus] = useState('')
  const [deviceLimit, setDeviceLimit] = useState(null)

  useEffect(() => {
    document.title = "Kirish — Eduzy"
    // Boshqa qurilmadan chiqarib yuborilgan bo'lsa — sababni ko'rsatamiz
    try {
      const reason = sessionStorage.getItem('authKickReason')
      if (reason) {
        setError(reason)
        sessionStorage.removeItem('authKickReason')
      }
    } catch {}
  }, [])

  const handleLogin = async (replaceSessionId = null) => {
    setError('')
    setNeedVerification(false)
    if (!form.email || !form.password) {
      return setError('Barcha maydonlarni to\'ldiring')
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          replaceSessionId ? { ...form, replaceSessionId } : form
        )
      })
      const data = await res.json()
      if (res.ok) {
        // Qurilma limiti — login to'xtatildi, qurilma tanlash kerak
        if (data.deviceLimitReached) {
          setDeviceLimit({ devices: data.devices || [], limit: data.limit })
          setLoading(false)
          return
        }
        setDeviceLimit(null)
        // REAL token httpOnly cookie'da (login javobi o'rnatadi). localStorage'ga
        // user obyekti + 'token' sentinel ('cookie') yoziladi — maxfiy emas.
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('token', 'cookie')

        try {
          const statusRes = await fetch(`${API_URL}/api/onboarding/status`)
          const statusData = await statusRes.json()
          if (statusData.onboarded) {
            navigate(fromPath, { replace: true })
          } else {
            navigate('/onboarding', { replace: true })
          }
        } catch {
          navigate(fromPath, { replace: true })
        }
      } else if (data.verificationRequired) {
        setNeedVerification(true)
        setError(data.message)
      } else {
        setError(data.message || 'Kirish amalga oshmadi')
      }
    } catch {
      setError('Server bilan bog\'lanib bo\'lmadi')
    }
    setLoading(false)
  }

  const handleResend = async () => {
    setResendStatus('sending')
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email })
      })
      const data = await res.json()
      setResendStatus(res.ok ? 'sent' : 'error')
      setError(data.message)
    } catch {
      setResendStatus('error')
      setError('Server xatosi')
    }
  }

  // Qurilma limiti ekrani — login to'xtatilgan, qurilma tanlash kerak
  if (deviceLimit) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <ShieldAlert size={28} />
            </div>
            <div className="auth-logo-text">Eduzy</div>
          </div>

          <h1 className="auth-title">Qurilma limiti</h1>
          <p className="auth-sub">
            Bu akkaunt allaqachon {deviceLimit.limit} ta qurilmada faol.
            Davom etish uchun bittasini chiqarib yuboring.
          </p>

          {error && (
            <div className="auth-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {deviceLimit.devices.map(d => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', border: '1px solid var(--border)',
                borderRadius: 10, background: 'var(--card)'
              }}>
                <Monitor size={22} style={{ color: 'var(--primary-light)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{d.label || 'Qurilma'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                    {d.ip || '—'}
                    {d.lastActive ? ` · ${new Date(d.lastActive).toLocaleString('uz')}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLogin(d.id)}
                  disabled={loading}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '8px 12px', background: '#dc2626', color: '#fff',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 600, flexShrink: 0, fontFamily: 'inherit'
                  }}
                >
                  <LogOut size={14} /> Chiqarish
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setDeviceLimit(null); setError('') }}
            style={{
              width: '100%', padding: '10px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 8,
              cursor: 'pointer', color: 'var(--text-soft)',
              fontFamily: 'inherit', fontWeight: 500
            }}
          >
            Bekor qilish
          </button>
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
          <div className="auth-logo-text">Eduzy</div>
        </div>

        <h1 className="auth-title">Xush kelibsiz</h1>
        <p className="auth-sub">Hisobingizga kirib, o'rganishni davom eting</p>

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} /> {error}
            {needVerification && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendStatus === 'sending'}
                style={{
                  marginTop: 12, padding: '8px 16px',
                  background: '#8b5cf6', color: 'white',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                  width: '100%', fontWeight: 500
                }}
              >
                {resendStatus === 'sending' ? 'Yuborilmoqda...' :
                 resendStatus === 'sent' ? '✓ Yuborildi' :
                 '📧 Tasdiqlash havolasini qayta yuborish'}
              </button>
            )}
          </div>
        )}

        <div className="form-group">
          <label>Email</label>
          <div className="input-with-icon">
            <Mail size={18} className="input-icon" />
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
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
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button
              type="button"
              className="input-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="auth-forgot">
          <Link to="/forgot-password">Parolni unutdingizmi?</Link>
        </div>

        <button
          className="btn-primary full auth-btn"
          onClick={() => handleLogin()}
          disabled={loading}
        >
          {loading ? (
            <>Yuklanmoqda...</>
          ) : (
            <><LogIn size={18} /> Kirish</>
          )}
        </button>

        <div className="auth-divider">
          <span>yoki</span>
        </div>

        <div className="auth-link">
          Hisobingiz yo'qmi?{' '}
          <Link to="/register" state={location.state?.from ? { from: location.state.from } : undefined}>
            Ro'yxatdan o'tish <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login