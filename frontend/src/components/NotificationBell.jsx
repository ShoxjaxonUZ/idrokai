import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Mail, Award, Swords, Flame, Sparkles, X,
  Check, CheckCheck, Trash2
} from 'lucide-react'
import { API_URL, getToken } from '../lib/api'
import './NotificationBell.css'

const ICONS = {
  admin_reply: Mail,
  daily_remind: Flame,
  cert_ready: Award,
  battle_invite: Swords,
  system: Sparkles
}

const POLL_INTERVAL = 30_000 // 30 soniya

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)
  const pollRef = useRef(null)

  const fetchNotifs = async () => {
    const token = getToken()
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data.items)) {
        setItems(data.items)
        setUnread(data.unread || 0)
      }
    } catch {}
  }

  useEffect(() => {
    fetchNotifs()
    pollRef.current = setInterval(fetchNotifs, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [])

  // Dropdown tashqarisida bosilsa yopiladi
  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const handleItemClick = async (item) => {
    if (!item.read) {
      // optimistic update
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n))
      setUnread(u => Math.max(0, u - 1))
      try {
        const token = getToken()
        await fetch(`${API_URL}/api/notifications/${item.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch {}
    }
    if (item.link) {
      navigate(item.link)
    }
    setOpen(false)
  }

  const markAllRead = async () => {
    if (unread === 0) return
    setLoading(true)
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
    try {
      const token = getToken()
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch {}
    setLoading(false)
  }

  const deleteAll = async () => {
    if (items.length === 0) return
    if (!confirm("Barcha bildirishnomalarni o'chirasizmi?")) return
    setItems([])
    setUnread(0)
    try {
      const token = getToken()
      await fetch(`${API_URL}/api/notifications`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch {}
  }

  const formatTime = (ts) => {
    try {
      const d = new Date(ts)
      const now = new Date()
      const diff = (now - d) / 1000
      if (diff < 60) return 'hozir'
      if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`
      if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`
      if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} kun oldin`
      return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' })
    } catch { return '' }
  }

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        className="notif-bell-btn"
        onClick={() => setOpen(o => !o)}
        title="Bildirishnomalar"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="notif-bell-badge">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <div
              className="notif-dropdown-title"
              onClick={() => { navigate('/notifications'); setOpen(false) }}
              style={{ cursor: 'pointer' }}
              title="To'liq tarix"
            >
              <Bell size={16} />
              <strong>Bildirishnomalar</strong>
              {unread > 0 && <span className="notif-count-chip">{unread}</span>}
            </div>
            <div className="notif-dropdown-actions">
              {unread > 0 && (
                <button
                  className="notif-action-btn"
                  onClick={markAllRead}
                  disabled={loading}
                  title="Hammasini o'qilgan deb belgilash"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              {items.length > 0 && (
                <button
                  className="notif-action-btn notif-action-danger"
                  onClick={deleteAll}
                  title="Hammasini o'chirish"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                className="notif-action-btn"
                onClick={() => setOpen(false)}
                title="Yopish"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">
                <Bell size={28} />
                <p>Hozircha bildirishnomalar yo'q</p>
                <span>Yangi xabar bo'lsa shu yerda ko'rinadi</span>
              </div>
            ) : (
              <>
              {items.map(item => {
                const Icon = ICONS[item.type] || (
                  item.icon === 'mail' ? Mail :
                  item.icon === 'award' ? Award :
                  item.icon === 'swords' ? Swords :
                  item.icon === 'flame' ? Flame :
                  Sparkles
                )
                return (
                  <div
                    key={item.id}
                    className={`notif-item ${item.read ? '' : 'notif-unread'}`}
                    onClick={() => handleItemClick(item)}
                  >
                    <div className="notif-icon-wrap">
                      <Icon size={16} />
                      {!item.read && <span className="notif-dot"></span>}
                    </div>
                    <div className="notif-content">
                      <div className="notif-title">{item.title}</div>
                      {item.message && (
                        <div className="notif-message">{item.message}</div>
                      )}
                      <div className="notif-time">{formatTime(item.created_at)}</div>
                    </div>
                  </div>
                )
              })}
              <button
                className="notif-view-all"
                onClick={() => { navigate('/notifications'); setOpen(false) }}
              >
                Hammasini ko'rish →
              </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
