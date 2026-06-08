import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, Rocket, RefreshCw, BookOpen, Trophy,
  ArrowRight, CheckCircle2, XCircle, Sparkles, Target,
  Lightbulb
} from 'lucide-react'
import { API_URL } from '../lib/api'
import Navbar from '../components/Navbar'
import GuestBanner from '../components/GuestBanner'
import '../styles/aiquiz.css'

function AIQuiz() {
  const navigate = useNavigate()

  const user = JSON.parse(localStorage.getItem('user'))
  const token = localStorage.getItem('token')

  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(5)
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const requireAuth = () => {
    if (!user) {
      navigate('/register', { state: { from: { pathname: '/ai-quiz' } } })
      return false
    }
    return true
  }

  useEffect(() => {
    document.title = "AI Test — Eduzy"
  }, [])

  const generateQuiz = async () => {
    if (!requireAuth()) return
    if (!topic.trim()) return setError('Mavzu kiriting')
    setError('')
    setLoading(true)

    try {
      const body = { topic: topic.trim(), count }

      const res = await fetch(`${API_URL}/api/ai/generate-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data.questions)) {
        setQuestions(data.questions)
        setCurrentIndex(0)
        setSelected(null)
        setAnswers([])
        setFinished(false)
      } else {
        setError(data.message || 'Test yaratishda xatolik')
      }
    } catch {
      setError('Server bilan bog\'lanib bo\'lmadi')
    }
    setLoading(false)
  }

  const answerQuestion = (optionIndex) => {
    if (selected !== null) return
    setSelected(optionIndex)
  }

  const nextQuestion = () => {
    const q = questions[currentIndex]
    const isCorrect = selected === q.correct
    const newAnswers = [...answers, { question: q.question, selected, correct: q.correct, options: q.options, isCorrect }]
    setAnswers(newAnswers)

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1)
      setSelected(null)
    } else {
      setFinished(true)
    }
  }

  const reset = () => {
    setQuestions([])
    setCurrentIndex(0)
    setSelected(null)
    setAnswers([])
    setFinished(false)
    setError('')
  }

  // FINISHED SCREEN
  if (finished) {
    const correctCount = answers.filter(a => a.isCorrect).length
    const percent = Math.round((correctCount / questions.length) * 100)
    const passed = percent >= 80
    const color = passed ? '#22c55e' : '#ef4444'

    return (
      <div>
        <Navbar />
        <div className="aiquiz-page">
          <div className="aiquiz-result">
            <div className="result-emoji">
              {passed ? <Trophy size={80} color="#f59e0b" /> : <Target size={80} color="#ef4444" />}
            </div>
            <h2>{passed ? 'Ajoyib natija!' : 'Yana bir urinib ko\'ring'}</h2>
            <div className="aiquiz-topic-badge">
              <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              {topic}
            </div>

            <div className="result-score" style={{ color }}>
              {correctCount}/{questions.length}
            </div>
            <div className="result-percent">{percent}%</div>

            <div className="result-bar">
              <div className="result-fill" style={{
                width: `${percent}%`,
                background: color,
                color
              }}></div>
            </div>

            <div className="aiquiz-answers">
              <h3>
                <BookOpen size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                Javoblar tahlili
              </h3>
              {answers.map((a, i) => (
                <div key={i} className={`aiquiz-answer-item ${a.isCorrect ? 'answer-correct' : 'answer-wrong'}`}>
                  <div className="aiquiz-q">{i + 1}. {a.question}</div>
                  <div className="aiquiz-a">
                    {a.isCorrect ? (
                      <CheckCircle2 size={14} color="#22c55e" />
                    ) : (
                      <XCircle size={14} color="#ef4444" />
                    )}
                    <span>Sizning javobingiz: <strong>{a.options[a.selected]}</strong></span>
                  </div>
                  {!a.isCorrect && (
                    <div className="aiquiz-correct">
                      <Lightbulb size={14} />
                      <span>To'g'ri javob: <strong>{a.options[a.correct]}</strong></span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="result-actions">
              <button className="btn-outline" onClick={reset}>
                <RefreshCw size={16} /> Yangi test
              </button>
              <button className="btn-primary" onClick={() => navigate('/courses')}>
                <BookOpen size={16} /> Kurslarga o'tish
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // QUIZ SCREEN
  if (questions.length > 0) {
    const q = questions[currentIndex]
    const progress = ((currentIndex + 1) / questions.length) * 100

    return (
      <div>
        <Navbar />
        <div className="aiquiz-page">
          <div className="quiz-card">
            <div className="quiz-header">
              <div className="quiz-course">
                <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                {topic}
              </div>
              <div className="quiz-progress">
                {currentIndex + 1} / {questions.length}
              </div>
            </div>

            <div className="quiz-progressbar">
              <div className="quiz-progressfill" style={{ width: `${progress}%` }}></div>
            </div>

            <div className="quiz-question">{q.question}</div>

            <div className="quiz-options">
              {q.options.map((opt, i) => {
                let cls = 'quiz-option'
                if (selected !== null) {
                  if (i === q.correct) cls += ' option-correct'
                  else if (i === selected) cls += ' option-wrong'
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => answerQuestion(i)}
                    disabled={selected !== null}
                  >
                    <span className="option-letter">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>{opt}</span>
                  </button>
                )
              })}
            </div>

            {selected !== null && (
              <button className="btn-primary quiz-next" onClick={nextQuestion}>
                {currentIndex + 1 < questions.length ? (
                  <>Keyingi savol <ArrowRight size={16} /></>
                ) : (
                  <><Trophy size={16} /> Natijani ko'rish</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // GENERATE SCREEN
  return (
    <div>
      <Navbar />
      <div className="aiquiz-page">
        {!user && (
          <GuestBanner
            title="AI Test — istalgan mavzu bo'yicha"
            subtitle="AI siz tanlagan mavzu uchun individual savollar yaratadi. Ro'yxatdan o'tib boshlang"
          />
        )}
        <div className="aiquiz-generate">
          <div className="aiquiz-icon">
            <Bot size={44} />
          </div>
          <h2>AI Test</h2>
          <p>Istalgan mavzu bo'yicha bilimingizni AI yordamida tekshiring!</p>

          <div className="aiquiz-form">
            {error && <div className="aiquiz-error">{error}</div>}

            <div className="form-group">
              <label>Mavzu</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Masalan: Python asoslari, Matematika..."
              />
            </div>

            <div className="form-group">
              <label>Savollar soni</label>
              <div className="count-select">
                {[5, 10, 15, 20].map(n => (
                  <button
                    key={n}
                    className={`count-btn ${count === n ? 'count-active' : ''}`}
                    onClick={() => setCount(n)}
                  >
                    {n} ta
                  </button>
                ))}
              </div>
            </div>

            <div className="aiquiz-examples">
              <p>
                <Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Mashhur mavzular:
              </p>
              <div className="aiquiz-tags">
                {['Python', 'JavaScript', 'React', 'HTML va CSS', 'Matematika', 'Ingliz tili', 'Rus Tili', 'Matematika'].map(t => (
                  <button
                    key={t}
                    className="aiquiz-tag"
                    onClick={() => setTopic(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-primary aiquiz-btn"
              onClick={generateQuiz}
              disabled={loading}
            >
              {loading ? (
                <span className="aiquiz-loading">
                  <span className="aiquiz-spinner"></span>
                  AI test yaratmoqda...
                </span>
              ) : (
                <><Rocket size={18} /> Testni boshlash</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIQuiz