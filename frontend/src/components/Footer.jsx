import { useNavigate } from 'react-router-dom'
import {
  GraduationCap, Send, Mail, MapPin, Phone, Heart,
  MessageCircle, Camera, Play
} from 'lucide-react'
import '../styles/footer.css'

function Footer() {
  const navigate = useNavigate()
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-inner">

        {/* Brand */}
        <div className="footer-brand">
          <div className="footer-logo-wrap">
            <div className="footer-logo-icon">
              <GraduationCap size={20} />
            </div>
            <span className="footer-logo">Eduzy</span>
          </div>
          <p className="footer-desc">
            O'zbek tilida zamonaviy ta'lim platformasi. Dasturlash, matematika, til o'rganish va boshqa ko'plab kurslar.
          </p>
          <div className="footer-socials">
            <a href="#" className="social-btn" title="Telegram" rel="noopener noreferrer nofollow">
              <Send size={16} />
            </a>
            <a href="#" className="social-btn" title="Instagram" rel="noopener noreferrer nofollow">
              <Camera size={16} />
            </a>
            <a href="#" className="social-btn" title="Chat" rel="noopener noreferrer nofollow">
              <MessageCircle size={16} />
            </a>
            <a href="#" className="social-btn" title="YouTube" rel="noopener noreferrer nofollow">
              <Play size={16} />
            </a>
          </div>
        </div>

        {/* Links */}
        <div className="footer-links">
          <div className="footer-col">
            <h4>Platforma</h4>
            <ul>
              <li onClick={() => navigate('/courses')}>Barcha kurslar</li>
              <li onClick={() => navigate('/battle')}>Code Battle</li>
              <li onClick={() => navigate('/ai-quiz')}>AI Test</li>
              <li onClick={() => navigate('/pricing')}>Tariflar</li>
              <li onClick={() => navigate('/dashboard')}>Dashboard</li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Kompaniya</h4>
            <ul>
              <li onClick={() => navigate('/about')}>Biz haqimizda</li>
              <li onClick={() => navigate('/contact')}>Aloqa</li>
              <li onClick={() => navigate('/help')}>Yordam</li>
              <li onClick={() => navigate('/privacy')}>Maxfiylik</li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Bog'lanish</h4>
            <ul className="footer-contact">
              <li>
                <Mail size={14} />
                <a href="mailto:shoxjaxon007a@gmail.com">shoxjaxon007a@gmail.com</a>
              </li>
              <li>
                <Phone size={14} />
                <a href="tel:+998332357070">+998 33 235 70 70</a>
              </li>
              <li>
                <MapPin size={14} />
                <span>Toshkent, O'zbekiston</span>
              </li>
            </ul>
          </div>
        </div>

      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <span>© {year} Eduzy. Barcha huquqlar himoyalangan.</span>
          <span className="footer-made">Made with <Heart size={13} fill="currentColor" /> by Eduzy Team</span>
        </div>
      </div>
    </footer>
  )
}

export default Footer