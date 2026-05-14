import { useNavigate, useLocation } from 'react-router-dom'
import { Sparkles, UserPlus, LogIn } from 'lucide-react'
import './GuestBanner.css'

/**
 * Guest user uchun sahifa boshida ko'rinadigan banner.
 * Interaktiv sahifalarda (Battle, AI Teacher, AI Quiz, Daily, Leaderboard) ishlatiladi.
 * "O'ynashni boshlash uchun ro'yxatdan o'ting" CTA.
 */
export default function GuestBanner({ title, subtitle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const from = { pathname: location.pathname }

  return (
    <div className="guest-banner">
      <div className="guest-banner-icon">
        <Sparkles size={20} />
      </div>
      <div className="guest-banner-text">
        <strong>{title || "Bu yerda ham siz uchun ko'p qiziq narsalar bor"}</strong>
        <span>{subtitle || "Ko'rib chiqing — o'ynashni boshlash uchun bepul ro'yxatdan o'ting"}</span>
      </div>
      <div className="guest-banner-actions">
        <button
          className="btn-outline btn-sm"
          onClick={() => navigate('/login', { state: { from } })}
        >
          <LogIn size={14} /> Kirish
        </button>
        <button
          className="btn-primary btn-sm guest-banner-register"
          onClick={() => navigate('/register', { state: { from } })}
        >
          <UserPlus size={14} /> Ro'yxatdan o'tish
        </button>
      </div>
    </div>
  )
}
