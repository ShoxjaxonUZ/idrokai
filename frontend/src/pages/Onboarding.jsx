import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Bot,
  Target, Clock, Briefcase, Loader2, BookOpen, Star, Trophy
} from 'lucide-react'
import { API_URL } from '../lib/api'
import '../styles/onboarding.css'

// Soddalashtirilgan: 3 ta asosiy savol — bottleneck'ni kamaytirish
const STEPS = ['welcome', 'goal', 'field', 'time', 'result']

const QUESTIONS = {
  goal: {
    title: 'Asosiy maqsadingiz nima?',
    subtitle: "IdrokAI'dan nimaga erishmoqchisiz?",
    Icon: Target,
    options: [
      { value: 'kasb', label: 'Yangi kasb egallash', desc: 'IT, dizayn, biznes va boshqalar' },
      { value: 'maktab', label: 'Maktab yoki Universitet', desc: "O'qishimga yordam kerak" },
      { value: 'karyera', label: "O'sish va sertifikat", desc: 'Yuqori darajaga ko\'tarilish' },
      { value: 'qiziqish', label: "Yangi narsa o'rganish", desc: 'Hobbi va qiziqish uchun' }
    ]
  },
  field: {
    title: 'Qaysi soha sizga yoqadi?',
    subtitle: "Asosiy yo'nalishni tanlang",
    Icon: Briefcase,
    options: [
      { value: 'dasturlash', label: 'Dasturlash', desc: 'Web, mobil va AI' },
      { value: 'dizayn', label: 'Dizayn', desc: 'UI/UX va grafika' },
      { value: 'biznes', label: 'Biznes', desc: 'Marketing va boshqaruv' },
      { value: 'matematika', label: 'Matematika va fan', desc: 'Hisoblash va fizika' },
      { value: 'til', label: "Til o'rganish", desc: 'Ingliz tili va boshqalar' }
    ]
  },
  time: {
    title: 'Kuniga qancha vaqt ajrata olasiz?',
    subtitle: 'Realistik baholang',
    Icon: Clock,
    options: [
      { value: '15min', label: '15 daqiqa', desc: 'Juda bandman' },
      { value: '30min', label: '30 daqiqa', desc: "Kuniga oz bo'lsa ham" },
      { value: '1hour', label: '1 soat', desc: 'Oddiy temp' },
      { value: '2hours+', label: '2 soatdan ortiq', desc: "Faol o'rganish" }
    ]
  }
}

