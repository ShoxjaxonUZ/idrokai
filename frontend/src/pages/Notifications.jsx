import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Mail, Award, Swords, Flame, Sparkles,
  CheckCheck, Trash2, ArrowLeft, Loader2, Filter
} from 'lucide-react'
import { API_URL, getToken } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import '../styles/notifications-page.css'

const ICONS = {
  admin_reply: Mail,
  daily_remind: Flame,
  cert_ready: Award,
  battle_invite: Swords,
  system: Sparkles
}

const TYPE_LABELS = {
  all: 'Hammasi',
  unread: "O'qilmagan",
  admin_reply: 'Admin javoblari',
  cert_ready: 'Sertifikat',
  system: 'Tizim'
}

function Notifications() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    document.title = "Bildirishnomalar — IdrokAI"
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const token = getToken()
      const res = await fetch(`${API_URL}/api/notifications?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data.items)) {
        setItems(data.items)
      }
    } catch {}
    setLoading(false)
  }

  const handleItemClick = async (item) => {
    if (!item.read) {
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n))
      try {
        const token = getToken()
        await fetch(`${API_URL}/api/notifications/${item.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch {}
    }
    if (item.link) navigate(item.link)
  }

  const markAllRead = async () => {
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    try {
      const token = getToken()
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch {}
  }

  const deleteOne = async (id, e) => {
    e.stopPropagation()
    setItems(prev => prev.filter(n => n.id !== id))
    try {
      const token = getToken()
      await fetch(`${API_URL}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch {}
  }

  const deleteAll = async () => {
    if (!confirm("Barcha bildirishnomalarni o'chirasizmi?")) return
    setItems([])
    try {
      const token = getToken()
      await fetch(`${API_URL}/api/notifications`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch {}
  }

  const filtered = items.filter(n => {
    if (filter === 'all') return true
    if (filter === 'unread') return !n.read
    return n.type === filter
  })

  const counts = {
    all: items.length,
    unread: items.filter(n => !n.read).length,
    admin_reply: items.filter(n => n.type === 'admin_reply').length,
    cert_ready: items.filter(n => n.type === 'cert_ready').length,
    system: items.filter(n => n.type === 'system').length
  }

  const formatDate = (ts) => {
    try {
      return new Date(ts).toLocaleString('uz-UZ', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    } catch { return ts }
  }

  return (
    <div>
      <Navbar />
      <div className="notif-page">
        <div className="notif-page-header">
          <button className="btn-outline btn-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Orqaga
          </button>
          <div>
            <h1><Bell size={24} /> Bildirishnomalar</h1>
            <p>Sayt yangiliklarining to'liq tarixi</p>
          </div>
          <div className="notif-page-actions">
            {counts.unread > 0 && (
              <button className="btn-outline btn-sm" onClick={markAllRead}>
                <CheckCheck size={14} /> Hammasini o'qildi
              </button>
            )}
            {items.length > 0 && (
              <button className="btn-outline btn-sm notif-page-delete" onClick={deleteAll}>
                <Trash2 size={14} /> Hammasini o'chirish
              </button>
            )}
          </div>
        </div>

        {/* Filter tablari */}
        <div className="notif-page-filters">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`notif-filter-btn ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              {counts[key] > 0 && <span className="notif-filter-count">{counts[key]}</span>}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="notif-page-empty">
            <Loader2 size={32} className="spin" />
            <p>Yuklanmoqda...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="notif-page-empty">
            <Bell size={48} />
            <h3>Bildirishnomalar yo'q</h3>
            <p>Yangi xabar bo'lsa shu yerda ko'rinadi</p>
          </div>
        ) : (
          <div className="notif-page-list">
            {filtered.map(item => {
              const Icon = ICONS[item.type] || Sparkles
              return (
                <div
                  key={item.id}
                  className={`notif-page-item ${item.read ? '' : 'notif-page-unread'}`}
                  onClick={() => handleItemClick(item)}
                >
                  <div className="notif-page-icon">
                    <Icon size={18} />
                  </div>
                  <div className="notif-page-content">
                    <div className="notif-page-title">{item.title}</div>
                    {item.message && <div className="notif-page-msg">{item.message}</div>}
                    <div className="notif-page-time">{formatDate(item.created_at)}</div>
                  </div>
                  {!item.read && <span className="notif-page-dot"></span>}
                  <button
                    className="notif-page-del-btn"
                    onClick={(e) => deleteOne(item.id, e)}
                    title="O'chirish"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

export default Notifications
