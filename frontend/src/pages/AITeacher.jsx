import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, Send, User, Sparkles, Copy, Trash2,
  Code2, Lightbulb, BookOpen, Calculator, Atom, Languages,
  AlertCircle, Zap, Image as ImageIcon, X
} from 'lucide-react'
import { API_URL, assetUrl } from '../lib/api'
import Navbar from '../components/Navbar'
import GuestBanner from '../components/GuestBanner'
import { useNotification } from '../context/NotificationContext'
import '../styles/aiteacher.css'

function AITeacher() {
  const navigate = useNavigate()
  const { addNotification } = useNotification() || { addNotification: () => {} }
  const user = (() => { try { return JSON.parse(localStorage.getItem('user')) } catch { return null } })()
  const token = localStorage.getItem('token')
  const messagesEndRef = useRef(null)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [usage, setUsage] = useState({ used: 0, limit: 20, remaining: 20 })
  const [image, setImage] = useState(null) // { dataUrl, name, size }
  const fileInputRef = useRef(null)

  const MAX_IMAGE_MB = 4
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

  const handleImagePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      addNotification('Faqat JPG/PNG/WEBP/GIF qabul qilinadi', 'error')
      e.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      addNotification(`Rasm ${MAX_IMAGE_MB}MB dan oshmasin`, 'error')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImage({ dataUrl: reader.result, name: file.name, size: file.size })
    }
    reader.onerror = () => addNotification('Rasm o\'qib bo\'lmadi', 'error')
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeImage = () => setImage(null)

  const requireAuth = () => {
    if (!user) {
      navigate('/register', { state: { from: { pathname: '/ai-teacher' } } })
      return false
    }
    return true
  }

  useEffect(() => {
    document.title = "AI Teacher — Eduzy"
    if (!user) return

    const saved = localStorage.getItem(`ai_chat_${user.id}`)
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch {}
    }

    const ctrl = new AbortController()
    loadUsage(ctrl.signal)
    return () => ctrl.abort()
  }, [])

  useEffect(() => {
    scrollToBottom()
    if (user && messages.length > 0) {
      localStorage.setItem(`ai_chat_${user.id}`, JSON.stringify(messages))
    }
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadUsage = async (signal) => {
    try {
      const res = await fetch(`${API_URL}/api/ai/teacher/usage`, {
        headers: { Authorization: `Bearer ${token}` }, signal
      })
      const data = await res.json()
      if (res.ok) setUsage(data)
    } catch (err) {
      if (err.name === 'AbortError') return
    }
  }

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      addNotification('Nusxalandi!', 'success')
    } catch {
      addNotification('Nusxalashda xatolik', 'error')
    }
  }

  const sendMessage = async () => {
    if (!requireAuth()) return
    if ((!input.trim() && !image) || loading) return

    if (usage.remaining <= 0) {
      addNotification('Kunlik limit tugadi! Ertaga qayta urinib ko\'ring', 'error')
      return
    }

    const trimmedInput = input.trim()
    const userMsg = {
      role: 'user',
      content: trimmedInput || (image ? '(rasm yuborildi)' : ''),
      image: image?.dataUrl || null,
      time: Date.now()
    }
    const sentImage = image?.dataUrl || null
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setImage(null)
    setLoading(true)

    console.log('[AI Teacher] yuborilmoqda:', {
      msgLen: trimmedInput.length,
      hasImage: !!sentImage,
      imageLen: sentImage?.length || 0
    })

    try {
      const res = await fetch(`${API_URL}/api/ai/teacher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: trimmedInput,
          history: sentImage ? [] : messages
            .filter(m => !m.image)
            .map(m => ({ role: m.role, content: m.content })),
          image: sentImage
        })
      })
      const data = await res.json()

      if (res.ok) {
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.answer,
          subject: data.subject,
          time: Date.now()
        }])
        setUsage({
          used: data.used,
          limit: data.limit,
          remaining: data.remaining
        })
      } else if (res.status === 429) {
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.message,
          time: Date.now(),
          error: true
        }])
        setUsage({
          used: data.used,
          limit: data.limit,
          remaining: 0
        })
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: 'Xatolik: ' + (data.message || 'Noma\'lum'),
          time: Date.now(),
          error: true
        }])
      }
    } catch {
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Server bilan bog\'lanib bo\'lmadi',
        time: Date.now(),
        error: true
      }])
    }
    setLoading(false)
  }

  const clearChat = () => {
    if (!confirm('Butun suhbatni o\'chirishni xohlaysizmi?')) return
    setMessages([])
    localStorage.removeItem(`ai_chat_${user.id}`)
  }

  // Mavzu uchun rang va icon
  const getSubjectInfo = (subject) => {
    const map = {
      dasturlash: { Icon: Code2, color: '#8b5cf6', label: 'Dasturlash' },
      matematika: { Icon: Calculator, color: '#0ea5e9', label: 'Matematika' },
      fizika: { Icon: Atom, color: '#22c55e', label: 'Fizika' },
      ingliz: { Icon: Languages, color: '#f59e0b', label: 'Ingliz tili' },
      umumiy: { Icon: BookOpen, color: '#94a3b8', label: 'Umumiy' }
    }
    return map[subject] || map.umumiy
  }

  const subjects = [
    { name: 'Dasturlash', desc: 'Kod, algoritm, web va mobil', Icon: Code2, color: '#8b5cf6', example: 'Python da ro\'yxat (list) nima?' },
    { name: 'Matematika', desc: 'Algebra, geometriya, hisoblash', Icon: Calculator, color: '#0ea5e9', example: 'Kvadrat tenglama qanday yechiladi?' },
    { name: 'Fizika', desc: 'Mexanika, elektr, optika', Icon: Atom, color: '#22c55e', example: 'Nyutonning 2-qonuni nima?' },
    { name: 'Ingliz tili', desc: 'Grammatika, so\'z, talaffuz', Icon: Languages, color: '#f59e0b', example: 'Present Perfect qachon ishlatiladi?' },
  ]

  const CodeBlock = ({ lang, code }) => {
    return (
      <div className="msg-code">
        <div className="msg-code-header">
          <span>{lang || 'code'}</span>
          <button type="button" onClick={() => copyToClipboard(code)}>
            <Copy size={12} /> Nusxalash
          </button>
        </div>
        <pre>{code}</pre>
      </div>
    )
  }

  const formatMessage = (text) => {
    const parts = []
    const regex = /```(\w+)?\n?([\s\S]*?)```/g
    let lastIndex = 0
    let match
    let key = 0

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <p key={key++} className="msg-text">
            {text.substring(lastIndex, match.index)}
          </p>
        )
      }
      parts.push(
        <CodeBlock key={key++} lang={match[1]} code={match[2]} />
      )
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      parts.push(
        <p key={key++} className="msg-text">
          {text.substring(lastIndex)}
        </p>
      )
    }

    return parts.length > 0 ? parts : <p className="msg-text">{text}</p>
  }

  const usagePercent = (usage.used / usage.limit) * 100
  const isLimitReached = usage.remaining <= 0

  return (
    <div>
      <Navbar />
      <div className="ai-teacher-page">

        {!user && (
          <GuestBanner
            title="AI Teacher — 4 sohada professional ustoz"
            subtitle="Dasturlash, matematika, fizika, ingliz tili — kuniga 20 ta savol bepul. Ro'yxatdan o'ting va boshlang"
          />
        )}

        {/* Header */}
        <div className="ait-header">
          <div className="ait-header-left">
            <div className="ait-header-icon">
              <Bot size={28} />
            </div>
            <div>
              <h1>AI Teacher</h1>
              <p>4 sohada professional ustoz — Dasturlash, Matematika, Fizika, Ingliz tili</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button className="ait-clear-btn" onClick={clearChat}>
              <Trash2 size={14} /> Tozalash
            </button>
          )}
        </div>

        {/* Limit indikatori */}
        <div className={`ait-limit-bar ${isLimitReached ? 'limit-danger' : usage.remaining < 5 ? 'limit-warning' : ''}`}>
          <div className="limit-info">
            <Zap size={16} />
            <span>Kunlik limit: <strong>{usage.used}</strong> / {usage.limit}</span>
            <span className="limit-remaining">Qoldi: {usage.remaining}</span>
          </div>
          <div className="limit-progress">
            <div
              className="limit-progress-fill"
              style={{ width: `${usagePercent}%` }}
            ></div>
          </div>
        </div>

        {/* Chat */}
        <div className="ait-chat">
          {messages.length === 0 ? (
            <div className="ait-welcome">
              <div className="ait-welcome-icon">
                <Sparkles size={48} />
              </div>
              <h2>Salom{user ? `, ${user.name}` : ''}!</h2>
              <p>Men sizning AI o'qituvchingizman. Quyidagi sohalarda professional yordam beraman:</p>

              <div className="ait-subjects-grid">
                {subjects.map((s, i) => (
                  <div
                    key={i}
                    className="ait-subject-card"
                    onClick={() => {
                      if (!user) { requireAuth(); return }
                      setInput(s.example)
                    }}
                  >
                    <div className="ait-subject-icon" style={{ background: s.color + '20', color: s.color }}>
                      <s.Icon size={24} />
                    </div>
                    <h4>{s.name}</h4>
                    <p>{s.desc}</p>
                    <div className="ait-subject-example">
                      <Lightbulb size={12} /> {s.example}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="ait-messages">
              {messages.map((m, i) => {
                const subjectInfo = m.subject ? getSubjectInfo(m.subject) : null

                return (
                  <div key={i} className={`ait-message ${m.role === 'user' ? 'msg-user' : 'msg-bot'}`}>
                    <div className="msg-avatar" style={subjectInfo ? { background: `linear-gradient(135deg, ${subjectInfo.color}, ${subjectInfo.color}dd)` } : {}}>
                      {m.role === 'user' ? (
                        <User size={18} />
                      ) : subjectInfo ? (
                        <subjectInfo.Icon size={18} />
                      ) : (
                        <Bot size={18} />
                      )}
                    </div>
                    <div className="msg-body">
                      <div className="msg-name">
                        {m.role === 'user' ? user.name : 'AI Teacher'}
                        {subjectInfo && (
                          <span className="msg-subject-badge" style={{ color: subjectInfo.color, background: subjectInfo.color + '15', borderColor: subjectInfo.color + '30' }}>
                            <subjectInfo.Icon size={11} /> {subjectInfo.label}
                          </span>
                        )}
                      </div>
                      <div className={`msg-content ${m.error ? 'msg-error' : ''}`}>
                        {m.image && (
                          <img
                            src={assetUrl(m.image)}
                            alt="yuborilgan rasm"
                            className="msg-image"
                          />
                        )}
                        {formatMessage(m.content)}
                      </div>
                      {m.role === 'assistant' && !m.error && (
                        <div className="msg-actions">
                          <button onClick={() => copyToClipboard(m.content)}>
                            <Copy size={12} /> Nusxalash
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {loading && (
                <div className="ait-message msg-bot">
                  <div className="msg-avatar">
                    <Bot size={18} />
                  </div>
                  <div className="msg-body">
                    <div className="msg-name">AI Teacher</div>
                    <div className="msg-typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef}></div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="ait-input-wrap">
          {isLimitReached && (
            <div className="ait-limit-message">
              <AlertCircle size={16} />
              Kunlik limit tugadi! Ertaga 20 ta yangi savol bera olasiz.
            </div>
          )}
          {image && (
            <div className="ait-image-preview">
              <img src={image.dataUrl} alt={image.name} />
              <div className="ait-image-info">
                <span className="ait-image-name">{image.name}</span>
                <span className="ait-image-size">{(image.size / 1024).toFixed(0)} KB</span>
              </div>
              <button className="ait-image-remove" onClick={removeImage} type="button" title="O'chirish">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="ait-input-box">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleImagePick}
            />
            <button
              className="ait-image-btn"
              onClick={() => { if (!requireAuth()) return; fileInputRef.current?.click() }}
              disabled={loading || isLimitReached || !!image}
              title="Rasm qo'shish"
              type="button"
            >
              <ImageIcon size={18} />
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => { if (!user) requireAuth() }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={!user ? "Ro'yxatdan o'tib savol yuboring..." : isLimitReached ? "Limit tugadi, ertaga qayta urunib ko'ring..." : image ? "Rasm haqida savolingiz (ixtiyoriy)..." : "Savolingizni yozing... (Enter = yuborish)"}
              rows={1}
              disabled={loading || isLimitReached}
            />
            <button
              className="ait-send"
              onClick={sendMessage}
              disabled={loading || isLimitReached || (user && !input.trim() && !image)}
            >
              <Send size={18} />
            </button>
          </div>
          <div className="ait-hint">
            <Sparkles size={12} /> AI mavzuni avtomatik aniqlaydi. Rasm ham yuborishingiz mumkin (max 4MB)
          </div>
        </div>

      </div>
    </div>
  )
}

export default AITeacher