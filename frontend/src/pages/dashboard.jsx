import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, TrendingUp, CheckCircle2, Trophy, LayoutDashboard,
  GraduationCap, BarChart3, PlayCircle, Pause, Bot, User,
  Edit, ArrowRight, Award, Target, MessageCircle, Mail,
  Send, Clock, X, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react'
import { API_URL, getUser, getToken } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Loading from '../components/Loading'
import '../styles/dashboard.css'

const initial = (name) => {
  if (!name || typeof name !== 'string') return '?'
  const c = name.trim()[0]
  return c ? c.toUpperCase() : '?'
}

function Dashboard() {
  const navigate = useNavigate()
  const user = getUser()
  const token = getToken()
  const [enrolledCourses, setEnrolledCourses] = useState([])
  const [certifiedCourseIds, setCertifiedCourseIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [messages, setMessages] = useState([])
  const [expandedMsg, setExpandedMsg] = useState(null)
  const [todayStatus, setTodayStatus] = useState(null) // { dailyDone, dailyId }

  const unreadMessagesCount = messages.filter(m => m.admin_reply && !m.read_by_user).length

  const loadMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/contact/my`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) setMessages(data)
    } catch {}
  }

  const markMessageRead = async (id) => {
    try {
      await fetch(`${API_URL}/api/contact/my/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })
      setMessages(prev => prev.map(m => m.id === id ? { ...m, read_by_user: true } : m))
    } catch {}
  }

  const toggleMessage = (msg) => {
    if (expandedMsg === msg.id) {
      setExpandedMsg(null)
    } else {
      setExpandedMsg(msg.id)
      if (msg.admin_reply && !msg.read_by_user) {
        markMessageRead(msg.id)
      }
    }
  }

  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleDateString('uz-UZ', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    } catch { return d }
  }

  // Bugungi kunlik masala statusini olish
  const loadDailyStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/daily/today`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok && data.challenge) {
        setTodayStatus({
          dailyDone: data.challenge.status === 'completed',
          dailyId: data.challenge.id
        })
      }
    } catch {}
  }

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    document.title = "Dashboard — IdrokAI"
    loadMessages()
    loadDailyStatus()

    let cancelled = false

    const loadAll = async () => {
      try {
        const [coursesRes, myRes] = await Promise.all([
          fetch(`${API_URL}/api/teacher/all-courses`).then(r => r.json()).catch(() => []),
          fetch(`${API_URL}/api/courses/my`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(r => r.json()).catch(() => [])
        ])
        if (cancelled) return

        const allCourses = Array.isArray(coursesRes) ? coursesRes : []
        const courses = Array.isArray(myRes)
          ? myRes.map(e => {
              const course = allCourses.find(c => String(c.id) === String(e.course_id))
              return { ...course, progress: e.progress, course_id: e.course_id }
            }).filter(c => c && c.title && c.title.trim() !== '')
          : []
        setEnrolledCourses(courses)

        // Har bir kurs uchun server tomondagi sertifikat eligibility'ni tekshirish
        const certResults = await Promise.all(courses.map(c =>
          fetch(`${API_URL}/api/courses/certificate-status/${c.course_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then(r => r.ok ? r.json() : null)
            .then(d => (d?.eligible ? c.course_id : null))
            .catch(() => null)
        ))
        if (!cancelled) {
          setCertifiedCourseIds(new Set(certResults.filter(Boolean)))
        }
      } catch (err) { console.error(err) }
      if (!cancelled) setLoading(false)
    }
    loadAll()

    return () => { cancelled = true }
  }, [])

  if (loading) return (
    <div><Navbar /><Loading text="Dashboard yuklanmoqda..." /></div>
  )

  const certCount = certifiedCourseIds.size

  const totalLessons = enrolledCourses.reduce((acc, k) =>
    acc + Math.round(((k.progress || 0) / 100) * (k.lessons?.length || 0)), 0)

  const avgProgress = enrolledCourses.length > 0
    ? Math.round(enrolledCourses.reduce((a, k) => a + (k.progress || 0), 0) / enrolledCourses.length)
    : 0

  const completedCourses = enrolledCourses.filter(k => k.progress === 100)
  const inProgressCourses = enrolledCourses.filter(k => k.progress > 0 && k.progress < 100)

  // Bugun nima qilish kerakligini hisoblash
  const todayItems = []
  if (todayStatus && !todayStatus.dailyDone) {
    todayItems.push({
      key: 'daily',
      Icon: Target,
      iconColor: 'var(--warning)',
      iconBg: 'var(--warning-bg)',
      title: 'Bugungi masalani yeching',
      desc: "Streak'ingizni saqlash uchun 5-10 daqiqa",
      btnLabel: 'Boshlash',
      onClick: () => navigate('/daily')
    })
  }
  if (inProgressCourses[0]) {
    const k = inProgressCourses[0]
    todayItems.push({
      key: 'continue',
      Icon: PlayCircle,
      iconColor: 'var(--primary)',
      iconBg: 'var(--primary-bg)',
      title: `Davom ettiring: ${k.title}`,
      desc: `${k.progress}% bajarildi — qolgan darslarni boshlang`,
      btnLabel: 'Davom etish',
      onClick: () => navigate(`/courses/${k.course_id}`)
    })
  }
  const certReady = enrolledCourses.find(k =>
    k.progress === 100 && certifiedCourseIds.has(k.course_id)
  )
  if (certReady) {
    todayItems.push({
      key: 'cert',
      Icon: Award,
      iconColor: 'var(--warning)',
      iconBg: 'var(--warning-bg)',
      title: 'Sertifikatingiz tayyor!',
      desc: `${certReady.title} — sertifikatni oling`,
      btnLabel: 'Olish',
      onClick: () => navigate(`/certificate/${certReady.course_id}`)
    })
  }
  if (enrolledCourses.length === 0) {
    todayItems.push({
      key: 'start',
      Icon: BookOpen,
      iconColor: 'var(--secondary)',
      iconBg: 'var(--secondary-bg)',
      title: 'Birinchi kursingizni tanlang',
      desc: 'Bizda 50+ bepul kurs bor — o\'zingizga mosini boshlang',
      btnLabel: "Kurslar",
      onClick: () => navigate('/courses')
    })
  }
  // Har doim Battle/AI tavsiya
  if (todayItems.length < 3) {
    todayItems.push({
      key: 'ai',
      Icon: Bot,
      iconColor: 'var(--info)',
      iconBg: 'var(--info-bg)',
      title: 'AI Teacher bilan suhbat',
      desc: '4 sohada professional yordam — kuniga 20 ta savol',
      btnLabel: 'Boshlash',
      onClick: () => navigate('/ai-teacher')
    })
  }

  return (
    <div>
      <Navbar />
      <div className="dashboard-page">

        {/* Profil */}
        <div className="dash-profile">
          <div className="dash-avatar">{initial(user.name)}</div>
          <div className="dash-profile-info">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <span className="profile-badge">
              <GraduationCap size={12} /> O'quvchi
            </span>
          </div>
          <button className="btn-outline" onClick={() => navigate('/profile')}>
            <Edit size={16} /> Profilni tahrirlash
          </button>
        </div>

        {/* BUGUN NIMA QILISH KERAK widget */}
        {todayItems.length > 0 && (
          <div className="dash-today-section">
            <div className="dash-today-header">
              <h3>
                <Sparkles size={18} /> Bugun nimani boshlaysiz?
              </h3>
              <span className="dash-today-hint">Sizning oqimingiz uchun tavsiyalar</span>
            </div>
            <div className="dash-today-grid">
              {todayItems.slice(0, 3).map(item => (
                <div key={item.key} className="dash-today-card" onClick={item.onClick}>
                  <div className="dash-today-icon" style={{ background: item.iconBg, color: item.iconColor }}>
                    <item.Icon size={22} />
                  </div>
                  <div className="dash-today-content">
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                  <button className="dash-today-btn">
                    {item.btnLabel} <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistika */}
        <div className="dash-stats">
          {[
            { label: "Kurslar", value: enrolledCourses.length, Icon: BookOpen, color: "#8b5cf6" },
            { label: "O'rtacha progress", value: `${avgProgress}%`, Icon: TrendingUp, color: "#0ea5e9" },
            { label: "Darslar", value: totalLessons, Icon: CheckCircle2, color: "#22c55e" },
            { label: "Sertifikatlar", value: certCount, Icon: Trophy, color: "#f59e0b" },
          ].map((s, i) => (
            <div key={i} className="dash-stat-card">
              <div className="dash-stat-icon" style={{ background: s.color + '20', color: s.color }}>
                <s.Icon size={22} />
              </div>
              <div>
                <div className="dash-stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="dash-stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tablar */}
        <div className="dash-tabs">
          {[
            { key: 'overview', label: 'Umumiy', Icon: LayoutDashboard },
            { key: 'courses', label: 'Kurslarim', Icon: BookOpen },
            { key: 'results', label: 'Natijalar', Icon: Trophy },
            { key: 'messages', label: 'Xabarlarim', Icon: MessageCircle, badge: unreadMessagesCount },
          ].map(tab => (
            <button
              key={tab.key}
              className={`dash-tab ${activeTab === tab.key ? 'dash-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.Icon size={16} /> {tab.label}
              {tab.badge > 0 && <span className="dash-tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </div>

        {/* Umumiy tab */}
        {activeTab === 'overview' && (
          <div className="dash-content">
            <div className="dash-section">
              <h3>Kurslar holati</h3>
              <div className="dash-status-list">
                {[
                  { label: "Tugatilgan", Icon: CheckCircle2, count: completedCourses.length, color: "#22c55e" },
                  { label: "Davom etmoqda", Icon: PlayCircle, count: inProgressCourses.length, color: "#0ea5e9" },
                  { label: "Boshlanmagan", Icon: Pause, count: enrolledCourses.length - completedCourses.length - inProgressCourses.length, color: "#94a3b8" },
                ].map((s, i) => (
                  <div key={i} className="dash-status-item">
                    <div className="dash-status-info">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <s.Icon size={14} style={{ color: s.color }} /> {s.label}
                      </span>
                      <span style={{ color: s.color, fontWeight: '700' }}>{s.count} ta</span>
                    </div>
                    <div className="dash-status-bar">
                      <div className="dash-status-fill" style={{
                        width: `${enrolledCourses.length ? (s.count / enrolledCourses.length) * 100 : 0}%`,
                        background: s.color
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="dash-section">
              <h3>Tezkor havolalar</h3>
              <div className="dash-quick-links">
                <div className="dash-quick-card" onClick={() => navigate('/courses')}>
                  <div className="quick-icon"><BookOpen size={28} /></div>
                  <p>Yangi kurs</p>
                </div>
                <div className="dash-quick-card" onClick={() => navigate('/ai-quiz')}>
                  <div className="quick-icon"><Bot size={28} /></div>
                  <p>AI test</p>
                </div>
                <div className="dash-quick-card" onClick={() => navigate('/profile')}>
                  <div className="quick-icon"><User size={28} /></div>
                  <p>Profil</p>
                </div>
                {certCount > 0 && (
                  <div className="dash-quick-card" onClick={() => setActiveTab('results')}>
                    <div className="quick-icon"><Trophy size={28} /></div>
                    <p>Sertifikatlar</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Kurslarim tab */}
        {activeTab === 'courses' && (
          <div className="dash-content">
            {enrolledCourses.length === 0 ? (
              <div className="dash-empty">
                <div className="empty-icon"><BookOpen size={48} /></div>
                <p>Hali hech qaysi kursga yozilmagansiz</p>
                <button className="btn-primary" onClick={() => navigate('/courses')}>
                  Kurslarga o'tish <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="dash-course-list">
                {enrolledCourses.map((kurs, i) => (
                  <div key={i} className="dash-course-item" onClick={() => navigate(`/courses/${kurs.course_id}`)}>
                    <div className="dash-course-left">
                      <span style={{ fontSize: '28px' }}>{kurs.emoji || '📚'}</span>
                      <div>
                        <h4>{kurs.title}</h4>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{kurs.category}</span>
                      </div>
                    </div>
                    <div className="dash-course-right">
                      <div className="dash-progress-wrap">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{
                            width: `${kurs.progress}%`,
                            background: kurs.progress === 100 ? '#22c55e' : 'linear-gradient(90deg, #8b5cf6, #0ea5e9)'
                          }}></div>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-soft)', minWidth: '36px' }}>
                          {kurs.progress}%
                        </span>
                      </div>
                      {kurs.progress === 100 && (
                        <span className="dash-badge badge-green">
                          <CheckCircle2 size={12} /> Tugadi
                        </span>
                      )}
                      {kurs.progress > 0 && kurs.progress < 100 && (
                        <span className="dash-badge badge-blue">
                          <PlayCircle size={12} /> Davom etmoqda
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Natijalar tab */}
        {activeTab === 'results' && (
          <div className="dash-content">
            <div className="dash-results-grid">
              {enrolledCourses.filter(k => k.progress === 100).map((kurs, i) => {
                const passed = certifiedCourseIds.has(kurs.course_id)
                return (
                  <div key={i} className="dash-result-card">
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>{kurs.emoji || '📚'}</div>
                    <h4>{kurs.title}</h4>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', margin: '10px 0' }}>
                      <span className="dash-badge badge-green">
                        <CheckCircle2 size={12} /> Tugatildi
                      </span>
                      {passed && (
                        <span className="dash-badge badge-gold">
                          <Trophy size={12} /> Sertifikat
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {passed && (
                        <button className="btn-primary" style={{ fontSize: '13px', padding: '8px 14px' }}
                          onClick={() => navigate(`/certificate/${kurs.course_id}`)}>
                          <Award size={14} /> Sertifikat
                        </button>
                      )}
                      {!passed && (
                        <button className="btn-outline" style={{ fontSize: '13px', padding: '8px 14px' }}
                          onClick={() => navigate(`/courses/${kurs.course_id}`)}>
                          <Target size={14} /> Testga kirish
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {enrolledCourses.filter(k => k.progress === 100).length === 0 && (
                <div className="dash-empty">
                  <div className="empty-icon"><Trophy size={48} /></div>
                  <p>Hali hech qaysi kursni tugatmagansiz</p>
                  <button className="btn-primary" onClick={() => setActiveTab('courses')}>
                    Kurslarimga o'tish <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Xabarlarim tab */}
        {activeTab === 'messages' && (
          <div className="dash-content">
            <div className="dash-section">
              <h3>
                <Mail size={18} /> Aloqa xabarlarim
                {unreadMessagesCount > 0 && (
                  <span className="dash-badge badge-blue" style={{ marginLeft: 10 }}>
                    {unreadMessagesCount} yangi javob
                  </span>
                )}
              </h3>

              {messages.length === 0 ? (
                <div className="dash-empty">
                  <div className="empty-icon"><MessageCircle size={48} /></div>
                  <p>Hali hech qanday xabar yubormagansiz</p>
                  <button className="btn-primary" onClick={() => navigate('/contact')}>
                    <Send size={16} /> Xabar yuborish
                  </button>
                </div>
              ) : (
                <div className="msg-list">
                  {messages.map(msg => {
                    const expanded = expandedMsg === msg.id
                    const hasNewReply = msg.admin_reply && !msg.read_by_user
                    return (
                      <div
                        key={msg.id}
                        className={`msg-item ${hasNewReply ? 'msg-new-reply' : ''} ${expanded ? 'msg-expanded' : ''}`}
                      >
                        <div className="msg-header" onClick={() => toggleMessage(msg)}>
                          <div className="msg-header-left">
                            <div className="msg-status-dot" data-status={
                              msg.admin_reply ? 'replied' : 'pending'
                            }></div>
                            <div>
                              <div className="msg-preview">
                                {msg.message.length > 80 ? msg.message.slice(0, 80) + '...' : msg.message}
                              </div>
                              <div className="msg-meta">
                                <Clock size={12} /> {formatDate(msg.created_at)}
                                {msg.admin_reply && (
                                  <span className="msg-status-text" style={{ color: 'var(--success)' }}>
                                    <CheckCircle2 size={12} /> Javob bor
                                  </span>
                                )}
                                {!msg.admin_reply && (
                                  <span className="msg-status-text" style={{ color: 'var(--warning)' }}>
                                    <Clock size={12} /> Javob kutilmoqda
                                  </span>
                                )}
                                {hasNewReply && (
                                  <span className="msg-new-badge">YANGI</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button className="msg-toggle-btn" type="button">
                            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </div>

                        {expanded && (
                          <div className="msg-body">
                            <div className="msg-section">
                              <div className="msg-section-label">Sizning xabaringiz</div>
                              <div className="msg-section-text">{msg.message}</div>
                            </div>

                            {msg.admin_reply ? (
                              <div className="msg-section msg-reply">
                                <div className="msg-section-label">
                                  <Award size={14} /> Admin javob ({formatDate(msg.replied_at)})
                                </div>
                                <div className="msg-section-text">{msg.admin_reply}</div>
                              </div>
                            ) : (
                              <div className="msg-pending">
                                <Clock size={14} />
                                Javob kutilmoqda — odatda 24 soat ichida javob beriladi
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button className="btn-outline" onClick={() => navigate('/contact')}>
                  <Send size={16} /> Yangi xabar yuborish
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      <Footer />
    </div>
  )
}

export default Dashboard