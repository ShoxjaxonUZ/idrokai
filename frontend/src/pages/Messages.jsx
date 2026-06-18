import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MessageCircle, Send, ArrowLeft, Users } from 'lucide-react'
import { API_URL, apiGet, apiPost, getUser } from '../lib/api'
import Navbar from '../components/Navbar'

const initial = (name) => (name && name.trim()[0] ? name.trim()[0].toUpperCase() : '?')

function timeShort(d) {
  if (!d) return ''
  const date = new Date(d)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' })
}

const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }
const avatarStyle = {
  width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex',
  alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff',
  background: 'linear-gradient(135deg, #5B5BD6, #A78BFA, #F472B6)'
}
const badge = { background: 'var(--primary)', color: '#fff', borderRadius: 20, padding: '0 7px', fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: 'center', alignSelf: 'center' }
const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: 'var(--primary)', color: '#fff' }
const ghostBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 13, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }

function Messages() {
  const me = getUser()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const activeId = params.get('u') ? parseInt(params.get('u'), 10) : null

  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [friend, setFriend] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConv, setLoadingConv] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState(false)

  const bottomRef = useRef(null)
  const activeRef = useRef(activeId)

  useEffect(() => { activeRef.current = activeId }, [activeId])

  const loadConversations = useCallback(async () => {
    try {
      const d = await apiGet('/api/messages/conversations')
      setConversations(Array.isArray(d) ? d : [])
    } catch { /* 401 interceptor login'ga yo'naltiradi */ }
    setLoadingConv(false)
  }, [])

  useEffect(() => { document.title = 'Xabarlar — Eduzy'; loadConversations() }, [loadConversations])

  // Faol suhbat tarixi (+ o'qilgan deb belgilash)
  const loadHistory = useCallback(async (uid) => {
    if (!uid) { setMessages([]); setFriend(null); return }
    setLoadingMsg(true)
    try {
      const d = await apiGet(`/api/messages/${uid}`)
      setMessages(d.messages || [])
      setFriend(d.friend || null)
      window.dispatchEvent(new CustomEvent('eduzy:msg-read'))
      setConversations(prev => prev.map(c => c.id === uid ? { ...c, unread: 0 } : c))
    } catch { setFriend(null) }
    setLoadingMsg(false)
  }, [])

  useEffect(() => { loadHistory(activeId) }, [activeId, loadHistory])

  // Real-time: NotificationBell SSE 'message' -> window 'eduzy:message'
  useEffect(() => {
    const onMsg = (e) => {
      const m = e.detail
      if (!m || !m.id) return
      if (m.sender_id === activeRef.current) {
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
        fetch(`${API_URL}/api/messages/${m.sender_id}`).catch(() => {})  // o'qilgan deb belgilash
        window.dispatchEvent(new CustomEvent('eduzy:msg-read'))
      } else {
        loadConversations()
      }
    }
    window.addEventListener('eduzy:message', onMsg)
    return () => window.removeEventListener('eduzy:message', onMsg)
  }, [loadConversations])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (e) => {
    e?.preventDefault()
    const body = text.trim()
    if (!body || !activeId) return
    setSending(true)
    try {
      const d = await apiPost(`/api/messages/${activeId}`, { body })
      setMessages(prev => [...prev, d.message])
      setText('')
      setConversations(prev => {
        const updated = { id: activeId, name: friend?.name, last_body: body, last_at: d.message.created_at, last_mine: true, unread: 0 }
        return [updated, ...prev.filter(c => c.id !== activeId)]
      })
    } catch (err) { alert(err.message || 'Yuborilmadi') }
    setSending(false)
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 14px 40px' }}>

        {!activeId ? (
          <>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, margin: '0 0 16px' }}>
              <MessageCircle size={24} color="var(--primary)" /> Xabarlar
            </h1>
            {loadingConv ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Yuklanmoqda…</p>
            ) : conversations.length === 0 ? (
              <div style={{ ...card, padding: '40px 20px', textAlign: 'center' }}>
                <Users size={36} color="var(--text-muted)" style={{ marginBottom: 10 }} />
                <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Hali suhbat yo'q. Do'stingga birinchi xabarni yoz!</p>
                <button style={primaryBtn} onClick={() => navigate('/friends')}>Do'stlar</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {conversations.map(c => (
                  <div key={c.id} onClick={() => setParams({ u: String(c.id) })}
                    style={{ ...card, padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <div style={avatarStyle}>{initial(c.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 700 }}>{c.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeShort(c.last_at)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.last_mine ? 'Siz: ' : ''}{c.last_body}
                        </span>
                        {c.unread > 0 && <span style={badge}>{c.unread}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)', minHeight: 420, overflow: 'hidden' }}>
            {/* Chat sarlavhasi */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderBottom: '1px solid var(--border)' }}>
              <button onClick={() => setParams({})} style={{ ...ghostBtn, padding: 6 }} title="Orqaga"><ArrowLeft size={18} /></button>
              <div style={{ ...avatarStyle, width: 38, height: 38, fontSize: 16, cursor: 'pointer' }}
                onClick={() => friend && navigate(`/portfolio/${friend.id}`)}>{initial(friend?.name)}</div>
              <div style={{ fontWeight: 700, cursor: 'pointer' }}
                onClick={() => friend && navigate(`/portfolio/${friend.id}`)}>{friend?.name || '...'}</div>
            </div>

            {/* Xabarlar */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingMsg ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>Yuklanmoqda…</p>
              ) : messages.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>Birinchi xabarni yozing 👋</p>
              ) : messages.map(m => {
                const mine = m.sender_id === me?.id
                return (
                  <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                    <div style={{
                      padding: '8px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.45, wordBreak: 'break-word',
                      background: mine ? 'var(--primary)' : 'var(--surface)', color: mine ? '#fff' : 'var(--text)',
                      borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4
                    }}>{m.body}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: mine ? 'right' : 'left', marginTop: 2 }}>{timeShort(m.created_at)}</div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Yozish */}
            <form onSubmit={send} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Xabar yozing…" maxLength={2000}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 22, border: '1px solid var(--border)', background: 'var(--bg-soft)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
              <button type="submit" disabled={sending || !text.trim()}
                style={{ ...primaryBtn, borderRadius: '50%', width: 42, height: 42, padding: 0, justifyContent: 'center', opacity: (sending || !text.trim()) ? 0.5 : 1 }}>
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default Messages
