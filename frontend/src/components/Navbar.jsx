import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import {
  GraduationCap, Sun, Moon, Menu, Settings,
  User, LayoutDashboard, LogOut, BookOpen, Swords, Bot, Trophy, Crown, Users, Briefcase, MessageCircle
} from 'lucide-react'
import { getUser, clearAuth, apiPost, API_URL } from '../lib/api'
import NotificationBell from './NotificationBell'
import '../styles/navbar.css'

const initial = (name) => {
  if (!name || typeof name !== 'string') return '?'
  const c = name.trim()[0]
  return c ? c.toUpperCase() : '?'
}

function Navbar() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const closeTimeoutRef = useRef(null)
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const [msgUnread, setMsgUnread] = useState(0)

  // Xabarlar o'qilmagan soni — fetch + real-time (window 'eduzy:message'/'eduzy:msg-read')
  useEffect(() => {
    if (!user?.id) return
    let alive = true
    const refresh = () => {
      fetch(`${API_URL}/api/messages/unread-count`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (alive && d) setMsgUnread(d.unread || 0) })
        .catch(() => {})
    }
    refresh()
    window.addEventListener('eduzy:message', refresh)
    window.addEventListener('eduzy:msg-read', refresh)
    return () => {
      alive = false
      window.removeEventListener('eduzy:message', refresh)
      window.removeEventListener('eduzy:msg-read', refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Scroll holati — landing'da navbar hero ortidan o'tgach oqaradi
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > window.innerHeight - 100)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goTo = (path) => {
    navigate(path)
    setMenuOpen(false)
    setDropdownOpen(false)
  }

  const handleLogout = async () => {
    // Joriy qurilma sessiyasini serverdan ham o'chirish
    try { await apiPost('/api/auth/logout') } catch {}
    clearAuth()
    navigate('/')
    setMenuOpen(false)
    setDropdownOpen(false)
  }

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
    }
    setDropdownOpen(true)
  }

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setDropdownOpen(false)
    }, 300)
  }

  return (
    <>
      <header className="navbar-wrap">
        {/* frosted glass strip — fixed navbar orqasida blur effekti uchun */}
        <div className="navbar-backdrop" aria-hidden="true" />
        <nav className={`navbar ${scrolled ? 'is-scrolled' : ''}`}>

          {/* Logo */}
          <div className="nav-logo" onClick={() => navigate('/')}>
            <div className="logo-icon">
              <GraduationCap size={22} />
            </div>
            <span className="logo-text">Eduzy</span>
          </div>

          {/* Center links — guest ham ko'ra oladi (preview) */}
          <div className="nav-center">
            <span onClick={() => goTo('/courses')}>Kurslar</span>
            <span onClick={() => goTo('/daily')}>Kunlik</span>
            <span onClick={() => goTo('/battle')}>Battle</span>
            <span onClick={() => goTo('/ai-teacher')}>AI Teacher</span>
            <span onClick={() => goTo('/leaderboard')}>Reyting</span>
            {user && <span onClick={() => goTo('/friends')}>Do'stlar</span>}
            <span onClick={() => goTo('/pricing')}>Tariflar</span>
          </div>

          {/* Right */}
          <div className="nav-right">
            {/* Theme toggle */}
            <button className="theme-toggle" onClick={toggleTheme} title="Rejimni o'zgartirish">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {user ? (
              <>
                <button className="theme-toggle" onClick={() => goTo('/messages')} title="Xabarlar" style={{ position: 'relative' }}>
                  <MessageCircle size={18} />
                  {msgUnread > 0 && (
                    <span style={{ position: 'absolute', top: -2, right: -2, background: '#EC4899', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                      {msgUnread > 99 ? '99+' : msgUnread}
                    </span>
                  )}
                </button>
                <NotificationBell />
                <button className="nav-dashboard" onClick={() => goTo('/dashboard')}>
                  Dashboard
                </button>

                {/* Avatar + Dropdown */}
                <div
                  className="nav-avatar-wrap"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="nav-avatar">
                    {initial(user.name)}
                  </div>

                  {dropdownOpen && (
                    <div className="nav-dropdown">
                      <div className="dropdown-header">
                        <div className="dropdown-avatar">
                          {initial(user.name)}
                        </div>
                        <div>
                          <div className="dropdown-name">{user.name || 'Foydalanuvchi'}</div>
                          <div className="dropdown-email">{user.email}</div>
                        </div>
                      </div>
                      <div className="dropdown-divider"></div>
                      <button className="dropdown-item" onClick={() => goTo('/profile')}>
                        <User size={16} /> Profil
                      </button>
                      <button className="dropdown-item" onClick={() => goTo('/portfolio')}>
                        <Briefcase size={16} /> Portfelim
                      </button>
                      {isAdmin && (
                        <button className="dropdown-item" onClick={() => goTo('/admin')}>
                          <Settings size={16} /> Admin panel
                        </button>
                      )}
                      <div className="dropdown-divider"></div>
                      <button className="dropdown-item dropdown-logout" onClick={handleLogout}>
                        <LogOut size={16} /> Chiqish
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button className="btn-outline" onClick={() => goTo('/login')}>Kirish</button>
                <button className="btn-primary" onClick={() => goTo('/register')}>Ro'yxatdan o'tish</button>
              </>
            )}

            {/* Hamburger (mobile) */}
            <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
              <Menu size={22} />
            </button>
          </div>
        </nav>
      </header>
      {/* Spacer — body padding-top o'rniga: fixed navbar uchun joy ajratadi.
          Hero sahifalar negativ margin orqali bu joyni o'rab oladi (gradient extension) */}
      <div className="navbar-spacer" aria-hidden="true" />

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mobile-menu" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu-inner" onClick={e => e.stopPropagation()}>
            {user && (
              <div className="mobile-user">
                <div className="mobile-avatar">{initial(user.name)}</div>
                <div>
                  <div className="mobile-name">{user.name || 'Foydalanuvchi'}</div>
                  <div className="mobile-email">{user.email}</div>
                </div>
              </div>
            )}

            <div className="mobile-links">
              <button onClick={() => goTo('/courses')}>
                <BookOpen size={18} /> Kurslar
              </button>
              <button onClick={() => goTo('/battle')}>
                <Swords size={18} /> Battle
              </button>
              <button onClick={() => goTo('/ai-teacher')}>
                <Bot size={18} /> AI Teacher
              </button>
              <button onClick={() => goTo('/leaderboard')}>
                <Trophy size={18} /> Reyting
              </button>
              <button onClick={() => goTo('/ai-quiz')}>
                <Bot size={18} /> AI Test
              </button>
              <button onClick={() => goTo('/pricing')}>
                <Crown size={18} /> Tariflar
              </button>
              {user && (
                <>
                  <button onClick={() => goTo('/dashboard')}>
                    <LayoutDashboard size={18} /> Dashboard
                  </button>
                  <button onClick={() => goTo('/friends')}>
                    <Users size={18} /> Do'stlar
                  </button>
                  <button onClick={() => goTo('/messages')}>
                    <MessageCircle size={18} /> Xabarlar
                  </button>
                  <button onClick={() => goTo('/profile')}>
                    <User size={18} /> Profil
                  </button>
                  <button onClick={() => goTo('/portfolio')}>
                    <Briefcase size={18} /> Portfelim
                  </button>
                </>
              )}
              {isAdmin && (
                <button onClick={() => goTo('/admin')}>
                  <Settings size={18} /> Admin panel
                </button>
              )}
              <button onClick={toggleTheme}>
                {theme === 'dark' ? (
                  <><Sun size={18} /> Kunduzgi rejim</>
                ) : (
                  <><Moon size={18} /> Tungi rejim</>
                )}
              </button>
            </div>

            <div className="mobile-actions">
              {!user ? (
                <>
                  <button className="btn-outline" onClick={() => goTo('/login')}>Kirish</button>
                  <button className="btn-primary" onClick={() => goTo('/register')}>
                    Ro'yxatdan o'tish
                  </button>
                </>
              ) : (
                <button className="btn-danger-outline" onClick={handleLogout}>
                  <LogOut size={18} /> Chiqish
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Navbar