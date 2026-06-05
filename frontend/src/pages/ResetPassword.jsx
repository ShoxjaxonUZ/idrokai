import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, GraduationCap, AlertCircle, CheckCircle2, KeyRound, ArrowLeft } from 'lucide-react'
import { API_URL } from '../lib/api'
import '../styles/auth.css'

function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [tokenState, setTokenState] = useState('checking') // checking | valid | invalid

  useEffect(() => {
    document.title = "Yangi parol — Eduzy"
  }, [])

  useEffect(() => {
    if (!token) { setTokenState('invalid'); return }
    let cancelled = false
    fetch(`${API_URL}/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setTokenState(d.valid ? 'valid' : 'invalid') })
      .catch(() => { if (!cancelled) setTokenState('invalid') })
    return () => { cancelled = true }
  }, [token])

  const handleSubmit = async () => {
    setError('')
    if (password.length < 8) return setError('Parol kamida 8 belgidan iborat bo\'lsin')
    if (password !== confirm) return setError('Parollar mos kelmadi')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setDone(true)
        setTimeout(() => navigate('/login', { replace: true }), 2500)
      } else {
        if (data.expired) setTokenState('invalid')
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

        {tokenState === 'checking' && (
          <>
            <h1 className="auth-title">Tekshirilmoqda…</h1>
            <p className="auth-sub">Havola tekshirilyapti, biroz kuting</p>
          </>
        )}

        {tokenState === 'invalid' && (
          <>
            <div className="auth-error" style={{ justifyContent: 'center' }}>
              <AlertCircle size={16} /> Havola noto'g'ri yoki muddati o'tgan
            </div>
            <p className="auth-sub" style={{ marginTop: 16 }}>
              Iltimos, yangi tiklash havolasini so'rang.
            </p>
            <Link to="/forgot-password" className="btn-primary full auth-btn" style={{ textDecoration: 'none' }}>
              <KeyRound size={18} /> Yangi havola so'rash
            </Link>
            <div className="auth-divider"><span>yoki</span></div>
            <div className="auth-link">
              <Link to="/login"><ArrowLeft size={14} /> Kirishga qaytish</Link>
            </div>
          </>
        )}

        {tokenState === 'valid' && done && (
          <>
            <div className="auth-success-icon">
              <CheckCircle2 size={48} />
            </div>
            <h1 className="auth-title">Parol yangilandi!</h1>
            <p className="auth-sub">Endi yangi parolingiz bilan kirishingiz mumkin. Kirish sahifasiga yo'naltirilyapsiz…</p>
            <Link to="/login" className="btn-primary full auth-btn" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={18} /> Kirish
            </Link>
          </>
        )}

        {tokenState === 'valid' && !done && (
          <>
            <h1 className="auth-title">Yangi parol o'rnating</h1>
            <p className="auth-sub">Hisobingiz uchun yangi, kuchli parol kiriting</p>

            {error && (
              <div className="auth-error">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="form-group">
              <label>Yangi parol</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button type="button" className="input-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Parolni takrorlang</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            </div>

            <button
              className="btn-primary full auth-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <>Saqlanmoqda...</> : <><KeyRound size={18} /> Parolni yangilash</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default ResetPassword
