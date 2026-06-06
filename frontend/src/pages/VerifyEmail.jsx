import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { GraduationCap, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { API_URL } from '../lib/api'
import '../styles/auth.css'

function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState('checking') // checking | success | already | error
  const [message, setMessage] = useState('')
  const ranRef = useRef(false)

  useEffect(() => {
    document.title = "Email tasdiqlash — Eduzy"
  }, [])

  useEffect(() => {
    // Token bir martagina iste'mol qilinadi — StrictMode/qayta render'da 2 marta
    // chaqirilmasligi uchun guard (aks holda 2-chi so'rov "token yo'q" deb xato beradi)
    if (ranRef.current) return
    ranRef.current = true
    if (!token) { setState('error'); setMessage('Havola noto\'g\'ri'); return }
    fetch(`${API_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const data = await r.json().catch(() => ({}))
        if (r.ok && data.verified) { setState('success'); setMessage(data.message || '') }
        else if (r.ok && data.alreadyVerified) { setState('already'); setMessage(data.message || '') }
        else { setState('error'); setMessage(data.message || 'Havola noto\'g\'ri yoki muddati o\'tgan') }
      })
      .catch(() => { setState('error'); setMessage('Server bilan bog\'lanib bo\'lmadi') })
  }, [token])

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo" style={{ justifyContent: 'center' }}>
          <div className="auth-logo-icon">
            <GraduationCap size={28} />
          </div>
          <div className="auth-logo-text">Eduzy</div>
        </div>

        {state === 'checking' && (
          <>
            <div className="auth-success-icon" style={{ color: 'var(--primary)' }}>
              <Loader2 size={48} className="spin" />
            </div>
            <h1 className="auth-title">Tasdiqlanmoqda…</h1>
            <p className="auth-sub">Emailingiz tekshirilyapti, biroz kuting</p>
          </>
        )}

        {(state === 'success' || state === 'already') && (
          <>
            <div className="auth-success-icon">
              <CheckCircle2 size={48} />
            </div>
            <h1 className="auth-title">
              {state === 'success' ? 'Email tasdiqlandi! 🎉' : 'Allaqachon tasdiqlangan'}
            </h1>
            <p className="auth-sub">
              {state === 'success'
                ? 'Tabriklaymiz! Hisobingiz faollashtirildi. Endi tizimga kirishingiz mumkin.'
                : 'Bu email allaqachon tasdiqlangan. Tizimga kiring.'}
            </p>
            <Link to="/login" className="btn-primary full auth-btn" style={{ textDecoration: 'none' }}>
              <ArrowRight size={18} /> Kirish
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="auth-success-icon" style={{ color: 'var(--danger)' }}>
              <AlertCircle size={48} />
            </div>
            <h1 className="auth-title">Tasdiqlab bo'lmadi</h1>
            <p className="auth-sub">{message || 'Havola noto\'g\'ri yoki muddati o\'tgan.'}</p>
            <Link to="/login" className="btn-primary full auth-btn" style={{ textDecoration: 'none' }}>
              Kirishga o'tish
            </Link>
            <div className="auth-link" style={{ marginTop: 14 }}>
              Yangi havola kerakmi? <Link to="/login">Login → "qayta yuborish"</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default VerifyEmail