function Onboarding() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user'))
  const token = localStorage.getItem('token')

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({
    goal: '',
    preferredField: '',
    availableTime: ''
  })

  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    document.title = "Konsultatsiya — IdrokAI"
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.onboarded) {
        navigate('/')
      }
    } catch {}
  }

  const currentStepName = STEPS[step]
  const totalSteps = STEPS.length - 2 // welcome va result hisobga olinmaydi
  const progress = step === 0 ? 0 : Math.min(100, ((step) / totalSteps) * 100)

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => Math.max(0, s - 1))

  const fieldKeyMap = {
    goal: 'goal',
    field: 'preferredField',
    time: 'availableTime'
  }

  const isLastQuestion = currentStepName === 'time'

  const selectOption = (questionKey, value, isMultiple = false) => {
    if (isMultiple) {
      setAnswers(prev => {
        const current = prev[questionKey] || []
        const exists = current.includes(value)
        return {
          ...prev,
          [questionKey]: exists ? current.filter(v => v !== value) : [...current, value]
        }
      })
    } else {
      setAnswers(prev => ({ ...prev, [questionKey]: value }))
      // Oxirgi savol bo'lmasa avtomatik keyingi
      if (!isLastQuestion) {
        setTimeout(() => next(), 300)
      }
    }
  }

  const completeOnboarding = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/api/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...answers, chatHistory: '' })
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        next()
      }
    } catch (err) {
      console.error(err)
    }
    setSubmitting(false)
  }

  // ============ WELCOME ============
  if (currentStepName === 'welcome') {
    return (
      <div className="onb-page">
        <div className="onb-bg-glow"></div>
        <div className="onb-welcome">
          <div className="onb-welcome-icon">
            <Sparkles size={64} />
          </div>
          <h1>Salom, {user?.name}!</h1>
          <p className="onb-welcome-sub">
            IdrokAI ga xush kelibsiz! Sizga eng mos kurslarni tavsiya qilish uchun
            bir necha savol so'raymiz. Atigi 1-2 daqiqa vaqtingizni oladi.
          </p>

          <div className="onb-features">
            <div className="onb-feature-item">
              <CheckCircle2 size={16} color="#22c55e" />
              <span>Atigi 3 ta oddiy savol</span>
            </div>
            <div className="onb-feature-item">
              <CheckCircle2 size={16} color="#22c55e" />
              <span>30 soniya vaqt oladi</span>
            </div>
            <div className="onb-feature-item">
              <CheckCircle2 size={16} color="#22c55e" />
              <span>AI sizga mos kurslarni tanlaydi</span>
            </div>
          </div>

          <button className="btn-primary btn-hero" onClick={next}>
            <Sparkles size={18} /> Boshlash
          </button>
        </div>
      </div>
    )
  }

  // ============ RESULT ============
  if (currentStepName === 'result' && result) {
    return (
      <div className="onb-page">
        <div className="onb-bg-glow"></div>
        <div className="onb-result">
          <div className="onb-result-icon">
            <Trophy size={72} />
          </div>
          <div className="onb-badge">
            <Sparkles size={14} /> Tavsiyalar tayyor
          </div>
          <h1>Sizga eng mos <span className="gradient-text">kurslar tanlandi</span></h1>

          {result.advice && (
            <div className="onb-advice-box">
              <Bot size={24} color="#8b5cf6" />
              <div>
                <h4>AI maslahati</h4>
                <p>{result.advice}</p>
              </div>
            </div>
          )}

          {result.studyPlan && (
            <div className="onb-advice-box" style={{ borderColor: 'rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.08)' }}>
              <Target size={24} color="#22c55e" />
              <div>
                <h4>O'qish rejasi</h4>
                <p>{result.studyPlan}</p>
              </div>
            </div>
          )}

          <h3 className="onb-recom-title">
            <Star size={20} color="#f59e0b" /> Tavsiya etilgan kurslar
          </h3>

          <div className="onb-recom-list">
            {result.recommendedCourses?.map(course => (
              <div key={course.id} className="onb-recom-card" onClick={() => navigate(`/courses/${course.id}`)}>
                <div className="onb-recom-icon">
                  <BookOpen size={28} />
                </div>
                <div className="onb-recom-info">
                  <h4>{course.title}</h4>
                  <div className="onb-recom-meta">
                    <span>{course.category}</span>
                    <span>•</span>
                    <span>{course.daraja}</span>
                  </div>
                </div>
                <ArrowRight size={20} color="var(--primary-light)" />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px', flexWrap: 'wrap' }}>
            <button className="btn-outline" onClick={() => navigate('/')}>
              Bosh sahifa
            </button>
            <button className="btn-primary btn-hero" onClick={() => navigate('/courses')}>
              <BookOpen size={18} /> Kurslarga o'tish
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============ TEST QUESTIONS ============
  const question = QUESTIONS[currentStepName]
  if (!question) return null

  const QIcon = question.Icon
  const isMultiple = question.multiple
  const fieldKey = fieldKeyMap[currentStepName]
  const currentValue = answers[fieldKey]
  const canContinue = isMultiple ? (currentValue?.length > 0) : !!currentValue

  return (
    <div className="onb-page">
      <div className="onb-progress-bar">
        <div className="onb-progress-fill" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="onb-container">
        <div className="onb-step-counter">
          {step}-bosqich / {totalSteps}
        </div>

        <div className="onb-question-icon">
          <QIcon size={36} />
        </div>

        <h2 className="onb-question-title">{question.title}</h2>
        <p className="onb-question-sub">{question.subtitle}</p>

        <div className={`onb-options ${isMultiple ? 'onb-options-multi' : ''}`}>
          {question.options.map(opt => {
            const isSelected = isMultiple
              ? currentValue?.includes(opt.value)
              : currentValue === opt.value

            return (
              <button
                key={opt.value}
                className={`onb-option ${isSelected ? 'onb-option-active' : ''}`}
                onClick={() => selectOption(fieldKey, opt.value, isMultiple)}
              >
                <div className="onb-option-text">
                  <div className="onb-option-label">{opt.label}</div>
                  {opt.desc && <div className="onb-option-desc">{opt.desc}</div>}
                </div>
                {isSelected && <CheckCircle2 size={18} color="#22c55e" />}
              </button>
            )
          })}
        </div>

        <div className="onb-nav">
          {step > 1 && (
            <button className="btn-outline" onClick={back}>
              <ArrowLeft size={16} /> Orqaga
            </button>
          )}

          {/* Oxirgi savol — Tavsiyalarni olish tugmasi */}
          {isLastQuestion && canContinue && (
            <button
              className="btn-primary btn-hero"
              onClick={completeOnboarding}
              disabled={submitting}
              style={{ marginLeft: 'auto' }}
            >
              {submitting ? (
                <><Loader2 size={18} className="spin" /> Tahlil qilinmoqda...</>
              ) : (
                <><Sparkles size={18} /> Tavsiyalarni olish</>
              )}
            </button>
          )}

          {/* Multiple — Keyingi tugmasi */}
          {isMultiple && !isLastQuestion && (
            <button
              className="btn-primary"
              onClick={next}
              disabled={!canContinue}
              style={{ marginLeft: 'auto' }}
            >
              Keyingi <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Onboarding