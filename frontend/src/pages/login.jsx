import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Mail, Lock, Eye, EyeOff, LogIn, GraduationCap,
  AlertCircle, ArrowRight
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

  useEffect(() => {
    document.title = "Kirish — IdrokAI"
  }, [])

  const handleLogin = async () => {
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
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))

        try {
          const statusRes = await fetch(`${API_URL}/api/onboarding/status`, {
            headers: { Authorization: `Bearer ${data.token}` }
          })
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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <GraduationCap size={28} />
          </div>
          <div className="auth-logo-text">IdrokAI</div>
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

        <button
          className="btn-primary full auth-btn"
          onClick={handleLogin}
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