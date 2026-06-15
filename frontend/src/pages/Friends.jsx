import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserPlus, UserCheck, UserX, Check, X,
  Flame, Star, Award, BookOpen, Activity, Sparkles
} from 'lucide-react'
import { apiGet, apiPost, apiDelete } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

// Vaqtni "X oldin" ko'rinishida
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return 'hozirgina'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} daqiqa oldin`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} soat oldin`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} kun oldin`
  return d.toLocaleDateString('uz-UZ')
}

const initial = (name) => (name && name.trim()[0] ? name.trim()[0].toUpperCase() : '?')

const FEED_META = {
  certificate: { Icon: Award, verb: 'sertifikat oldi', color: '#DC8B1A' },
  enroll: { Icon: BookOpen, verb: 'yangi kursni boshladi', color: '#5B5BD6' },
  module_test: { Icon: Check, verb: 'modul testdan o\'tdi', color: '#0F9D77' },
  daily: { Icon: Flame, verb: 'kunlik masalani yechdi', color: '#EC4899' },
}

const card = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 16,
}

function Avatar({ name, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, color: '#fff', fontSize: size * 0.4,
      background: 'linear-gradient(135deg, #5B5BD6, #A78BFA, #F472B6)'
    }}>{initial(name)}</div>
  )
}

function Friends() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('friends')
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] })
  const [feed, setFeed] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState({})  // userId -> bool

  const loadFriends = useCallback(async () => {
    try {
      const d = await apiGet('/api/social/friends')
      setData({ friends: d.friends || [], incoming: d.incoming || [], outgoing: d.outgoing || [] })
    } catch { /* 401 interceptor login'ga yo'naltiradi */ }
    setLoading(false)
  }, [])

  useEffect(() => { document.title = "Do'stlar — Eduzy"; loadFriends() }, [loadFriends])

  // Tasma va tavsiyalar — tab ochilganda yuklanadi
  useEffect(() => {
    if (tab === 'feed' && feed === null) {
      apiGet('/api/social/feed').then(setFeed).catch(() => setFeed([]))
    }
    if (tab === 'find' && suggestions === null) {
      apiGet('/api/social/suggestions').then(setSuggestions).catch(() => setSuggestions([]))
    }
  }, [tab, feed, suggestions])

  const withBusy = async (userId, fn) => {
    setBusy(b => ({ ...b, [userId]: true }))
    try { await fn() } catch (e) { console.error(e) }
    setBusy(b => ({ ...b, [userId]: false }))
  }

  const sendRequest = (userId) => withBusy(userId, async () => {
    await apiPost(`/api/social/request/${userId}`)
    setSuggestions(s => (s || []).filter(u => u.id !== userId))
    await loadFriends()
  })
  const accept = (userId) => withBusy(userId, async () => {
    await apiPost(`/api/social/accept/${userId}`)
    await loadFriends()
  })
  const remove = (userId) => withBusy(userId, async () => {
    await apiDelete(`/api/social/${userId}`)
    setSuggestions(s => s) // o'zgarmaydi
    await loadFriends()
  })

  const { friends, incoming, outgoing } = data

  const tabs = [
    { key: 'friends', label: "Do'stlarim", count: friends.length, Icon: Users },
    { key: 'requests', label: "So'rovlar", count: incoming.length, Icon: UserPlus },
    { key: 'feed', label: 'Faollik tasmasi', count: 0, Icon: Activity },
    { key: 'find', label: "Do'st topish", count: 0, Icon: Sparkles },
  ]

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 18px 60px' }}>
        {/* Sarlavha */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, fontSize: 28 }}>
            <Users size={26} color="var(--primary)" /> Do'stlar bilan o'rganish
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            Birga o'rgansang — tashlab ketmaysan. Do'stlaringni qo'sh, faolligini kuzat, birga raqobatlash.
          </p>
        </div>

        {/* Tablar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px',
                borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14,
                border: '1px solid var(--border)',
                background: tab === t.key ? 'var(--primary)' : 'var(--card)',
                color: tab === t.key ? '#fff' : 'var(--text)'
              }}
            >
              <t.Icon size={16} /> {t.label}
              {t.count > 0 && (
                <span style={{
                  background: tab === t.key ? 'rgba(255,255,255,.25)' : 'var(--primary)',
                  color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 12
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Yuklanmoqda…</p>
        ) : (
          <>
            {/* DO'STLARIM */}
            {tab === 'friends' && (
              friends.length === 0 ? (
                <Empty
                  text="Hali do'stlaring yo'q. Birga o'rganish ko'proq motivatsiya beradi!"
                  cta="Do'st topish" onCta={() => setTab('find')}
                />
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {friends.map(f => (
                    <div key={f.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
                      <Avatar name={f.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{f.name}</div>
                        <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: 13 }}>
                          <span title="Streak"><Flame size={13} color="#EC4899" /> {f.streak}</span>
                          <span title="Ball"><Star size={13} color="#DC8B1A" /> {f.points}</span>
                          <span title="Kurslar"><BookOpen size={13} /> {f.courses}</span>
                          <span title="Sertifikatlar"><Award size={13} /> {f.certificates}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => remove(f.id)} disabled={busy[f.id]}
                        title="Do'stlikdan chiqarish"
                        style={ghostBtn}
                      >
                        <UserX size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* SO'ROVLAR */}
            {tab === 'requests' && (
              (incoming.length === 0 && outgoing.length === 0) ? (
                <Empty text="Yangi so'rov yo'q." />
              ) : (
                <div style={{ display: 'grid', gap: 18 }}>
                  {incoming.length > 0 && (
                    <div>
                      <h3 style={sectionH}>Kelgan so'rovlar</h3>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {incoming.map(u => (
                          <div key={u.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Avatar name={u.name} size={40} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600 }}>{u.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(u.created_at)}</div>
                            </div>
                            <button onClick={() => accept(u.id)} disabled={busy[u.id]} style={primaryBtn}>
                              <Check size={15} /> Qabul
                            </button>
                            <button onClick={() => remove(u.id)} disabled={busy[u.id]} style={ghostBtn}>
                              <X size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {outgoing.length > 0 && (
                    <div>
                      <h3 style={sectionH}>Yuborilgan so'rovlar</h3>
                      <div style={{ display: 'grid', gap: 10 }}>
                        {outgoing.map(u => (
                          <div key={u.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Avatar name={u.name} size={40} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600 }}>{u.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Kutilmoqda…</div>
                            </div>
                            <button onClick={() => remove(u.id)} disabled={busy[u.id]} style={ghostBtn}>
                              Bekor qilish
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {/* FAOLLIK TASMASI */}
            {tab === 'feed' && (
              feed === null ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Yuklanmoqda…</p>
              ) : feed.length === 0 ? (
                <Empty text="Do'stlaring faoligi shu yerda ko'rinadi. Avval do'st qo'sh!" cta="Do'st topish" onCta={() => setTab('find')} />
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {feed.map((it, i) => {
                    const meta = FEED_META[it.type] || { Icon: Activity, verb: 'faollik', color: 'var(--primary)' }
                    return (
                      <div key={i} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: meta.color + '1A', color: meta.color
                        }}><meta.Icon size={18} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14 }}>
                            <strong>{it.name}</strong> {meta.verb}
                            {it.title ? <> — <span style={{ color: 'var(--text-muted)' }}>{it.title}</span></> : null}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(it.at)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* DO'ST TOPISH */}
            {tab === 'find' && (
              suggestions === null ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Yuklanmoqda…</p>
              ) : suggestions.length === 0 ? (
                <Empty text="Hozircha tavsiya yo'q. Reytingdan ham do'st qo'shsang bo'ladi." cta="Reyting" onCta={() => navigate('/leaderboard')} />
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {suggestions.map(u => (
                    <div key={u.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={u.name} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 2, color: 'var(--text-muted)', fontSize: 13 }}>
                          <span><Flame size={13} color="#EC4899" /> {u.streak}</span>
                          <span><Star size={13} color="#DC8B1A" /> {u.points}</span>
                        </div>
                      </div>
                      <button onClick={() => sendRequest(u.id)} disabled={busy[u.id]} style={primaryBtn}>
                        <UserPlus size={15} /> Qo'shish
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}

const sectionH = { fontSize: 14, color: 'var(--text-muted)', margin: '0 0 8px', fontWeight: 600 }
const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  background: 'var(--primary)', color: '#fff'
}
const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)'
}

function Empty({ text, cta, onCta }) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: '40px 20px' }}>
      <UserCheck size={36} color="var(--text-muted)" style={{ marginBottom: 10 }} />
      <p style={{ color: 'var(--text-muted)', marginBottom: cta ? 16 : 0 }}>{text}</p>
      {cta && <button onClick={onCta} style={primaryBtn}>{cta}</button>}
    </div>
  )
}

export default Friends
