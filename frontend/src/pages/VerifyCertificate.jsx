import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, ShieldX, Award, Calendar, BookOpen,
  User, ArrowRight, Loader2
} from 'lucide-react'
import { API_URL } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import '../styles/verify.css'

function VerifyCertificate() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null) // { valid, certificate }

  useEffect(() => {
    document.title = "Sertifikat tekshiruvi — Eduzy"
    const ctrl = new AbortController()
    fetch(`${API_URL}/api/certificate/verify/${encodeURIComponent(code)}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => setResult(data))
      .catch((err) => { if (err.name !== 'AbortError') setResult({ valid: false }) })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [code])

  const formatDate = (ts) => {
    try {
      return new Date(ts).toLocaleDateString('uz-UZ', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    } catch { return ts }
  }

  return (
    <div>
      <Navbar />
      <div className="verify-page">
        {loading ? (
          <div className="verify-loading">
            <Loader2 size={32} className="spin" />
            <p>Sertifikat tekshirilmoqda...</p>
          </div>
        ) : result?.valid ? (
          <div className="verify-card verify-valid">
            <div className="verify-icon verify-icon-ok">
              <ShieldCheck size={44} />
            </div>
            <div className="verify-badge verify-badge-ok">
              <ShieldCheck size={13} /> Haqiqiy sertifikat
            </div>
            <h1>Sertifikat tasdiqlandi</h1>
            <p className="verify-sub">
              Bu sertifikat Eduzy platformasi tomonidan rasman berilgan
            </p>

            <div className="verify-details">
              <div className="verify-detail-row">
                <div className="verify-detail-icon">
                  <User size={18} />
                </div>
                <div>
                  <span className="verify-detail-label">Egasi</span>
                  <span className="verify-detail-value">{result.certificate.user_name}</span>
                </div>
              </div>
              <div className="verify-detail-row">
                <div className="verify-detail-icon">
                  <BookOpen size={18} />
                </div>
                <div>
                  <span className="verify-detail-label">Kurs</span>
                  <span className="verify-detail-value">{result.certificate.course_title}</span>
                </div>
              </div>
              <div className="verify-detail-row">
                <div className="verify-detail-icon">
                  <Award size={18} />
                </div>
                <div>
                  <span className="verify-detail-label">Darslar</span>
                  <span className="verify-detail-value">{result.certificate.lessons_count} ta dars yakunlangan</span>
                </div>
              </div>
              <div className="verify-detail-row">
                <div className="verify-detail-icon">
                  <Calendar size={18} />
                </div>
                <div>
                  <span className="verify-detail-label">Berilgan sana</span>
                  <span className="verify-detail-value">{formatDate(result.certificate.issued_at)}</span>
                </div>
              </div>
            </div>

            <div className="verify-code-box">
              Sertifikat ID: <strong>{result.certificate.cert_code}</strong>
            </div>

            <button className="btn-primary verify-cta" onClick={() => navigate('/courses')}>
              <BookOpen size={16} /> Bizning kurslar bilan tanishing <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="verify-card verify-invalid">
            <div className="verify-icon verify-icon-fail">
              <ShieldX size={44} />
            </div>
            <div className="verify-badge verify-badge-fail">
              <ShieldX size={13} /> Topilmadi
            </div>
            <h1>Sertifikat topilmadi</h1>
            <p className="verify-sub">
              <strong>{code}</strong> kodli sertifikat Eduzy bazasida mavjud emas.
              Kod noto'g'ri kiritilgan yoki sertifikat haqiqiy emas.
            </p>
            <button className="btn-outline verify-cta" onClick={() => navigate('/')}>
              Bosh sahifaga qaytish
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default VerifyCertificate
