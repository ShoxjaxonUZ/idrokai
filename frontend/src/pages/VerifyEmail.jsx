import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Mail, Loader2 } from 'lucide-react'
import { API_URL } from '../lib/api'
import '../styles/auth.css'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')

  const [status, setStatus] = useState('loading') // loading | success | error | expired
  const [message, setMessage] = useState('')
  const [resending, setResending] = useState(false)
  const [resendEmail, setResendEmail] = useState('')

  useEffect(() => {
    document.title = 'Email tasdiqlash — IdrokAI'
    if (!token) {
      setStatus('error')
      setMessage('Havolada token yo\'q')
      return
    }

    const verify = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (res.ok) {
          setStatus('success')
          setMessage(data.message)
          setTimeout(() => navigate('/login'), 3000)
        } else if (data.expired) {
          setStatus('expired')
          setMessage(data.message)
        } else {
          setStatus('error')
          setMessage(data.message || 'Tasdiqlash muvaffaqiyatsiz')
        }
      } catch {
        setStatus('error')
        setMessage('Server bilan bog\'lanib bo\'lmadi')
      }
    }
    verify()
  }, [token, navigate])

  const handleResend = async (e) => {
    e.preventDefault()
    if (!resendEmail.trim()) return
    setResending(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim() })
      })
      const data = await res.json()
      alert(data.message)
    } catch {
      alert('Server xatosi')
    }
    setResending(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center', padding: '40px 32px' }}>
        {status === 'loading' && (
          <>
            <Loader2 size={56} className="spin" style={{ color: '#8b5cf6', margin: '0 auto 16px' }} />
            <h2>Tekshirilmoqda...</h2>
            <p style={{ color: '#666' }}>Iltimos, kuting</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={56} style={{ color: '#16a34a', margin: '0 auto 16px' }} />
            <h2>Muvaffaqiyatli tasdiqlandi! 🎉</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>{message}</p>
            <p style={{ color: '#999', fontSize: 13 }}>3 soniyadan keyin login sahifasiga yo'naltiriladi...</p>
            <button className="btn-primary" onClick={() => navigate('/login')} style={{ marginTop: 16 }}>
              Hozir login qilish
            </button>
          </>
        )}

        {status === 'expired' && (
          <>
            <Mail size={56} style={{ color: '#f59e0b', margin: '0 auto 16px' }} />
            <h2>Havola muddati o'tgan</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>{message}</p>
            <form onSubmit={handleResend}>
              <input
                type="email"
                placeholder="Emailingizni kiriting"
                value={resendEmail}
                onChange={e => setResendEmail(e.target.value)}
                required
                style={{ width: '100%', padding: 12, marginBottom: 12, borderRadius: 8, border: '1px solid #ddd' }}
              />
              <button type="submit" className="btn-primary" disabled={resending} style={{ width: '100%' }}>
                {resending ? 'Yuborilmoqda...' : 'Yangi havola so\'rash'}
              </button>
            </form>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={56} style={{ color: '#dc2626', margin: '0 auto 16px' }} />
            <h2>Xatolik</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>{message}</p>
            <button className="btn-outline" onClick={() => navigate('/login')}>
              Login sahifasiga qaytish
            </button>
          </>
        )}
      </div>
    </div>
  )
}
