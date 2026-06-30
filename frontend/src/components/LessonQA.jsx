import { useState, useEffect } from 'react'
import {
  MessageCircleQuestion, Send, ThumbsUp, Trash2, CornerDownRight,
  Loader2, CheckCircle2, Shield
} from 'lucide-react'
import { API_URL, getToken, getUser } from '../lib/api'
import './LessonQA.css'

export default function LessonQA({ courseId, lessonIndex }) {
  const token = getToken()
  const user = getUser()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [newQ, setNewQ] = useState('')
  const [posting, setPosting] = useState(false)
  const [answerDrafts, setAnswerDrafts] = useState({}) // {qId: text}
  const [answering, setAnswering] = useState({})
  const [showAnswerFor, setShowAnswerFor] = useState(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!courseId || isNaN(lessonIndex)) return
    const ctrl = new AbortController()
    loadQA(ctrl.signal)
    return () => ctrl.abort()
  }, [courseId, lessonIndex])

  const loadQA = async (signal) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/lesson-qa/${courseId}/${lessonIndex}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}, signal
      })
      const data = await res.json()
      if (Array.isArray(data)) setQuestions(data)
    } catch (err) {
      if (err.name === 'AbortError') return
    }
    if (signal?.aborted) return
    setLoading(false)
  }

  const askQuestion = async () => {
    const q = newQ.trim()
    if (q.length < 5) return
    setPosting(true)
    try {
      const res = await fetch(`${API_URL}/api/lesson-qa/${courseId}/${lessonIndex}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ question: q })
      })
      if (res.ok) {
        setNewQ('')
        await loadQA()
      }
    } catch {}
    setPosting(false)
  }

  const submitAnswer = async (qId) => {
    const a = (answerDrafts[qId] || '').trim()
    if (a.length < 5) return
    setAnswering(prev => ({ ...prev, [qId]: true }))
    try {
      const res = await fetch(`${API_URL}/api/lesson-qa/${qId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answer: a })
      })
      if (res.ok) {
        setAnswerDrafts(prev => ({ ...prev, [qId]: '' }))
        setShowAnswerFor(null)
        await loadQA()
      }
    } catch {}
    setAnswering(prev => ({ ...prev, [qId]: false }))
  }

  const toggleUpvote = async (qId) => {
    if (!token) return
    // Optimistic
    setQuestions(prev => prev.map(q =>
      q.id === qId
        ? { ...q, upvotes: q.my_vote ? q.upvotes - 1 : q.upvotes + 1, my_vote: !q.my_vote }
        : q
    ))
    try {
      await fetch(`${API_URL}/api/lesson-qa/${qId}/upvote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch {}
  }

  const deleteQuestion = async (qId) => {
    if (!confirm("Savolni o'chirasizmi?")) return
    try {
      await fetch(`${API_URL}/api/lesson-qa/${qId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      setQuestions(prev => prev.filter(q => q.id !== qId))
    } catch {}
  }

  const formatTime = (ts) => {
    try {
      const d = new Date(ts)
      const diff = (Date.now() - d) / 1000
      if (diff < 60) return 'hozir'
      if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`
      if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`
      if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} kun oldin`
      return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' })
    } catch { return '' }
  }

  return (
    <div className="qa-panel">
      <button
        className="qa-toggle"
        onClick={() => setCollapsed(c => !c)}
        type="button"
      >
        <MessageCircleQuestion size={18} />
        <span>Savol-javob</span>
        {questions.length > 0 && (
          <span className="qa-count-badge">{questions.length}</span>
        )}
        <span className="qa-toggle-state">{collapsed ? "Ko'rish" : "Yopish"}</span>
      </button>

      {!collapsed && (
        <div className="qa-body">
          {/* Yangi savol formasi */}
          {user && (
            <div className="qa-ask-form">
              <textarea
                className="qa-ask-input"
                placeholder="Bu dars haqida savolingiz bormi? Yozing — boshqalar ham foydalanadi"
                value={newQ}
                onChange={e => setNewQ(e.target.value.slice(0, 1000))}
                rows={2}
                disabled={posting}
              />
              <div className="qa-ask-footer">
                <span className="qa-char">{newQ.length}/1000</span>
                <button
                  className="btn-primary btn-sm"
                  onClick={askQuestion}
                  disabled={posting || newQ.trim().length < 5}
                >
                  {posting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                  Savol berish
                </button>
              </div>
            </div>
          )}

          {/* Savollar ro'yxati */}
          {loading ? (
            <div className="qa-loading">
              <Loader2 size={20} className="spin" /> Yuklanmoqda...
            </div>
          ) : questions.length === 0 ? (
            <div className="qa-empty">
              <MessageCircleQuestion size={36} />
              <p>Hali savol yo'q</p>
              <span>Birinchi savol siz beraysizmi?</span>
            </div>
          ) : (
            <div className="qa-list">
              {questions.map(q => {
                const isMine = user && q.user_id === user.id
                const isAdminAnswer = q.answered_by_role === 'admin'

                return (
                  <div key={q.id} className={`qa-item ${q.answer ? 'qa-answered' : ''}`}>
                    {/* Savol */}
                    <div className="qa-question">
                      <div className="qa-q-header">
                        <strong>{q.user_name}</strong>
                        <span className="qa-time">{formatTime(q.created_at)}</span>
                      </div>
                      <p className="qa-q-text">{q.question}</p>

                      <div className="qa-q-actions">
                        <button
                          className={`qa-vote-btn ${q.my_vote ? 'voted' : ''}`}
                          onClick={() => toggleUpvote(q.id)}
                          disabled={!user}
                        >
                          <ThumbsUp size={12} /> {q.upvotes}
                        </button>
                        {!q.answer && user && (
                          <button
                            className="qa-answer-btn"
                            onClick={() => setShowAnswerFor(showAnswerFor === q.id ? null : q.id)}
                          >
                            <CornerDownRight size={12} /> Javob yozish
                          </button>
                        )}
                        {(isMine || user?.role === 'admin') && (
                          <button
                            className="qa-del-btn"
                            onClick={() => deleteQuestion(q.id)}
                            title="O'chirish"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Javob (mavjud bo'lsa) */}
                    {q.answer && (
                      <div className="qa-answer">
                        <div className="qa-a-header">
                          <CheckCircle2 size={14} />
                          <strong>{q.answered_by_name}</strong>
                          {isAdminAnswer && (
                            <span className="qa-role-badge qa-role-admin">
                              <Shield size={10} /> Admin
                            </span>
                          )}
                          <span className="qa-time">{formatTime(q.answered_at)}</span>
                        </div>
                        <p className="qa-a-text">{q.answer}</p>
                      </div>
                    )}

                    {/* Javob yozish formasi */}
                    {showAnswerFor === q.id && !q.answer && (
                      <div className="qa-reply-form">
                        <textarea
                          placeholder="Javobingizni yozing..."
                          value={answerDrafts[q.id] || ''}
                          onChange={e => setAnswerDrafts(prev => ({ ...prev, [q.id]: e.target.value.slice(0, 2000) }))}
                          rows={2}
                          disabled={!!answering[q.id]}
                        />
                        <div className="qa-reply-actions">
                          <button
                            className="btn-outline btn-sm"
                            onClick={() => setShowAnswerFor(null)}
                          >
                            Bekor
                          </button>
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => submitAnswer(q.id)}
                            disabled={!!answering[q.id] || (answerDrafts[q.id] || '').trim().length < 5}
                          >
                            {answering[q.id] ? <Loader2 size={12} className="spin" /> : <Send size={12} />}
                            Yuborish
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
