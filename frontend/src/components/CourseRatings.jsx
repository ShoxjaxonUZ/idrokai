import { useState, useEffect } from 'react'
import { Star, Trash2, Edit3, Send, Loader2, MessageSquare } from 'lucide-react'
import { API_URL, getToken } from '../lib/api'
import './CourseRatings.css'

// Modul darajasida — har renderda qayta yaratilmasligi uchun
const Stars = ({ value, size = 16, color = '#F59E0B' }) => (
  <div style={{ display: 'inline-flex', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(n => (
      <Star
        key={n}
        size={size}
        fill={n <= value ? color : 'transparent'}
        color={n <= value ? color : 'var(--text-muted)'}
      />
    ))}
  </div>
)

export default function CourseRatings({ courseId, enrolled }) {
  const token = getToken()
  const [summary, setSummary] = useState({ total: 0, avg_rating: 0, distribution: {}, reviews: [] })
  const [myRating, setMyRating] = useState(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [review, setReview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!courseId) return
    loadAll()
  }, [courseId])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [allRes, myRes] = await Promise.all([
        fetch(`${API_URL}/api/course-ratings/${courseId}`).then(r => r.ok ? r.json() : null),
        token
          ? fetch(`${API_URL}/api/course-ratings/${courseId}/my`, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.ok ? r.json() : null)
          : null
      ])
      if (allRes) setSummary(allRes)
      if (myRes) {
        setMyRating(myRes)
        setRating(myRes.rating)
        setReview(myRes.review || '')
      }
    } catch {}
    setLoading(false)
  }

  const submit = async () => {
    if (!rating) return setError("Avval yulduzni tanlang")
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/api/course-ratings/${courseId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rating, review: review.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setEditing(false)
        await loadAll()
      } else {
        setError(data.message || 'Xatolik')
      }
    } catch {
      setError("Server bilan bog'lanib bo'lmadi")
    }
    setSubmitting(false)
  }

  const deleteMyRating = async () => {
    if (!confirm("Reytingingizni o'chirasizmi?")) return
    try {
      await fetch(`${API_URL}/api/course-ratings/${courseId}/my`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      setMyRating(null)
      setRating(0)
      setReview('')
      await loadAll()
    } catch {}
  }

  const formatDate = (ts) => {
    try {
      return new Date(ts).toLocaleDateString('uz-UZ', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    } catch { return ts }
  }


  if (loading) return (
    <div className="rt-loading"><Loader2 size={20} className="spin" /> Yuklanmoqda...</div>
  )

  const showForm = enrolled && (editing || !myRating)

  return (
    <div className="rt-wrap">
      {/* Sarlavha + summary */}
      <div className="rt-summary">
        <div className="rt-avg">
          <div className="rt-avg-num">{summary.avg_rating ? Number(summary.avg_rating).toFixed(1) : '—'}</div>
          <Stars value={Math.round(summary.avg_rating || 0)} size={18} />
          <div className="rt-avg-count">{summary.total} ta baho</div>
        </div>
        <div className="rt-distribution">
          {[5, 4, 3, 2, 1].map(star => {
            const count = summary.distribution?.[star] || 0
            const percent = summary.total > 0 ? (count / summary.total) * 100 : 0
            return (
              <div key={star} className="rt-dist-row">
                <span className="rt-dist-label">{star}★</span>
                <div className="rt-dist-bar">
                  <div className="rt-dist-fill" style={{ width: `${percent}%` }}></div>
                </div>
                <span className="rt-dist-count">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Form yoki o'z reytingni ko'rsatish */}
      {enrolled && (
        <div className="rt-my-section">
          {showForm ? (
            <>
              <div className="rt-form-label">{myRating ? "Reytingingizni yangilang" : "Kursni baholang"}</div>
              <div className="rt-star-picker">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    className="rt-star-btn"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    <Star
                      size={32}
                      fill={n <= (hoverRating || rating) ? '#F59E0B' : 'transparent'}
                      color={n <= (hoverRating || rating) ? '#F59E0B' : 'var(--text-muted)'}
                    />
                  </button>
                ))}
              </div>
              <textarea
                className="rt-review"
                placeholder="Kurs haqida fikr (ixtiyoriy)... Boshqalarga foydali bo'ladi."
                value={review}
                onChange={e => setReview(e.target.value.slice(0, 1000))}
                rows={3}
              />
              <div className="rt-form-actions">
                <span className="rt-char-count">{review.length}/1000</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {myRating && (
                    <button className="btn-outline btn-sm" onClick={() => {
                      setEditing(false)
                      setRating(myRating.rating)
                      setReview(myRating.review || '')
                      setError('')
                    }}>
                      Bekor qilish
                    </button>
                  )}
                  <button className="btn-primary btn-sm" onClick={submit} disabled={submitting || !rating}>
                    {submitting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                    {myRating ? 'Yangilash' : 'Yuborish'}
                  </button>
                </div>
              </div>
              {error && <div className="rt-error">{error}</div>}
            </>
          ) : (
            <div className="rt-my-display">
              <div>
                <div className="rt-form-label">Sizning reytingingiz</div>
                <Stars value={myRating.rating} size={20} />
                {myRating.review && <div className="rt-my-review">{myRating.review}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="rt-icon-btn" onClick={() => setEditing(true)} title="Tahrirlash">
                  <Edit3 size={14} />
                </button>
                <button className="rt-icon-btn rt-icon-danger" onClick={deleteMyRating} title="O'chirish">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!enrolled && summary.total === 0 && (
        <div className="rt-empty">
          <Star size={32} />
          <p>Hali hech kim baholaganmagan</p>
          <span>Kursni boshlagandan keyin baholay olasiz</span>
        </div>
      )}

      {/* Reviews list */}
      {summary.reviews.length > 0 && (
        <div className="rt-reviews">
          <div className="rt-reviews-title">
            <MessageSquare size={16} />
            <span>Sharhlar ({summary.reviews.length})</span>
          </div>
          <div className="rt-reviews-list">
            {summary.reviews.map(r => (
              <div key={r.id} className="rt-review-item">
                <div className="rt-review-header">
                  <strong>{r.user_name}</strong>
                  <Stars value={r.rating} size={13} />
                </div>
                {r.review && <p>{r.review}</p>}
                <span className="rt-review-date">{formatDate(r.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
