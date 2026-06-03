import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, Users, Plus, Trash2, Edit3,
  Image as ImageIcon, Upload, Video, Loader2, X, Save,
  TrendingUp, GraduationCap, BarChart3, Eye, Sparkles,
  Search, Shield, Mail, UserCheck, AlertTriangle, Check,
  XCircle, Send, ArrowLeft, Globe, Activity, Clock,
  MessageCircle, Reply, Archive, Megaphone
} from 'lucide-react'
import { API_URL, assetUrl, getUser, getToken } from '../lib/api'
import Navbar from '../components/Navbar'
import Loading from '../components/Loading'
import { useNotification } from '../context/NotificationContext'
import '../styles/admin.css'

function Admin() {
  const navigate = useNavigate()
  const { addNotification } = useNotification()
  const user = getUser()
  const token = getToken()

  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ users: 0, courses: 0, enrollments: 0 })
  const [courses, setCourses] = useState([])
  const [users, setUsers] = useState([])
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [userSearch, setUserSearch] = useState('')

  // Teacher requests
  const [teacherRequests, setTeacherRequests] = useState([])
  const [reqAction, setReqAction] = useState({}) // {id: 'approving'|'rejecting'}

  // Security
  const [securityStats, setSecurityStats] = useState(null)
  const [securityLogs, setSecurityLogs] = useState([])

  // Settings — email test
  const [emailTestTo, setEmailTestTo] = useState('')
  const [emailTesting, setEmailTesting] = useState(false)

  // Contact messages
  const [contactMessages, setContactMessages] = useState([])
  const [contactFilter, setContactFilter] = useState('all')
  const [replyDrafts, setReplyDrafts] = useState({}) // {id: 'text'}
  const [replying, setReplying] = useState({}) // {id: bool}
  const [contactLoading, setContactLoading] = useState(false)

  // Broadcast
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', link: '', audience: 'all' })
  const [broadcasting, setBroadcasting] = useState(false)
  const [recentBroadcasts, setRecentBroadcasts] = useState([])

  // Course form
  const [form, setForm] = useState({
    id: '',
    title: '',
    category: 'Dasturlash',
    daraja: 'Boshlang\'ich',
    description: '',
    about: '',
    image: '',
    lessons: []
  })

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false)

  // Video upload state per lesson
  const [uploadingVideo, setUploadingVideo] = useState({})

  // Material upload state per lesson
  const [uploadingMaterial, setUploadingMaterial] = useState({})

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/')
      return
    }
    document.title = "Admin Panel — Eduzy"
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const authHeaders = { Authorization: `Bearer ${token}` }
    try {
      const [statsRes, coursesRes, usersRes, requestsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_URL}/api/teacher/all-courses`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_URL}/api/admin/users`, { headers: authHeaders }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_URL}/api/teacher/requests`, { headers: authHeaders }).then(r => r.ok ? r.json() : []).catch(() => [])
      ])

      if (statsRes) setStats(statsRes)
      if (Array.isArray(coursesRes)) setCourses(coursesRes)
      if (Array.isArray(usersRes)) setUsers(usersRes)
      if (Array.isArray(requestsRes)) setTeacherRequests(requestsRes)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  // Contact messages
  const loadContactMessages = async () => {
    setContactLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/contact/admin/list?status=${contactFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) setContactMessages(data)
    } catch (err) {
      console.error(err)
    }
    setContactLoading(false)
  }

  const sendReply = async (msgId) => {
    const text = (replyDrafts[msgId] || '').trim()
    if (text.length < 5) {
      return addNotification("Javob kamida 5 ta belgi bo'lishi kerak", 'error')
    }
    setReplying(prev => ({ ...prev, [msgId]: true }))
    try {
      const res = await fetch(`${API_URL}/api/contact/admin/${msgId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reply: text })
      })
      const data = await res.json()
      if (res.ok) {
        addNotification(
          data.telegramSent
            ? "Javob yuborildi (saytda + Telegram)"
            : "Javob yuborildi (saytda ko'rinadi)",
          'success'
        )
        setReplyDrafts(prev => ({ ...prev, [msgId]: '' }))
        await loadContactMessages()
      } else {
        addNotification(data.message || "Xatolik", 'error')
      }
    } catch {
      addNotification("Server bilan bog'lanib bo'lmadi", 'error')
    }
    setReplying(prev => ({ ...prev, [msgId]: false }))
  }

  const changeContactStatus = async (msgId, newStatus) => {
    try {
      await fetch(`${API_URL}/api/contact/admin/${msgId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })
      setContactMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, status: newStatus } : m
      ))
    } catch {
      addNotification("Status o'zgartirib bo'lmadi", 'error')
    }
  }

  const newMessagesCount = contactMessages.filter(m => m.status === 'new').length

  // Broadcast functions
  const loadRecentBroadcasts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/admin/recent-broadcasts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) setRecentBroadcasts(data)
    } catch {}
  }

  const sendBroadcast = async () => {
    const { title, message, link, audience } = broadcastForm
    if (!title.trim() || title.trim().length < 3) {
      return addNotification("Sarlavha kamida 3 ta belgi bo'lishi kerak", 'error')
    }
    if (!confirm(`Haqiqatan ham xabarni yuborish?\n\nAuditoriya: ${audience === 'all' ? 'Hammasi' : audience === 'students' ? 'Studentlar' : 'Aktiv (7 kun)'}`)) {
      return
    }
    setBroadcasting(true)
    try {
      const res = await fetch(`${API_URL}/api/notifications/admin/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: title.trim(), message: message.trim(), link: link.trim() || null, audience })
      })
      const data = await res.json()
      if (res.ok) {
        addNotification(`${data.sent} ta foydalanuvchiga yuborildi!`, 'success')
        setBroadcastForm({ title: '', message: '', link: '', audience: 'all' })
        await loadRecentBroadcasts()
      } else {
        addNotification(data.message || 'Xatolik', 'error')
      }
    } catch {
      addNotification("Server bilan bog'lanib bo'lmadi", 'error')
    }
    setBroadcasting(false)
  }

  // Security tab — kerak bo'lganda yuklash
  const loadSecurity = async () => {
    const authHeaders = { Authorization: `Bearer ${token}` }
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/api/security/stats`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_URL}/api/security/logs?limit=100`, { headers: authHeaders }).then(r => r.ok ? r.json() : []).catch(() => [])
      ])
      if (statsRes) setSecurityStats(statsRes)
      if (Array.isArray(logsRes)) setSecurityLogs(logsRes)
    } catch (err) {
      console.error('Security load:', err)
    }
  }

  useEffect(() => {
    if (activeTab === 'messages') {
      loadContactMessages()
    }
    if (activeTab === 'broadcast') {
      loadRecentBroadcasts()
    }
    if (activeTab === 'security' && !securityStats) {
      loadSecurity()
    }
  }, [activeTab])

  // Teacher request approve/reject
  const handleRequest = async (id, status) => {
    setReqAction(prev => ({ ...prev, [id]: status === 'approved' ? 'approving' : 'rejecting' }))
    try {
      const res = await fetch(`${API_URL}/api/teacher/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      })
      const data = await res.json()
      if (res.ok) {
        addNotification(status === 'approved' ? 'Tasdiqlandi!' : 'Rad etildi', 'success')
        loadData()
      } else {
        addNotification(data.message || 'Xatolik', 'error')
      }
    } catch {
      addNotification('Server xatosi', 'error')
    }
    setReqAction(prev => ({ ...prev, [id]: null }))
  }

  // Email test
  const sendTestEmail = async () => {
    if (!emailTestTo.trim()) {
      addNotification('Email manzilini kiriting', 'error')
      return
    }
    setEmailTesting(true)
    try {
      const res = await fetch(`${API_URL}/api/security/email-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: emailTestTo.trim() })
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        addNotification(`Yuborildi (${data.provider})!`, 'success')
      } else {
        addNotification(data.message || 'Yuborishda xatolik', 'error')
      }
    } catch {
      addNotification('Server xatosi', 'error')
    }
    setEmailTesting(false)
  }

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    )
  }, [users, userSearch])

  // Statistika hisobi
  const pendingRequestsCount = teacherRequests.filter(r => r.status === 'pending').length
  const teachersCount = users.filter(u => u.role === 'teacher').length
  const totalLessons = courses.reduce((acc, c) => acc + (c.lessons?.length || 0), 0)

  const resetForm = () => {
    setForm({
      id: '',
      title: '',
      category: 'Dasturlash',
      daraja: 'Boshlang\'ich',
      description: '',
      about: '',
      image: '',
      lessons: []
    })
    setEditingCourse(null)
    setShowCourseForm(false)
  }

  const startEdit = (course) => {
    setEditingCourse(course.id)
    setForm({
      id: course.id,
      title: course.title || '',
      category: course.category || 'Dasturlash',
      daraja: course.daraja || 'Boshlang\'ich',
      description: course.description || course.desc || '',
      about: course.about || '',
      image: course.image || '',
      lessons: Array.isArray(course.lessons) ? course.lessons : []
    })
    setShowCourseForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Image upload
  const uploadImage = async (file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      addNotification('Rasm hajmi 5MB dan oshmasligi kerak', 'error')
      return
    }
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      })
      const data = await res.json()
      if (res.ok) {
        setForm(prev => ({ ...prev, image: data.url }))
        addNotification('Rasm yuklandi!', 'success')
      } else {
        addNotification(data.message || 'Yuklashda xatolik', 'error')
      }
    } catch {
      addNotification('Server xatosi', 'error')
    }
    setUploadingImage(false)
  }

  // Video upload (faqat MP4)
  const uploadVideo = async (lessonIdx, file) => {
    if (!file) return

    if (file.type !== 'video/mp4' && !file.name.toLowerCase().endsWith('.mp4')) {
      addNotification('Faqat MP4 formatdagi video yuklash mumkin!', 'error')
      return
    }
    if (file.size > 500 * 1024 * 1024) {
      addNotification('Video hajmi 500MB dan oshmasligi kerak!', 'error')
      return
    }

    setUploadingVideo(prev => ({ ...prev, [lessonIdx]: true }))
    try {
      const fd = new FormData()
      fd.append('video', file)
      const res = await fetch(`${API_URL}/api/upload/video`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      })
      const data = await res.json()
      if (res.ok) {
        const newLessons = [...form.lessons]
        newLessons[lessonIdx] = {
          ...newLessons[lessonIdx],
          videoUrl: data.url,
          videoFile: data.filename,
          videoSize: data.sizeMB
        }
        setForm({ ...form, lessons: newLessons })
        addNotification(`Video yuklandi! (${data.sizeMB} MB)`, 'success')
      } else {
        addNotification(data.message || 'Yuklashda xatolik', 'error')
      }
    } catch (err) {
      console.error(err)
      addNotification('Server bilan bog\'lanib bo\'lmadi', 'error')
    }
    setUploadingVideo(prev => ({ ...prev, [lessonIdx]: false }))
  }

  // Material upload
  const uploadMaterial = async (lessonIdx, file) => {
    if (!file) return
    setUploadingMaterial(prev => ({ ...prev, [lessonIdx]: true }))
    try {
      const fd = new FormData()
      fd.append('material', file)
      const res = await fetch(`${API_URL}/api/upload/material`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      })
      const data = await res.json()
      if (res.ok) {
        const newLessons = [...form.lessons]
        newLessons[lessonIdx] = {
          ...newLessons[lessonIdx],
          materialUrl: data.url,
          materialName: file.name
        }
        setForm({ ...form, lessons: newLessons })
        addNotification('Material yuklandi!', 'success')
      }
    } catch {
      addNotification('Material yuklashda xatolik', 'error')
    }
    setUploadingMaterial(prev => ({ ...prev, [lessonIdx]: false }))
  }

  const removeLessonVideo = (lessonIdx) => {
    const newLessons = [...form.lessons]
    newLessons[lessonIdx] = {
      ...newLessons[lessonIdx],
      videoUrl: '',
      videoFile: '',
      videoSize: 0
    }
    setForm({ ...form, lessons: newLessons })
  }

  const addLesson = () => {
    setForm({
      ...form,
      lessons: [...form.lessons, { title: '', videoUrl: '', description: '', materialUrl: '' }]
    })
  }

  const removeLesson = (idx) => {
    const newLessons = form.lessons.filter((_, i) => i !== idx)
    setForm({ ...form, lessons: newLessons })
  }

  const saveCourse = async () => {
    console.log('Saving form:', form)
  console.log('Lessons:', form.lessons)
    if (!form.id || !form.title) {
      addNotification('ID va sarlavha to\'ldirilishi kerak', 'error')
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          darslar: form.lessons.length
        })
      })

      if (res.ok) {
        addNotification(editingCourse ? 'Kurs yangilandi!' : 'Kurs yaratildi!', 'success')
        resetForm()
        loadData()
      } else {
        const data = await res.json()
        addNotification(data.message || 'Xatolik', 'error')
      }
    } catch {
      addNotification('Server xatosi', 'error')
    }
  }

  const deleteCourse = async (id) => {
    if (!confirm('Kursni o\'chirishni xohlaysizmi?')) return
    try {
      const res = await fetch(`${API_URL}/api/admin/courses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        addNotification('Kurs o\'chirildi', 'success')
        loadData()
      }
    } catch {
      addNotification('Xatolik', 'error')
    }
  }

  if (loading) return (
    <div><Navbar /><Loading text="Admin panel yuklanmoqda..." /></div>
  )

  return (
    <div>
      <Navbar />
      <div className="admin-page">

        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <div className="admin-brand-icon"><Sparkles size={20} /></div>
            <div className="admin-brand-text">
              <strong>Admin Panel</strong>
              <span>Eduzy boshqaruvi</span>
            </div>
          </div>

          {user && (
            <div className="admin-profile-mini">
              <div className="admin-profile-avatar">{user.name?.[0]?.toUpperCase() || 'A'}</div>
              <div className="admin-profile-info">
                <div className="admin-profile-name">{user.name || 'Admin'}</div>
                <div className="admin-profile-role"><Shield size={10} /> Administrator</div>
              </div>
            </div>
          )}

          <nav className="admin-nav">
            <div className="admin-nav-section">Asosiy</div>
            <button
              className={`admin-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>
            <button
              className={`admin-nav-btn ${activeTab === 'courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('courses')}
            >
              <BookOpen size={18} /> Kurslar
              <span className="admin-nav-badge">{courses.length}</span>
            </button>
            <button
              className={`admin-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={18} /> Foydalanuvchilar
              <span className="admin-nav-badge">{users.length}</span>
            </button>

            <div className="admin-nav-section">Boshqaruv</div>
            <button
              className={`admin-nav-btn ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              <UserCheck size={18} /> O'qituvchi arizalari
              {pendingRequestsCount > 0 && (
                <span className="admin-nav-badge admin-nav-badge-warning">{pendingRequestsCount}</span>
              )}
            </button>
            <button
              className={`admin-nav-btn ${activeTab === 'messages' ? 'active' : ''}`}
              onClick={() => setActiveTab('messages')}
            >
              <MessageCircle size={18} /> Xabarlar
              {newMessagesCount > 0 && (
                <span className="admin-nav-badge admin-nav-badge-warning">{newMessagesCount}</span>
              )}
            </button>
            <button
              className={`admin-nav-btn ${activeTab === 'broadcast' ? 'active' : ''}`}
              onClick={() => setActiveTab('broadcast')}
            >
              <Megaphone size={18} /> E'lon yuborish
            </button>
            <button
              className={`admin-nav-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Shield size={18} /> Xavfsizlik
            </button>
            <button
              className={`admin-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Mail size={18} /> Sozlamalar
            </button>
          </nav>

          <div className="admin-sidebar-footer">
            <button className="btn-outline" onClick={() => navigate('/')}>
              <ArrowLeft size={14} /> Saytga qaytish
            </button>
          </div>
        </aside>

        <main className="admin-main">
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="admin-content">
              <div className="admin-page-header">
                <div>
                  <h1>Dashboard</h1>
                  <p>Platformangiz holati bir qarashda</p>
                </div>
                <div className="admin-header-actions">
                  <button className="btn-outline btn-small" onClick={loadData}>
                    <Activity size={14} /> Yangilash
                  </button>
                </div>
              </div>

              {pendingRequestsCount > 0 && (
                <div className="admin-alert admin-alert-warning">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>{pendingRequestsCount} ta o'qituvchi arizasi</strong> ko'rib chiqishni kutmoqda
                  </div>
                  <button className="btn-small" onClick={() => setActiveTab('requests')}>
                    Ko'rish →
                  </button>
                </div>
              )}

              <div className="admin-stats">
                <div className="admin-stat-card">
                  <div className="admin-stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
                    <Users size={22} />
                  </div>
                  <div>
                    <div className="admin-stat-value">{stats.users}</div>
                    <div className="admin-stat-label">Foydalanuvchilar</div>
                    <div className="admin-stat-sub">{teachersCount} o'qituvchi</div>
                  </div>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-icon" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
                    <BookOpen size={22} />
                  </div>
                  <div>
                    <div className="admin-stat-value">{stats.courses}</div>
                    <div className="admin-stat-label">Kurslar</div>
                    <div className="admin-stat-sub">{totalLessons} dars jami</div>
                  </div>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                    <GraduationCap size={22} />
                  </div>
                  <div>
                    <div className="admin-stat-value">{stats.enrollments || 0}</div>
                    <div className="admin-stat-label">Yozilishlar</div>
                    <div className="admin-stat-sub">
                      {users.length > 0
                        ? `${(((stats.enrollments || 0) / users.length)).toFixed(1)} o'rtacha/user`
                        : 'Hali yo\'q'}
                    </div>
                  </div>
                </div>

                <div className="admin-stat-card">
                  <div className="admin-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                    <UserCheck size={22} />
                  </div>
                  <div>
                    <div className="admin-stat-value">{pendingRequestsCount}</div>
                    <div className="admin-stat-label">Pending arizalar</div>
                    <div className="admin-stat-sub">{teacherRequests.length} jami</div>
                  </div>
                </div>
              </div>

              <div className="admin-dashboard-grid">
                <div className="admin-section">
                  <div className="admin-section-header">
                    <h3><BookOpen size={18} /> So'nggi kurslar</h3>
                    <button className="btn-link" onClick={() => setActiveTab('courses')}>
                      Hammasi →
                    </button>
                  </div>
                  <div className="admin-recent-list">
                    {courses.length === 0 ? (
                      <div className="admin-recent-empty">Hali kurslar yo'q</div>
                    ) : (
                      courses.slice(0, 5).map(c => (
                        <div key={c.id} className="admin-recent-item">
                          <div className="admin-recent-thumb">
                            {c.image ? (
                              <img src={assetUrl(c.image)} alt={c.title} />
                            ) : (
                              <BookOpen size={20} />
                            )}
                          </div>
                          <div className="admin-recent-info">
                            <div className="admin-recent-title">{c.title}</div>
                            <div className="admin-recent-meta">
                              {c.category} • {c.daraja} • {c.lessons?.length || 0} dars
                            </div>
                          </div>
                          <button className="btn-outline btn-small" onClick={() => {
                            setActiveTab('courses')
                            setTimeout(() => startEdit(c), 100)
                          }}>
                            <Edit3 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="admin-section">
                  <div className="admin-section-header">
                    <h3><Users size={18} /> Yangi foydalanuvchilar</h3>
                    <button className="btn-link" onClick={() => setActiveTab('users')}>
                      Hammasi →
                    </button>
                  </div>
                  <div className="admin-recent-list">
                    {users.length === 0 ? (
                      <div className="admin-recent-empty">Hali userlar yo'q</div>
                    ) : (
                      users.slice(0, 5).map(u => (
                        <div key={u.id} className="admin-recent-item">
                          <div className="admin-user-avatar" style={{
                            background: `linear-gradient(135deg, hsl(${u.id * 60 % 360}, 70%, 60%), hsl(${(u.id * 60 + 60) % 360}, 70%, 50%))`
                          }}>
                            {u.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="admin-recent-info">
                            <div className="admin-recent-title">{u.name}</div>
                            <div className="admin-recent-meta">
                              {u.email} • <span className={`admin-role-mini role-${u.role}`}>{u.role}</span>
                            </div>
                          </div>
                          <div className="admin-recent-date">
                            <Clock size={11} /> {new Date(u.created_at).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* COURSES */}
          {activeTab === 'courses' && (
            <div className="admin-content">
              <div className="admin-page-header">
                <div>
                  <h1>Kurslar</h1>
                  <p>Barcha kurslarni boshqarish</p>
                </div>
                {!showCourseForm && (
                  <button className="btn-primary" onClick={() => setShowCourseForm(true)}>
                    <Plus size={16} /> Yangi kurs
                  </button>
                )}
              </div>

              {/* Course Form */}
              {showCourseForm && (
                <div className="admin-form-card">
                  <div className="admin-form-header">
                    <h3>{editingCourse ? 'Kursni tahrirlash' : 'Yangi kurs qo\'shish'}</h3>
                    <button className="btn-icon" onClick={resetForm}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Kurs ID (URL uchun)</label>
                      <input
                        type="text"
                        value={form.id}
                        onChange={e => setForm({ ...form, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        placeholder="masalan: python-asoslari"
                        disabled={!!editingCourse}
                      />
                    </div>
                    <div className="form-group">
                      <label>Sarlavha</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder="Kurs nomi"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Kategoriya</label>
                      <select
                        value={form.category}
                        onChange={e => setForm({ ...form, category: e.target.value })}
                      >
                        <option>Dasturlash</option>
                        <option>Matematika</option>
                        <option>Fizika</option>
                        <option>Til o'rganish</option>
                        <option>Dizayn</option>
                        <option>Biznes</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Daraja</label>
                      <select
                        value={form.daraja}
                        onChange={e => setForm({ ...form, daraja: e.target.value })}
                      >
                        <option>Boshlang'ich</option>
                        <option>O'rta</option>
                        <option>Yuqori</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Qisqa tavsif</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="Bir-ikki jumla"
                    />
                  </div>

                  <div className="form-group">
                    <label>To'liq haqida</label>
                    <textarea
                      value={form.about}
                      onChange={e => setForm({ ...form, about: e.target.value })}
                      placeholder="Kurs haqida batafsil..."
                      rows={4}
                    />
                  </div>

                  {/* Image upload */}
                  <div className="form-group">
                    <label>Kurs rasmi (max 5MB)</label>
                    {form.image ? (
                      <div className="image-uploaded">
                        <img src={assetUrl(form.image)} alt="Preview" />
                        <button
                          type="button"
                          className="btn-outline btn-small"
                          onClick={() => setForm({ ...form, image: '' })}
                        >
                          <X size={14} /> O'chirish
                        </button>
                      </div>
                    ) : (
                      <div className="upload-box">
                        <input
                          type="file"
                          accept="image/*"
                          id="image-upload"
                          onChange={e => uploadImage(e.target.files[0])}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="image-upload" className="upload-label">
                          {uploadingImage ? (
                            <>
                              <Loader2 size={32} className="spin-icon" />
                              <span>Yuklanmoqda...</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon size={32} />
                              <span>Rasm tanlash</span>
                              <small>JPG, PNG, WEBP — max 5MB</small>
                            </>
                          )}
                        </label>
                      </div>
                    )}
                  </div>

                  {/* LESSONS */}
                  <div className="form-group">
                    <div className="lessons-header">
                      <label>Darslar ({form.lessons.length})</label>
                      <button type="button" className="btn-outline btn-small" onClick={addLesson}>
                        <Plus size={14} /> Yangi dars
                      </button>
                    </div>

                    {form.lessons.length === 0 ? (
                      <div className="lessons-empty">
                        <BookOpen size={32} />
                        <p>Hali darslar yo'q. "Yangi dars" tugmasini bosing.</p>
                      </div>
                    ) : (
                      <div className="lessons-list">
                        {form.lessons.map((lesson, idx) => (
                          <div key={idx} className="lesson-item">
                            <div className="lesson-item-header">
                              <span className="lesson-number">{idx + 1}-dars</span>
                              <button
                                type="button"
                                className="lesson-delete-btn"
                                onClick={() => removeLesson(idx)}
                              >
                                <X size={14} />
                              </button>
                            </div>

                            <div className="form-group">
                              <label>Dars sarlavhasi</label>
                              <input
                                type="text"
                                value={lesson.title || ''}
                                onChange={e => {
                                  const newLessons = [...form.lessons]
                                  newLessons[idx] = { ...newLessons[idx], title: e.target.value }
                                  setForm({ ...form, lessons: newLessons })
                                }}
                                placeholder="Masalan: Kirish va asosiy tushunchalar"
                              />
                            </div>

                            {/* VIDEO — 2 ta variant: URL yoki yuklash */}
                            <div className="form-group">
                              <label>Video</label>

                              {/* Variant 1: URL */}
                              <input
                                type="url"
                                value={lesson.videoUrl || ''}
                                onChange={e => {
                                  const newLessons = [...form.lessons]
                                  newLessons[idx] = { ...newLessons[idx], videoUrl: e.target.value }
                                  setForm({ ...form, lessons: newLessons })
                                }}
                                placeholder="https://vimeo.com/123456789  yoki  https://youtube.com/watch?v=..."
                              />
                              <small style={{ display: 'block', marginTop: 6, color: 'var(--text-muted)', fontSize: 12 }}>
                                💡 <strong>Tez yo'l:</strong> Videoni <a href="https://vimeo.com/upload" target="_blank" rel="noopener" style={{ color: 'var(--primary-light)' }}>Vimeo</a> yoki YouTube'ga yuklab, URL'ni shu yerga yopishtiring.
                              </small>

                              {/* Variant 2: To'g'ridan-to'g'ri yuklash (lokal MP4) */}
                              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                                <small style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                                  YOKI MP4 fayl yuklash (sekin internet uchun chidamli kuting)
                                </small>
                                {lesson.videoUrl && !/^https?:\/\//i.test(lesson.videoUrl) === false && /\.r2\.dev|onrender\.com|\.mp4$/i.test(lesson.videoUrl) ? (
                                  <div className="video-uploaded">
                                    <div className="video-uploaded-info">
                                      <Video size={20} color="#22c55e" />
                                      <div>
                                        <div className="video-filename">{lesson.videoFile || 'video.mp4'}</div>
                                        <div className="video-size">{lesson.videoSize ? `${lesson.videoSize} MB` : ''}</div>
                                      </div>
                                    </div>
                                    <video src={assetUrl(lesson.videoUrl)} controls className="video-preview" />
                                    <button
                                      type="button"
                                      className="btn-outline btn-small"
                                      onClick={() => removeLessonVideo(idx)}
                                    >
                                      <X size={14} /> Videoni o'chirish
                                    </button>
                                  </div>
                                ) : (
                                  <div className="upload-box">
                                    <input
                                      type="file"
                                      accept="video/mp4,.mp4"
                                      id={`video-upload-${idx}`}
                                      onChange={e => uploadVideo(idx, e.target.files[0])}
                                      disabled={uploadingVideo[idx]}
                                      style={{ display: 'none' }}
                                    />
                                    <label htmlFor={`video-upload-${idx}`} className="upload-label">
                                      {uploadingVideo[idx] ? (
                                        <>
                                          <Loader2 size={32} className="spin-icon" />
                                          <span>Video yuklanmoqda...</span>
                                          <small>Iltimos kuting, sekin internet bilan vaqt olishi mumkin</small>
                                        </>
                                      ) : (
                                        <>
                                          <Upload size={32} />
                                          <span>MP4 fayl tanlash</span>
                                          <small>max 500 MB</small>
                                        </>
                                      )}
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="form-group">
                              <label>Tavsif (ixtiyoriy)</label>
                              <textarea
                                value={lesson.description || ''}
                                onChange={e => {
                                  const newLessons = [...form.lessons]
                                  newLessons[idx] = { ...newLessons[idx], description: e.target.value }
                                  setForm({ ...form, lessons: newLessons })
                                }}
                                placeholder="Dars haqida qisqacha..."
                                rows={2}
                              />
                            </div>

                            {/* MATERIAL UPLOAD */}
                            <div className="form-group">
                              <label>Material fayl (ZIP/PDF — ixtiyoriy)</label>
                              {lesson.materialUrl ? (
                                <div className="material-uploaded">
                                  <Upload size={16} color="#22c55e" />
                                  <span>{lesson.materialName}</span>
                                  <button
                                    type="button"
                                    className="btn-outline btn-small"
                                    onClick={() => {
                                      const newLessons = [...form.lessons]
                                      newLessons[idx] = { ...newLessons[idx], materialUrl: '', materialName: '' }
                                      setForm({ ...form, lessons: newLessons })
                                    }}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <input
                                  type="file"
                                  accept=".zip,.rar,.pdf,.docx,.pptx,.xlsx,.7z"
                                  onChange={e => uploadMaterial(idx, e.target.files[0])}
                                  disabled={uploadingMaterial[idx]}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-actions">
                    <button className="btn-outline" onClick={resetForm}>
                      Bekor qilish
                    </button>
                    <button className="btn-primary" onClick={saveCourse}>
                      <Save size={16} /> {editingCourse ? 'Yangilash' : 'Saqlash'}
                    </button>
                  </div>
                </div>
              )}

              {/* Courses List */}
              {!showCourseForm && (
                <div className="admin-courses-grid">
                  {courses.length === 0 ? (
                    <div className="admin-empty">
                      <BookOpen size={48} />
                      <h3>Hali kurslar yo'q</h3>
                      <p>Birinchi kursni qo'shing</p>
                      <button className="btn-primary" onClick={() => setShowCourseForm(true)}>
                        <Plus size={16} /> Yangi kurs
                      </button>
                    </div>
                  ) : (
                    courses.map(c => (
                      <div key={c.id} className="admin-course-card">
                        <div className="admin-course-thumb">
                          {c.image ? (
                            <img src={assetUrl(c.image)} alt={c.title} />
                          ) : (
                            <BookOpen size={32} />
                          )}
                        </div>
                        <div className="admin-course-body">
                          <h4>{c.title}</h4>
                          <div className="admin-course-meta">
                            <span>{c.category}</span>
                            <span>•</span>
                            <span>{c.daraja}</span>
                            <span>•</span>
                            <span>{c.lessons?.length || 0} dars</span>
                          </div>
                          <p>{(c.description || c.desc || '').substring(0, 100)}...</p>
                        </div>
                        <div className="admin-course-actions">
                          <button className="btn-outline btn-small" onClick={() => navigate(`/courses/${c.id}`)}>
                            <Eye size={14} />
                          </button>
                          <button className="btn-outline btn-small" onClick={() => startEdit(c)}>
                            <Edit3 size={14} />
                          </button>
                          <button className="btn-danger btn-small" onClick={() => deleteCourse(c.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* USERS */}
          {activeTab === 'users' && (
            <div className="admin-content">
              <div className="admin-page-header">
                <div>
                  <h1>Foydalanuvchilar</h1>
                  <p>{filteredUsers.length} ta ko'rsatilmoqda — jami {users.length}</p>
                </div>
                <div className="admin-search">
                  <Search size={16} />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Ism, email yoki rol bo'yicha qidirish..."
                  />
                  {userSearch && (
                    <button className="admin-search-clear" onClick={() => setUserSearch('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Ism</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Ro'yxatdan o'tgan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          Foydalanuvchi topilmadi
                        </td>
                      </tr>
                    ) : filteredUsers.map((u, i) => (
                      <tr key={u.id}>
                        <td>{i + 1}</td>
                        <td>
                          <div className="admin-user-cell">
                            <div className="admin-user-avatar" style={{
                              background: `linear-gradient(135deg, hsl(${u.id * 60 % 360}, 70%, 60%), hsl(${(u.id * 60 + 60) % 360}, 70%, 50%))`
                            }}>
                              {u.name?.[0]?.toUpperCase()}
                            </div>
                            <span>{u.name}</span>
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`admin-role role-${u.role || 'student'}`}>
                            {u.role === 'admin' ? 'Admin' : u.role === 'teacher' ? 'Teacher' : 'Student'}
                          </span>
                        </td>
                        <td>{new Date(u.created_at).toLocaleDateString('uz-UZ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TEACHER REQUESTS */}
          {activeTab === 'requests' && (
            <div className="admin-content">
              <div className="admin-page-header">
                <div>
                  <h1>O'qituvchi arizalari</h1>
                  <p>{pendingRequestsCount} pending — jami {teacherRequests.length}</p>
                </div>
              </div>

              {teacherRequests.length === 0 ? (
                <div className="admin-empty">
                  <UserCheck size={48} />
                  <h3>Hali arizalar yo'q</h3>
                  <p>Foydalanuvchilar o'qituvchi bo'lish uchun ariza berishi mumkin</p>
                </div>
              ) : (
                <div className="admin-requests-list">
                  {teacherRequests.map(req => {
                    const action = reqAction[req.id]
                    return (
                      <div key={req.id} className={`admin-request-card status-${req.status}`}>
                        <div className="admin-request-main">
                          <div className="admin-user-avatar" style={{
                            background: `linear-gradient(135deg, hsl(${req.user_id * 60 % 360}, 70%, 60%), hsl(${(req.user_id * 60 + 60) % 360}, 70%, 50%))`
                          }}>
                            {(req.full_name || req.name)?.[0]?.toUpperCase()}
                          </div>
                          <div className="admin-request-info">
                            <div className="admin-request-name">
                              {req.full_name}
                              <span className={`admin-request-status status-${req.status}`}>
                                {req.status === 'pending' ? 'Kutmoqda' :
                                  req.status === 'approved' ? 'Tasdiqlangan' : 'Rad etilgan'}
                              </span>
                            </div>
                            <div className="admin-request-email">{req.email}</div>
                            <div className="admin-request-detail">
                              <strong>Fan:</strong> {req.subject}
                            </div>
                            <div className="admin-request-detail">
                              <strong>Tajriba:</strong> {req.experience}
                            </div>
                            <div className="admin-request-date">
                              <Clock size={11} /> {new Date(req.created_at).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        {req.status === 'pending' && (
                          <div className="admin-request-actions">
                            <button
                              className="btn-success"
                              onClick={() => handleRequest(req.id, 'approved')}
                              disabled={!!action}
                            >
                              {action === 'approving' ? <Loader2 size={14} className="spin-icon" /> : <Check size={14} />} Tasdiqlash
                            </button>
                            <button
                              className="btn-danger"
                              onClick={() => handleRequest(req.id, 'rejected')}
                              disabled={!!action}
                            >
                              {action === 'rejecting' ? <Loader2 size={14} className="spin-icon" /> : <XCircle size={14} />} Rad etish
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* MESSAGES */}
          {activeTab === 'messages' && (
            <div className="admin-content">
              <div className="admin-page-header">
                <div>
                  <h1>Aloqa xabarlari</h1>
                  <p>Foydalanuvchilar yuborgan xabarlar va siz yozgan javoblar</p>
                </div>
                <button className="btn-outline btn-small" onClick={loadContactMessages}>
                  <Activity size={14} /> Yangilash
                </button>
              </div>

              {/* Filter tablar */}
              <div className="msg-filter-tabs">
                {[
                  { key: 'all', label: 'Hammasi', count: contactMessages.length },
                  { key: 'new', label: 'Yangi', count: contactMessages.filter(m => m.status === 'new').length, color: 'var(--warning)' },
                  { key: 'replied', label: 'Javob berildi', count: contactMessages.filter(m => m.status === 'replied').length, color: 'var(--success)' },
                  { key: 'archived', label: 'Arxiv', count: contactMessages.filter(m => m.status === 'archived').length, color: 'var(--text-muted)' },
                ].map(t => (
                  <button
                    key={t.key}
                    className={`msg-filter-btn ${contactFilter === t.key ? 'active' : ''}`}
                    onClick={() => {
                      setContactFilter(t.key)
                      setTimeout(loadContactMessages, 0)
                    }}
                  >
                    {t.label}
                    {t.count > 0 && <span className="msg-filter-count">{t.count}</span>}
                  </button>
                ))}
              </div>

              {contactLoading ? (
                <div className="admin-empty">
                  <Loader2 size={32} className="spin" />
                  <p>Yuklanmoqda...</p>
                </div>
              ) : contactMessages.length === 0 ? (
                <div className="admin-empty">
                  <Mail size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
                  <h3>Xabar yo'q</h3>
                  <p>Hozircha bu filter bo'yicha xabarlar yo'q</p>
                </div>
              ) : (
                <div className="admin-msg-list">
                  {contactMessages.map(msg => {
                    const draft = replyDrafts[msg.id] || ''
                    const sending = !!replying[msg.id]
                    return (
                      <div key={msg.id} className={`admin-msg-card admin-msg-${msg.status}`}>
                        {/* Sarlavha */}
                        <div className="admin-msg-top">
                          <div className="admin-msg-from">
                            <div className="admin-msg-avatar">
                              {(msg.name?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              <div className="admin-msg-name">
                                {msg.name}
                                {msg.user_id && (
                                  <span className="admin-msg-badge admin-msg-badge-user">
                                    <Check size={10} /> Ro'yxatdan o'tgan
                                  </span>
                                )}
                              </div>
                              <a href={`mailto:${msg.email}`} className="admin-msg-email">
                                <Mail size={11} /> {msg.email}
                              </a>
                            </div>
                          </div>
                          <div className="admin-msg-meta-top">
                            <span className={`admin-msg-status admin-msg-status-${msg.status}`}>
                              {msg.status === 'new' && <><AlertTriangle size={10} /> Yangi</>}
                              {msg.status === 'read' && <><Eye size={10} /> O'qildi</>}
                              {msg.status === 'replied' && <><Check size={10} /> Javob berildi</>}
                              {msg.status === 'archived' && <><Archive size={10} /> Arxiv</>}
                            </span>
                            <span className="admin-msg-date">
                              <Clock size={11} />
                              {new Date(msg.created_at).toLocaleString('uz-UZ', {
                                day: '2-digit', month: 'short',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Xabar matni */}
                        <div className="admin-msg-text">
                          {msg.message}
                        </div>

                        {/* Javob bor bo'lsa — ko'rsatish */}
                        {msg.admin_reply && (
                          <div className="admin-msg-reply-shown">
                            <div className="admin-msg-reply-label">
                              <Reply size={12} /> Sizning javobingiz
                              {msg.replied_at && (
                                <span style={{ marginLeft: 8, fontWeight: 400, opacity: 0.7 }}>
                                  ({new Date(msg.replied_at).toLocaleString('uz-UZ', {
                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                  })})
                                </span>
                              )}
                            </div>
                            <div className="admin-msg-reply-text">{msg.admin_reply}</div>
                          </div>
                        )}

                        {/* Javob yozish */}
                        {msg.status !== 'archived' && (
                          <div className="admin-msg-reply-form">
                            <textarea
                              className="admin-msg-textarea"
                              placeholder={msg.admin_reply ? "Qo'shimcha javob yozing..." : "Foydalanuvchiga javob yozing... (kamida 5 belgi)"}
                              value={draft}
                              onChange={e => setReplyDrafts(prev => ({ ...prev, [msg.id]: e.target.value.slice(0, 2000) }))}
                              rows={3}
                              disabled={sending}
                            />
                            <div className="admin-msg-reply-actions">
                              <span className="admin-msg-char-count">
                                {draft.length}/2000
                              </span>
                              <div style={{ display: 'flex', gap: 8 }}>
                                {msg.status !== 'archived' && (
                                  <button
                                    className="btn-outline btn-small"
                                    onClick={() => changeContactStatus(msg.id, 'archived')}
                                    disabled={sending}
                                  >
                                    <Archive size={12} /> Arxivlash
                                  </button>
                                )}
                                <button
                                  className="btn-primary btn-small"
                                  onClick={() => sendReply(msg.id)}
                                  disabled={sending || draft.trim().length < 5}
                                >
                                  {sending ? (
                                    <><Loader2 size={12} className="spin" /> Yuborilmoqda</>
                                  ) : (
                                    <><Send size={12} /> Javob yuborish</>
                                  )}
                                </button>
                              </div>
                            </div>
                            {msg.user_id && (
                              <div className="admin-msg-hint">
                                💡 Javob saytda + Telegram'da (agar foydalanuvchi bot bilan tasdiqlanagan bo'lsa) yuboriladi
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* BROADCAST */}
          {activeTab === 'broadcast' && (
            <div className="admin-content">
              <div className="admin-page-header">
                <div>
                  <h1>E'lon yuborish</h1>
                  <p>Barcha foydalanuvchilarga bir vaqtda bildirishnoma yuborish</p>
                </div>
              </div>

              <div className="admin-section">
                <h3><Megaphone size={18} /> Yangi e'lon</h3>
                <div className="broadcast-form">
                  <div className="form-group">
                    <label>Sarlavha *</label>
                    <input
                      type="text"
                      value={broadcastForm.title}
                      onChange={e => setBroadcastForm(p => ({ ...p, title: e.target.value.slice(0, 200) }))}
                      placeholder="Masalan: Yangi Python kursi qo'shildi!"
                      maxLength={200}
                      disabled={broadcasting}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {broadcastForm.title.length}/200
                    </span>
                  </div>

                  <div className="form-group">
                    <label>Tavsif (ixtiyoriy)</label>
                    <textarea
                      value={broadcastForm.message}
                      onChange={e => setBroadcastForm(p => ({ ...p, message: e.target.value.slice(0, 1000) }))}
                      placeholder="Batafsil ma'lumot..."
                      rows={4}
                      maxLength={1000}
                      disabled={broadcasting}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {broadcastForm.message.length}/1000
                    </span>
                  </div>

                  <div className="form-group">
                    <label>Havola (ixtiyoriy — bossa qaerga o'tadi)</label>
                    <input
                      type="text"
                      value={broadcastForm.link}
                      onChange={e => setBroadcastForm(p => ({ ...p, link: e.target.value }))}
                      placeholder="/courses, /battle, /daily..."
                      disabled={broadcasting}
                    />
                  </div>

                  <div className="form-group">
                    <label>Auditoriya</label>
                    <div className="broadcast-audience">
                      {[
                        { key: 'all', label: 'Hamma foydalanuvchi', desc: 'Barchasi' },
                        { key: 'students', label: 'Faqat studentlar', desc: 'Teacher/admin emas' },
                        { key: 'active7d', label: 'Aktiv (180 kun)', desc: 'Kurs/dars bilan aloqasi bor' }
                      ].map(opt => (
                        <label
                          key={opt.key}
                          className={`broadcast-radio ${broadcastForm.audience === opt.key ? 'active' : ''}`}
                        >
                          <input
                            type="radio"
                            name="audience"
                            value={opt.key}
                            checked={broadcastForm.audience === opt.key}
                            onChange={() => setBroadcastForm(p => ({ ...p, audience: opt.key }))}
                          />
                          <div>
                            <strong>{opt.label}</strong>
                            <span>{opt.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={sendBroadcast}
                    disabled={broadcasting || !broadcastForm.title.trim()}
                  >
                    {broadcasting ? (
                      <><Loader2 size={14} className="spin" /> Yuborilmoqda...</>
                    ) : (
                      <><Send size={14} /> Yuborish</>
                    )}
                  </button>
                </div>
              </div>

              {/* So'nggi broadcastlar */}
              {recentBroadcasts.length > 0 && (
                <div className="admin-section">
                  <h3><Clock size={18} /> So'nggi e'lonlar</h3>
                  <div className="broadcast-history">
                    {recentBroadcasts.map((b, i) => (
                      <div key={i} className="broadcast-item">
                        <div className="broadcast-item-main">
                          <strong>{b.title}</strong>
                          {b.message && <span className="broadcast-item-msg">{b.message}</span>}
                        </div>
                        <div className="broadcast-item-stats">
                          <span><Users size={11} /> {b.recipients} ta</span>
                          <span><Eye size={11} /> {b.read_count} o'qildi</span>
                          <span><Clock size={11} /> {new Date(b.created_at).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div className="admin-content">
              <div className="admin-page-header">
                <div>
                  <h1>Xavfsizlik</h1>
                  <p>Threat detector va hujum log'lari</p>
                </div>
                <button className="btn-outline btn-small" onClick={loadSecurity}>
                  <Activity size={14} /> Yangilash
                </button>
              </div>

              {securityStats ? (
                <>
                  <div className="admin-stats">
                    <div className="admin-stat-card">
                      <div className="admin-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                        <Shield size={22} />
                      </div>
                      <div>
                        <div className="admin-stat-value">{securityStats.total}</div>
                        <div className="admin-stat-label">Jami hodisalar</div>
                      </div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="admin-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <div className="admin-stat-value">{securityStats.last24h}</div>
                        <div className="admin-stat-label">Oxirgi 24 soat</div>
                      </div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="admin-stat-icon" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
                        <Globe size={22} />
                      </div>
                      <div>
                        <div className="admin-stat-value">{securityStats.topAttackers?.length || 0}</div>
                        <div className="admin-stat-label">Top hujumchilar</div>
                      </div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="admin-stat-icon" style={{ background: securityStats.telegramConfigured ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)', color: securityStats.telegramConfigured ? '#22c55e' : '#94a3b8' }}>
                        <Send size={22} />
                      </div>
                      <div>
                        <div className="admin-stat-value">{securityStats.telegramConfigured ? 'ON' : 'OFF'}</div>
                        <div className="admin-stat-label">Telegram alerts</div>
                      </div>
                    </div>
                  </div>

                  <div className="admin-section">
                    <h3><AlertTriangle size={18} /> So'nggi hodisalar</h3>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Vaqt</th>
                            <th>IP</th>
                            <th>Davlat</th>
                            <th>Toifa</th>
                            <th>Darajasi</th>
                            <th>URL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {securityLogs.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                Hech qanday hodisa yo'q — bu yaxshi
                              </td>
                            </tr>
                          ) : securityLogs.slice(0, 30).map(log => (
                            <tr key={log.id}>
                              <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {new Date(log.ts).toLocaleString('uz-UZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{log.ip}</td>
                              <td style={{ fontSize: '12px' }}>{log.country || '?'}{log.city ? ` • ${log.city}` : ''}</td>
                              <td><span className="admin-role role-student">{log.category}</span></td>
                              <td>
                                <span className={`admin-severity sev-${log.severity}`}>
                                  {log.severity}
                                </span>
                              </td>
                              <td style={{ fontSize: '11px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                {log.method} {log.url}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="admin-empty">
                  <Loader2 size={32} className="spin-icon" />
                  <h3>Yuklanmoqda...</h3>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <div className="admin-content">
              <div className="admin-page-header">
                <div>
                  <h1>Sozlamalar</h1>
                  <p>Email va xizmat testlari</p>
                </div>
              </div>

              <div className="admin-section">
                <h3><Mail size={18} /> Email test</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                  Belgilangan manzilga test xabar yuborib email provayder ishlayotganini tekshiring.
                </p>
                <div className="admin-form-row">
                  <input
                    type="email"
                    value={emailTestTo}
                    onChange={e => setEmailTestTo(e.target.value)}
                    placeholder="test@example.com"
                    className="admin-input"
                    disabled={emailTesting}
                  />
                  <button
                    className="btn-primary"
                    onClick={sendTestEmail}
                    disabled={emailTesting || !emailTestTo.trim()}
                  >
                    {emailTesting ? <Loader2 size={14} className="spin-icon" /> : <Send size={14} />} Yuborish
                  </button>
                </div>
              </div>

              <div className="admin-section">
                <h3><Activity size={18} /> Tizim ma'lumotlari</h3>
                <div className="admin-info-grid">
                  <div className="admin-info-item">
                    <span className="admin-info-label">API URL</span>
                    <span className="admin-info-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{API_URL}</span>
                  </div>
                  <div className="admin-info-item">
                    <span className="admin-info-label">Frontend</span>
                    <span className="admin-info-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{window.location.origin}</span>
                  </div>
                  <div className="admin-info-item">
                    <span className="admin-info-label">Versiya</span>
                    <span className="admin-info-value">v1.0.0</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

      </div>
    </div>
  )
}

export default Admin