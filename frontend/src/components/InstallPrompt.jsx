import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import './InstallPrompt.css'

const DISMISSED_KEY = 'pwa_install_dismissed'
const DISMISS_DAYS = 14

/**
 * PWA Install Prompt — Chrome/Edge/Android'da "Add to Home Screen" taklif.
 * iOS Safari'da beforeinstallprompt yo'q — boshqacha taklif kerak.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    // Dismissed bo'lganmi tekshirish (14 kun)
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed) {
      const elapsed = Date.now() - parseInt(dismissed)
      if (elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000) return
    }

    // Already installed?
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
      return
    }

    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    setIsIOS(ios)

    if (ios) {
      // iOS — beforeinstallprompt yo'q. Faqat 30 soniyadan keyin hint
      const timer = setTimeout(() => setIosHint(true), 30000)
      return () => clearTimeout(timer)
    }

    // Chrome/Edge/Android — beforeinstallprompt event
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // 10 soniyadan keyin ko'rsatish (foydalanuvchi sayt bilan tanishishi uchun)
      setTimeout(() => setShow(true), 10000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShow(false)
    if (outcome !== 'accepted') {
      localStorage.setItem(DISMISSED_KEY, Date.now().toString())
    }
  }

  const dismiss = () => {
    setShow(false)
    setIosHint(false)
    localStorage.setItem(DISMISSED_KEY, Date.now().toString())
  }

  if (isIOS && iosHint) {
    return (
      <div className="install-prompt install-prompt-ios">
        <button className="install-prompt-close" onClick={dismiss} aria-label="Yopish">
          <X size={16} />
        </button>
        <div className="install-prompt-icon">
          <Smartphone size={22} />
        </div>
        <div className="install-prompt-text">
          <strong>IdrokAI ni telefonga qo'shing</strong>
          <span>Safari'da pastdagi <b>Share</b> tugmasini bosing, so'ng <b>"Bosh ekranga qo'shish"</b></span>
        </div>
      </div>
    )
  }

  if (show && deferredPrompt) {
    return (
      <div className="install-prompt">
        <button className="install-prompt-close" onClick={dismiss} aria-label="Yopish">
          <X size={16} />
        </button>
        <div className="install-prompt-icon">
          <Smartphone size={22} />
        </div>
        <div className="install-prompt-text">
          <strong>IdrokAI ni o'rnatish</strong>
          <span>Telefon ekraniga ikona qo'shing — tezroq ishlatish uchun</span>
        </div>
        <button className="install-prompt-btn" onClick={handleInstall}>
          <Download size={14} /> O'rnatish
        </button>
      </div>
    )
  }

  return null
}
