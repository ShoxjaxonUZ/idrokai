import { useState, useEffect } from 'react'
import { Download, X, Smartphone, Tablet, Monitor } from 'lucide-react'
import './InstallPrompt.css'

const DISMISSED_KEY = 'pwa_install_dismissed'
const DISMISS_DAYS = 14

// Brend ikonasi + qurilma turi belgisi (modul darajasida — har renderda qayta yaratilmaydi)
const PromptIcon = ({ device, DeviceIcon }) => (
  <div className="install-prompt-icon">
    <img src="/icon.svg" alt="Eduzy" width="32" height="32" />
    <span className="install-prompt-device" title={device}>
      <DeviceIcon size={12} />
    </span>
  </div>
)

// Qurilma turini aniqlash — desktop / laptop / planshet / mobil
function detectDevice() {
  const ua = navigator.userAgent
  const isTablet = /iPad/.test(ua) ||
    (/Android/.test(ua) && !/Mobile/.test(ua)) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) // iPadOS 13+
  if (isTablet) return 'tablet'
  if (/iPhone|iPod|Android.*Mobile|Mobile|Windows Phone/i.test(ua)) return 'mobile'
  return 'desktop'
}

// Qurilmaga mos matn va ikona
const DEVICE_COPY = {
  mobile: {
    Icon: Smartphone,
    title: "Eduzy'ni telefonga o'rnatish",
    desc: "Bosh ekranga ikona qo'shing — ilovadek tez va qulay",
  },
  tablet: {
    Icon: Tablet,
    title: "Eduzy'ni planshetga o'rnatish",
    desc: "Bosh ekranga ikona qo'shing — ilovadek tez va qulay",
  },
  desktop: {
    Icon: Monitor,
    title: "Eduzy'ni kompyuterga o'rnatish",
    desc: "Alohida oynada ochiladi — brauzersiz, ilovadek tez",
  },
}

/**
 * PWA Install Prompt — Chrome/Edge/Android'da "Add to Home Screen" taklif.
 * iOS Safari'da beforeinstallprompt yo'q — boshqacha taklif kerak.
 * Desktop / laptop / planshet / mobil — har biriga mos ikona va matn.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [iosHint, setIosHint] = useState(false)
  const [device, setDevice] = useState('desktop')

  useEffect(() => {
    setDevice(detectDevice())

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

  const copy = DEVICE_COPY[device] || DEVICE_COPY.desktop
  const DeviceIcon = copy.Icon

  if (isIOS && iosHint) {
    const iosTitle = device === 'tablet'
      ? "Eduzy'ni planshetga qo'shing"
      : "Eduzy'ni telefonga qo'shing"
    return (
      <div className="install-prompt install-prompt-ios">
        <button className="install-prompt-close" onClick={dismiss} aria-label="Yopish">
          <X size={16} />
        </button>
        <PromptIcon device={device} DeviceIcon={DeviceIcon} />
        <div className="install-prompt-text">
          <strong>{iosTitle}</strong>
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
        <PromptIcon device={device} DeviceIcon={DeviceIcon} />
        <div className="install-prompt-text">
          <strong>{copy.title}</strong>
          <span>{copy.desc}</span>
        </div>
        <button className="install-prompt-btn" onClick={handleInstall}>
          <Download size={14} /> O'rnatish
        </button>
      </div>
    )
  }

  return null
}
