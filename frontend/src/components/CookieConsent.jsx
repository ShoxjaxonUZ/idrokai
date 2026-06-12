import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, X } from 'lucide-react'
import './CookieConsent.css'

const CONSENT_KEY = 'cookie_consent'

/**
 * Cookie roziligi banneri (GDPR uslubida).
 * Sayt ishlashi uchun zarur cookie'lar (auth_token, csrf_token) doim ishlatiladi.
 * Foydalanuvchi tanlovi localStorage'da 'cookie_consent' = 'all' | 'necessary'
 * sifatida saqlanadi va banner qaytarib ko'rsatilmaydi.
 */
export default function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) {
        // Sahifa yuklangach biroz keyin — kontent bilan to'qnashmasligi uchun
        const t = setTimeout(() => setShow(true), 800)
        return () => clearTimeout(t)
      }
    } catch {
      // localStorage mavjud emas (private rejim) — bannerni ko'rsatmaymiz
    }
  }, [])

  const decide = (value) => {
    try { localStorage.setItem(CONSENT_KEY, value) } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="cookie-consent" role="dialog" aria-live="polite" aria-label="Cookie roziligi">
      <div className="cookie-consent-head">
        <div className="cookie-consent-icon">
          <Cookie size={19} />
        </div>
        <strong>Cookie'lardan foydalanamiz</strong>
        <button
          className="cookie-consent-close"
          onClick={() => decide('necessary')}
          aria-label="Yopish"
        >
          <X size={15} />
        </button>
      </div>

      <p className="cookie-consent-text">
        Saytni xavfsiz va qulay qilish uchun cookie'lar ishlatiladi (kirish
        sessiyasi, xavfsizlik).{' '}
        <Link to="/privacy" className="cookie-consent-link">Batafsil</Link>
      </p>

      <div className="cookie-consent-actions">
        <button className="cookie-consent-btn-ghost" onClick={() => decide('necessary')}>
          Faqat zarurlari
        </button>
        <button className="cookie-consent-btn" onClick={() => decide('all')}>
          Qabul qilaman
        </button>
      </div>
    </div>
  )
}
