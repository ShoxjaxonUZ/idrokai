import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Award, Download, ArrowLeft, CheckCircle2, Trophy,
  Calendar, BookOpen, ShieldCheck
} from 'lucide-react'
import { API_URL, apiGet, getToken, getUser } from '../lib/api'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import Navbar from '../components/Navbar'
import Loading from '../components/Loading'
import '../styles/certificate.css'

function Certificate({ demo = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = getUser()

  const demoUser = { id: 0, name: user?.name || 'Aziz Karimov' }
  const demoCourse = {
    id: 'demo',
    title: 'Python dasturlash asoslari',
    lessons: new Array(24).fill(0),
    darslar: 24
  }

  const [course, setCourse] = useState(demo ? demoCourse : null)
  const [loading, setLoading] = useState(!demo)
  const [passed, setPassed] = useState(demo)
  const [reason, setReason] = useState('')
  const [certInfo, setCertInfo] = useState(null)
  const [certCode, setCertCode] = useState(demo ? 'EDZ-DEMO01' : '')
  const [issuedAt, setIssuedAt] = useState(demo ? new Date().toISOString() : null)
  const [qrDataUrl, setQrDataUrl] = useState('')

  const certUser = demo ? demoUser : user

  useEffect(() => {
    if (demo) {
      document.title = "Sertifikat namunasi — Eduzy"
      return
    }
    let cancelled = false
    if (!user) { navigate('/login'); return }
    document.title = "Sertifikat — Eduzy"

    const load = async () => {
      try {
        const data = await apiGet('/api/teacher/all-courses', { auth: false })
        if (cancelled) return
        if (Array.isArray(data)) {
          const found = data.find(c => String(c.id) === String(id))
          if (found) setCourse(found)
        }
      } catch (err) { console.error(err) }

      try {
        const status = await apiGet(`/api/courses/certificate-status/${id}`)
        if (cancelled) return
        setPassed(!!status.eligible)
        setReason(status.reason || '')
        setCertInfo(status)

        // Eligible bo'lsa — sertifikatni rasman berish (DB'ga yozish)
        if (status.eligible) {
          try {
            const res = await fetch(`${API_URL}/api/certificate/issue/${id}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${getToken()}` }
            })
            const certData = await res.json()
            if (res.ok && certData.cert_code) {
              setCertCode(certData.cert_code)
              setIssuedAt(certData.issued_at)
            }
          } catch {}
        }
      } catch (err) {
        console.error(err)
        setPassed(false)
        setReason('Server tekshira olmadi')
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [id, demo])

  // QR kod generatsiya — certCode tayyor bo'lganda
  useEffect(() => {
    if (!certCode) return
    const verifyUrl = `${window.location.origin}/verify/${certCode}`
    QRCode.toDataURL(verifyUrl, {
      width: 240,
      margin: 1,
      color: { dark: '#1E1B4B', light: '#FFFFFF' }
    })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [certCode])

  const handlePrint = async () => {
    const cert = document.querySelector('.cert')
    if (!cert) return
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const canvas = await html2canvas(cert, {
        scale: 4,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        windowWidth: cert.scrollWidth,
        windowHeight: cert.scrollHeight
      })
      const imgData = canvas.toDataURL('image/png', 1.0)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST')
      pdf.save(`Eduzy-Sertifikat-${certUser.name}.pdf`)
    } catch (err) {
      console.error('PDF xatolik:', err)
      alert('PDF saqlashda xatolik: ' + err.message)
    }
  }

  const today = (issuedAt ? new Date(issuedAt) : new Date()).toLocaleDateString('uz-UZ', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  if (loading) return (
    <div><Navbar /><Loading text="Yuklanmoqda..." /></div>
  )

  if (!course) return (
    <div>
      <Navbar />
      <div style={{ textAlign: 'center', padding: '80px' }}>
        <h2>Kurs topilmadi</h2>
        <button className="btn-primary" onClick={() => navigate('/courses')}>
          <ArrowLeft size={16} /> Kurslarga qaytish
        </button>
      </div>
    </div>
  )

  if (!passed) return (
    <div>
      <Navbar />
      <div className="cert-locked">
        <div className="cert-locked-icon">
          <Trophy size={80} />
        </div>
        <h2>Sertifikat hali tayyor emas</h2>
        <p>{reason || 'Avval barcha modul testlaridan muvaffaqiyatli o\'ting'}</p>
        {certInfo?.modulesTotal > 0 && (
          <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>
            {certInfo.modulesPassed || 0} / {certInfo.modulesTotal} modul topshirilgan
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
          <button className="btn-outline" onClick={() => navigate(`/courses/${id}`)}>
            <ArrowLeft size={16} /> Kursga qaytish
          </button>
        </div>
      </div>
    </div>
  )

  const lessonsCount = course.lessons?.length || course.darslar || 0

  return (
    <div className="cert-wrapper">
      <div className="no-print">
        <Navbar />
      </div>

      <div className="cert-container">
        {demo && (
          <div className="cert-demo-banner no-print">
            <Award size={16} />
            <span>Bu — <strong>namuna sertifikat</strong>. Kursni tugatganingizda xuddi shunday, o'z ismingiz bilan beriladi.</span>
          </div>
        )}

        {/* Tugmalar */}
        <div className="cert-actions no-print">
          <button className="btn-outline" onClick={() => navigate(demo ? '/' : `/courses/${id}`)}>
            <ArrowLeft size={16} /> Orqaga
          </button>
          <button className="btn-primary" onClick={handlePrint}>
            <Download size={16} /> PDF yuklab olish
          </button>
        </div>

        {/* ===== PREMIUM GRADIENT SERTIFIKAT ===== */}
        <div className="cert">
          {/* Dekorativ fon elementlari */}
          <div className="cert-glow cert-glow-1"></div>
          <div className="cert-glow cert-glow-2"></div>
          <div className="cert-border-frame"></div>

          <div className="cert-inner">
            {/* Yuqori — brend */}
            <div className="cert-top">
              <div className="cert-logo">
                <div className="cert-logo-badge">
                  <Award size={26} />
                </div>
                <span className="cert-logo-text">Eduzy</span>
              </div>
              <div className="cert-kicker">CERTIFICATE OF ACHIEVEMENT</div>
            </div>

            {/* Markaz — asosiy */}
            <div className="cert-main">
              <h1 className="cert-title">SERTIFIKAT</h1>
              <p className="cert-presented">Ushbu sertifikat quyidagi shaxsga taqdim etiladi</p>
              <h2 className="cert-person">{certUser.name}</h2>
              <div className="cert-divider">
                <span className="cert-divider-dot"></span>
              </div>
              <p className="cert-achievement">
                <strong>{course.title}</strong> kursini muvaffaqiyatli yakunladi
                va barcha modul testlaridan o'tdi
              </p>
            </div>

            {/* Pastki — ma'lumotlar + QR */}
            <div className="cert-footer">
              <div className="cert-footer-info">
                <div className="cert-meta-item">
                  <Calendar size={14} />
                  <div>
                    <span className="cert-meta-label">Berilgan sana</span>
                    <span className="cert-meta-value">{today}</span>
                  </div>
                </div>
                <div className="cert-meta-item">
                  <BookOpen size={14} />
                  <div>
                    <span className="cert-meta-label">Darslar soni</span>
                    <span className="cert-meta-value">{lessonsCount} ta dars</span>
                  </div>
                </div>
                <div className="cert-meta-item">
                  <ShieldCheck size={14} />
                  <div>
                    <span className="cert-meta-label">Sertifikat ID</span>
                    <span className="cert-meta-value cert-code">{certCode || '—'}</span>
                  </div>
                </div>
              </div>

              {/* QR kod */}
              <div className="cert-qr">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Verify QR" className="cert-qr-img" />
                ) : (
                  <div className="cert-qr-placeholder"></div>
                )}
                <span className="cert-qr-label">Skanerlab tekshiring</span>
              </div>
            </div>

            <div className="cert-watermark">Eduzy</div>
          </div>
        </div>

        {certCode && !demo && (
          <p className="cert-verify-hint no-print">
            <ShieldCheck size={14} />
            Bu sertifikat haqiqiyligini <strong>{window.location.origin}/verify/{certCode}</strong> orqali tekshirish mumkin
          </p>
        )}
      </div>
    </div>
  )
}

export default Certificate
