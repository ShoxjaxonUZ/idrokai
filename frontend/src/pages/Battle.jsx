import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Swords, Plus, Users, Trophy, Copy, LogOut, Zap,
  Clock, Send, Code, Shield, Crown, Medal, Award, Code2,
  User, UserPlus, Hash, Play, CheckCircle2, Loader2, Minus, AlertCircle,
  Share2, MessageCircle, Link as LinkIcon, Check, History, ChevronRight,
  BarChart3, Flame
} from 'lucide-react'
import { API_URL } from '../lib/api'
import Navbar from '../components/Navbar'
import GuestBanner from '../components/GuestBanner'
import { useNotification } from '../context/NotificationContext'
import '../styles/battle.css'

const LANGUAGES = [
  { id: 'python', name: 'Python' },
  { id: 'javascript', name: 'JavaScript' },
  { id: 'cpp', name: 'C++' },
  { id: 'java', name: 'Java' },
]

const DIFFICULTIES = [
  { id: 'oson', name: 'Oson' },
  { id: 'orta', name: "O'rta" },
  { id: 'qiyin', name: 'Qiyin' },
]

function Battle() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const notif = useNotification()
  const addNotification = notif?.addNotification || (() => {})
  const user = (() => { try { return JSON.parse(localStorage.getItem('user')) } catch { return null } })()
  const token = localStorage.getItem('token')
  const [copyOk, setCopyOk] = useState(false)

  const [view, setView] = useState('lobby')
  const [language, setLanguage] = useState('python')
  const [maxPlayers, setMaxPlayers] = useState(2)
  const [difficulty, setDifficulty] = useState('orta')
  const [joinId, setJoinId] = useState('')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [currentBattle, setCurrentBattle] = useState(null)
  const [code, setCode] = useState('')
  const [timeLeft, setTimeLeft] = useState(300)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [leaderboard, setLeaderboard] = useState([])
  const [weekly, setWeekly] = useState([])
  const [history, setHistory] = useState([])
  const [loadingAction, setLoadingAction] = useState('')

  const timerRef = useRef(null)
  const pollRef = useRef(null)
  const isLockedRef = useRef(false)

  // Guest helper — interaktiv action'larda register sahifaga yo'naltirish
  const requireAuth = () => {
    if (!user) {
      navigate('/register', { state: { from: { pathname: '/battle' } } })
      return false
    }
    return true
  }

  // URL parameter ?join=ABC123 — link orqali kelganda auto-fill
  useEffect(() => {
    const joinParam = searchParams.get('join')
    if (joinParam && joinParam.length === 6) {
      if (!user) {
        navigate('/register', { state: { from: { pathname: `/battle?join=${joinParam}` } } })
        return
      }
      setJoinId(joinParam.toUpperCase())
      setShowJoinModal(true)
      // Parametrni URL'dan tozalash
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  // Sahifa yuklanganda
  useEffect(() => {
    document.title = "Code Battle — Eduzy"
    loadLeaderboard()
    loadWeekly()

    if (!user) return
    loadHistory()

    const savedBattleId = localStorage.getItem('active_battle')
    if (savedBattleId) {
      restoreBattle(savedBattleId)
    }

    return () => {
      clearInterval(timerRef.current)
      clearInterval(pollRef.current)
    }
  }, [])

  // BATTLE — yengilroq himoya
  // Haqiqiy himoya server tomonida: bir foydalanuvchi bir battle'ga faqat bir marta yuboradi.
  // Bu yerda faqat foydalanuvchini ogohlantiramiz va tashqi oynaga o'tishni signal sifatida belgilaymiz.
  // F12/right-click/Ctrl+R kabi bloklar texnik ravishda chetlab o'tiladi va normal UX'ni buzadi —
  // ularni olib tashladik.
  useEffect(() => {
    const isPlaying = view === 'playing' && !submitted
    isLockedRef.current = isPlaying
    if (!isPlaying) return

    // Refresh/yopish — ogohlantirish (saqlanmagan kod uchun)
    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = 'Battle davom etmoqda! Sahifani yopsangiz natija saqlanmaydi.'
      return e.returnValue
    }

    // Tab/oyna almashtirilsa anti-cheat signali (server'ga yuborilmaydi, faqat foydalanuvchini ogohlantiradi)
    let hiddenAt = null
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else if (hiddenAt) {
        const awayMs = Date.now() - hiddenAt
        hiddenAt = null
        if (awayMs > 1500) {
          addNotification(
            `Diqqat! Battle oynasidan ${Math.round(awayMs / 1000)} soniya tashqarida bo'ldingiz`,
            'warning'
          )
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [view, submitted, addNotification])

  // Code real-time saqlash
  useEffect(() => {
    if (currentBattle?.id && code && view === 'playing') {
      localStorage.setItem(`battle_code_${currentBattle.id}`, code)
    }
  }, [code, currentBattle, view])

  const loadLeaderboard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/battle/leaderboard`)
      const data = await res.json()
      if (Array.isArray(data)) setLeaderboard(data.slice(0, 10))
    } catch { }
  }

  const loadWeekly = async () => {
    try {
      const res = await fetch(`${API_URL}/api/battle/weekly`)
      const data = await res.json()
      if (Array.isArray(data)) setWeekly(data)
    } catch { }
  }

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/battle/history`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) setHistory(data)
    } catch { }
  }

  // Tarixdan o'tgan battle yechimlarini ko'rish — mavjud result ekrani
  const viewBattleResult = async (battleId) => {
    try {
      const res = await fetch(`${API_URL}/api/battle/status/${battleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setCurrentBattle(data)
        setView('result')
      }
    } catch { }
  }

  const restoreBattle = async (battleId) => {
    try {
      const res = await fetch(`${API_URL}/api/battle/status/${battleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()

      if (!res.ok) {
        localStorage.removeItem('active_battle')
        localStorage.removeItem(`battle_code_${battleId}`)
        return
      }

      if (data.status === 'finished') {
        setCurrentBattle(data)
        setView('result')
        localStorage.removeItem('active_battle')
        return
      }

      setCurrentBattle(data)
      if (data.status === 'playing') {
        const savedCode = localStorage.getItem(`battle_code_${battleId}`)
        setCode(savedCode || data.template || '')

        const isSub = data.submissions?.some(s => s.user_id === user.id)
        setSubmitted(isSub || false)
        setView('playing')
        if (!isSub) startTimer()
      } else {
        setView('waiting')
      }
      startPolling(battleId)
    } catch (err) {
      console.error(err)
      localStorage.removeItem('active_battle')
    }
  }

  const startTimer = () => {
    setTimeLeft(300)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setSubmitted(s => {
            if (!s) submitCodeAuto()
            return s
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const startPolling = (battleId) => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/battle/status/${battleId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) return
        const data = await res.json()

        if (data.status === 'finished') {
          clearInterval(pollRef.current)
          clearInterval(timerRef.current)
          setCurrentBattle(data)
          setView('result')
          localStorage.removeItem('active_battle')
          loadLeaderboard()
          return
        }

        setCurrentBattle(prev => {
          if (data.status === 'playing' && prev?.status !== 'playing') {
            setTimeout(() => {
              setCode(data.template || '')
              setView('playing')
              startTimer()
              addNotification('Battle boshlandi!', 'success')
            }, 0)
          }
          return data
        })
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 2000)
  }

  const fetchBattleStatus = async (id) => {
    const res = await fetch(`${API_URL}/api/battle/status/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return await res.json()
  }

  const createRoom = async () => {
    if (!requireAuth()) return
    setError('')
    setLoadingAction('create')
    try {
      const res = await fetch(`${API_URL}/api/battle/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ language, maxPlayers, difficulty })
      })
      const data = await res.json()
      if (res.ok) {
        const battleData = await fetchBattleStatus(data.id)
        setCurrentBattle(battleData)
        localStorage.setItem('active_battle', data.id)
        setView('waiting')
        startPolling(data.id)
        addNotification('Xona yaratildi!', 'success')
      } else {
        setError(data.message)
      }
    } catch {
      setError('Server bilan bog\'lanib bo\'lmadi')
    }
    setLoadingAction('')
  }

  const joinRoom = async () => {
    if (!requireAuth()) return
    if (!joinId.trim()) return setError('ID kiriting')
    setError('')
    setLoadingAction('join')
    try {
      const res = await fetch(`${API_URL}/api/battle/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ battleId: joinId.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        const battleData = await fetchBattleStatus(data.id)
        setCurrentBattle(battleData)
        localStorage.setItem('active_battle', data.id)
        setShowJoinModal(false)
        setJoinId('')

        if (battleData.status === 'playing') {
          setCode(battleData.template || '')
          setView('playing')
          startTimer()
        } else {
          setView('waiting')
        }
        startPolling(data.id)
        addNotification('Xonaga qo\'shildingiz!', 'success')
      } else {
        setError(data.message)
      }
    } catch {
      setError('Server bilan bog\'lanib bo\'lmadi')
    }
    setLoadingAction('')
  }

  const startSolo = async () => {
    if (!requireAuth()) return
    setError('')
    setLoadingAction('solo')
    try {
      const res = await fetch(`${API_URL}/api/battle/solo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ language, difficulty })
      })
      const data = await res.json()
      if (res.ok) {
        const battleData = await fetchBattleStatus(data.id)
        setCurrentBattle(battleData)
        localStorage.setItem('active_battle', data.id)
        setCode(battleData.template || '')
        setView('playing')
        startTimer()
        startPolling(data.id)
        addNotification('Solo battle boshlandi!', 'success')
      } else {
        setError(data.message)
      }
    } catch {
      setError('Server bilan bog\'lanib bo\'lmadi')
    }
    setLoadingAction('')
  }

  const randomMatch = async () => {
    if (!requireAuth()) return
    setError('')
    setLoadingAction('random')
    try {
      const res = await fetch(`${API_URL}/api/battle/random`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ language, difficulty })
      })
      const data = await res.json()
      if (res.ok) {
        const battleData = await fetchBattleStatus(data.id)
        setCurrentBattle(battleData)
        localStorage.setItem('active_battle', data.id)

        if (battleData.status === 'playing') {
          setCode(battleData.template || '')
          setView('playing')
          startTimer()
          addNotification('Raqib topildi!', 'success')
        } else {
          setView('waiting')
          addNotification('Raqib qidirilmoqda...', 'info')
        }
        startPolling(data.id)
      } else {
        setError(data.message)
      }
    } catch {
      setError('Server bilan bog\'lanib bo\'lmadi')
    }
    setLoadingAction('')
  }

  const startBattle = async () => {
    if (!currentBattle) return
    setLoadingAction('start')
    try {
      const res = await fetch(`${API_URL}/api/battle/start/${currentBattle.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) setError(data.message)
    } catch {
      setError('Xatolik')
    }
    setLoadingAction('')
  }

  const cancelBattle = async () => {
    if (!currentBattle) return
    try {
      await fetch(`${API_URL}/api/battle/cancel/${currentBattle.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch { }
    clearInterval(pollRef.current)
    clearInterval(timerRef.current)
    localStorage.removeItem('active_battle')
    if (currentBattle?.id) localStorage.removeItem(`battle_code_${currentBattle.id}`)
    setView('lobby')
    setCurrentBattle(null)
    setSubmitted(false)
    addNotification('Xona bekor qilindi', 'info')
  }

  const submitCode = async () => {
    if (submitting || submitted || !currentBattle) return
    setSubmitting(true)

    try {
      const res = await fetch(`${API_URL}/api/battle/submit/${currentBattle.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: code || '',
          time_taken: 300 - timeLeft
        })
      })
      const data = await res.json()
      if (res.ok) {
        setSubmitted(true)
        clearInterval(timerRef.current)
        addNotification(`Yuborildi! Sizning ballingiz: ${data.score}`, 'success')
      } else {
        setError(data.message)
      }
    } catch {
      setError('Yuborishda xatolik')
    }
    setSubmitting(false)
  }

  const submitCodeAuto = async () => {
    if (submitted || !currentBattle) return
    setSubmitting(true)
    try {
      await fetch(`${API_URL}/api/battle/submit/${currentBattle.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: code || '',
          time_taken: 300
        })
      })
      setSubmitted(true)
      addNotification('Vaqt tugadi! Avtomatik yuborildi', 'info')
    } catch { }
    setSubmitting(false)
  }

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const backToLobby = () => {
    clearInterval(pollRef.current)
    clearInterval(timerRef.current)
    if (currentBattle?.id) {
      localStorage.removeItem('active_battle')
      localStorage.removeItem(`battle_code_${currentBattle.id}`)
    }
    setView('lobby')
    setCurrentBattle(null)
    setSubmitted(false)
    setCode('')
    setError('')
  }

  // ============ PLAYING SCREEN ============
  if (view === 'playing' && currentBattle) {
    const isSolo = currentBattle.mode === 'solo'
    const totalPlayers = currentBattle.players?.length || 1
    const submittedCount = currentBattle.players?.filter(p => p.submitted).length || 0

    return (
      <div className="battle-fullscreen">
        <div className="battle-topbar">
          <div className="battle-topbar-left">
            <div className="battle-logo">
              <Swords size={18} /> {isSolo ? 'Solo Battle' : 'Battle'}
            </div>
            <span className="battle-lang-badge">
              <Code2 size={12} /> {currentBattle.language}
            </span>
            {!isSolo && (
              <span className="battle-players-count">
                <Users size={12} /> {submittedCount}/{totalPlayers}
              </span>
            )}
            <span className="battle-locked-badge">
              <AlertCircle size={12} /> Sahifa qulflangan
            </span>
          </div>
          <div className={`battle-timer ${timeLeft < 60 ? 'timer-danger' : timeLeft < 120 ? 'timer-warning' : ''}`}>
            <Clock size={20} /> {formatTime(timeLeft)}
          </div>
          <button
            className="btn-primary"
            onClick={submitCode}
            disabled={submitting || submitted}
          >
            <Send size={16} /> {submitted ? 'Yuborildi' : submitting ? 'Yuborilmoqda...' : 'Yuborish'}
          </button>
        </div>

        <div className="battle-layout">
          <div className="battle-problem">
            <h3><Code size={16} /> Masala</h3>
            <div className="problem-content">
              <h4>{currentBattle.problem_title}</h4>
              <pre>{currentBattle.problem}</pre>
            </div>

            {!isSolo && currentBattle.players && (
              <div className="battle-players-list">
                <div className="players-list-title">
                  <Users size={14} /> O'yinchilar
                </div>
                {currentBattle.players.map(p => (
                  <div key={p.user_id} className={`player-row ${p.submitted ? 'player-done' : ''}`}>
                    <div className="player-avatar" style={{
                      background: p.user_id === user.id
                        ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
                        : 'linear-gradient(135deg, #0ea5e9, #0284c7)'
                    }}>
                      {p.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="player-name">
                      {p.name} {p.user_id === user.id && '(siz)'}
                    </span>
                    {p.submitted ? (
                      <CheckCircle2 size={16} color="#22c55e" />
                    ) : (
                      <Loader2 size={14} className="spin-icon" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {submitted && (
              <div className="submitted-banner">
                <Trophy size={20} />
                {isSolo ? 'AI baholamoqda...' : `Boshqa o'yinchilar kutilmoqda... (${submittedCount}/${totalPlayers})`}
              </div>
            )}
          </div>

          <div className="battle-editor">
            <div className="editor-header">
              <span>main.{
                currentBattle.language === 'python' ? 'py' :
                  currentBattle.language === 'javascript' ? 'js' :
                    currentBattle.language === 'cpp' ? 'cpp' : 'java'
              }</span>
              <span>{code.length} belgi</span>
            </div>
            <textarea
              className="battle-textarea"
              value={code}
              onChange={e => setCode(e.target.value)}
              onPaste={e => {
                e.preventDefault()
              }}
              onCopy={e => {
                e.preventDefault()
              }}
              onCut={e => {
                e.preventDefault()
              }}
              onKeyDown={e => {
                // Ctrl+C, Ctrl+V, Ctrl+X bloklash
                if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
                  e.preventDefault()
                  return
                }

                if (e.key === 'Tab') {
                  e.preventDefault()
                  const start = e.target.selectionStart
                  const end = e.target.selectionEnd
                  const newCode = code.substring(0, start) + '    ' + code.substring(end)
                  setCode(newCode)
                  setTimeout(() => {
                    e.target.selectionStart = e.target.selectionEnd = start + 4
                  }, 0)
                }
              }}
              spellCheck={false}
              disabled={submitted}
              placeholder="Kodingizni shu yerga yozing..."
            />
          </div>
        </div>
      </div>
    )
  }

  // ============ RESULT SCREEN ============
  if (view === 'result' && currentBattle) {
    const isSolo = currentBattle.mode === 'solo'
    const mySubmission = currentBattle.submissions?.find(s => s.user_id === user.id)
    const sortedSubs = [...(currentBattle.submissions || [])].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.time_taken - b.time_taken
    })
    const iWon = currentBattle.winner_id === user.id
    const myRank = sortedSubs.findIndex(s => s.user_id === user.id) + 1

    return (
      <div>
        <Navbar />
        <div className="battle-page">
          <div className="battle-result">
            <div className="result-banner" style={{
              background: iWon
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : isSolo && mySubmission?.score >= 60
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #ef4444, #dc2626)'
            }}>
              <div className="result-emoji">
                {iWon ? <Crown size={80} /> : (isSolo && mySubmission?.score >= 60) ? <Trophy size={80} /> : <Shield size={80} />}
              </div>
              <h2>
                {isSolo
                  ? (mySubmission?.score >= 60 ? 'Ajoyib!' : 'Yana harakat qiling')
                  : (iWon ? 'G\'alaba!' : myRank <= 3 ? `${myRank}-o'rin!` : 'Mag\'lubiyat')
                }
              </h2>
              <p>{mySubmission?.score || 0} ball</p>
            </div>

            <div className="result-submissions">
              <h3><Code size={20} /> {isSolo ? 'Sizning yechimingiz' : 'Barcha yechimlar'}</h3>

              {sortedSubs.map((sub, i) => {
                const isMe = sub.user_id === user.id
                const rankIcons = [
                  <Crown size={20} color="#f59e0b" />,
                  <Medal size={20} color="#94a3b8" />,
                  <Award size={20} color="#f97316" />
                ]

                return (
                  <div key={sub.id} className={`result-sub ${isMe ? 'sub-me' : ''} ${i === 0 && !isSolo ? 'sub-winner' : ''}`}>
                    <div className="result-sub-header">
                      <div className="result-sub-left">
                        {!isSolo && (
                          <div className="result-rank">
                            {i < 3 ? rankIcons[i] : `#${i + 1}`}
                          </div>
                        )}
                        <span className="result-player-name">
                          {sub.user_name} {isMe && '(siz)'}
                        </span>
                      </div>
                      <span className="result-score-badge">{sub.score} ball</span>
                    </div>
                    <div className="result-meta">
                      <Clock size={12} /> {sub.time_taken}s
                    </div>
                    {sub.feedback && (
                      <div className="result-feedback">
                        <strong>AI tahlili:</strong> {sub.feedback}
                      </div>
                    )}
                    {isMe && (
                      <pre className="result-code">{sub.code}</pre>
                    )}
                  </div>
                )
              })}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
                <button className="btn-outline" onClick={backToLobby}>
                  Lobby ga qaytish
                </button>
                <button className="btn-primary" onClick={() => {
                  backToLobby()
                  setTimeout(() => randomMatch(), 300)
                }}>
                  <Zap size={16} /> Yangi battle
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============ WAITING ============
  if (view === 'waiting' && currentBattle) {
    const playersCount = currentBattle.players?.length || 1
    const isHost = currentBattle.host_id === user.id
    const canStart = isHost && playersCount >= 2

    return (
      <div>
        <Navbar />
        <div className="battle-page">
          <div className="battle-waiting">
            <div className="waiting-icon">
              <Users size={72} />
            </div>
            <h2>Xona kutilmoqda</h2>
            <p>Do'stlaringizga taklif yuboring</p>

            <div
              className="battle-id-display"
              onClick={() => {
                const url = `${window.location.origin}/battle?join=${currentBattle.id}`
                navigator.clipboard?.writeText(url).then(() => {
                  setCopyOk(true)
                  addNotification('Havola nusxalandi', 'success')
                  setTimeout(() => setCopyOk(false), 2000)
                })
              }}
              title="Bosing — havolani nusxalash"
            >
              {copyOk ? <Check size={28} /> : <Copy size={20} />}
              {currentBattle.id}
            </div>

            {/* Share tugmalar */}
            <div className="battle-share-row">
              <button
                className="battle-share-btn"
                onClick={() => {
                  const url = `${window.location.origin}/battle?join=${currentBattle.id}`
                  navigator.clipboard?.writeText(url).then(() => {
                    setCopyOk(true)
                    addNotification('Havola nusxalandi', 'success')
                    setTimeout(() => setCopyOk(false), 2000)
                  })
                }}
              >
                <LinkIcon size={14} /> Havolani nusxalash
              </button>
              <a
                className="battle-share-btn battle-share-tg"
                href={`https://t.me/share/url?url=${encodeURIComponent(`${window.location.origin}/battle?join=${currentBattle.id}`)}&text=${encodeURIComponent(`Eduzy Battle xonaga qo'shiling! ID: ${currentBattle.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Send size={14} /> Telegram
              </a>
              <a
                className="battle-share-btn battle-share-wa"
                href={`https://wa.me/?text=${encodeURIComponent(`Eduzy Battle xonaga qo'shiling! ${window.location.origin}/battle?join=${currentBattle.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            </div>

            <div className="waiting-info">
              <span><Users size={14} /> {playersCount}/{currentBattle.max_players} o'yinchi</span>
              <span><Code2 size={14} /> {currentBattle.language}</span>
            </div>

            <div className="waiting-players">
              {currentBattle.players?.map(p => (
                <div key={p.user_id} className="waiting-player">
                  <div className="player-avatar" style={{
                    background: p.user_id === currentBattle.host_id
                      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                      : 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
                  }}>
                    {p.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="player-name">
                    {p.name}
                    {p.user_id === currentBattle.host_id && (
                      <Crown size={12} color="#f59e0b" style={{ marginLeft: 4 }} />
                    )}
                    {p.user_id === user.id && ' (siz)'}
                  </span>
                </div>
              ))}

              {Array.from({ length: currentBattle.max_players - playersCount }).map((_, i) => (
                <div key={`empty-${i}`} className="waiting-player waiting-player-empty">
                  <div className="player-avatar player-avatar-empty">
                    <Plus size={16} />
                  </div>
                  <span className="player-name">Bo'sh o'rin</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
              {isHost && (
                <button className="btn-primary" onClick={startBattle} disabled={!canStart || loadingAction === 'start'}>
                  <Play size={16} /> Boshlash
                </button>
              )}
              <button className="btn-outline" onClick={cancelBattle}>
                <LogOut size={16} /> Chiqish
              </button>
            </div>

            {!canStart && isHost && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
                Boshlash uchun kamida 2 o'yinchi kerak
              </p>
            )}
            {!isHost && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
                Host battle ni boshlashini kuting...
              </p>
            )}

            <div className="waiting-spinner"></div>
          </div>
        </div>
      </div>
    )
  }

  // ============ LOBBY ============
  return (
    <div>
      <Navbar />
      <div className="battle-page">
        <div className="battle-hero">
          <h1>Code Battle</h1>
          <p>Real vaqtda dasturchilar bilan musobaqa. 1 dan 10 kishigacha o'ynang!</p>
        </div>

        {!user && (
          <GuestBanner
            title="Code Battle — dasturchilar musobaqasi"
            subtitle="Boshqa o'yinchilar bilan real vaqtda kod yozing. O'ynashni boshlash uchun ro'yxatdan o'ting"
          />
        )}

        {error && <div className="battle-error">{error}</div>}

        <div className="lang-selector">
          <div className="lang-selector-label">
            <Code2 size={14} /> Dasturlash tilini tanlang
          </div>
          <div className="lang-buttons">
            {LANGUAGES.map(lang => (
              <button
                key={lang.id}
                className={`lang-btn ${language === lang.id ? 'lang-active' : ''}`}
                onClick={() => setLanguage(lang.id)}
              >
                <Code2 size={16} /> {lang.name}
              </button>
            ))}
          </div>
        </div>

        <div className="lang-selector">
          <div className="lang-selector-label">
            <BarChart3 size={14} /> Qiyinlik darajasi
          </div>
          <div className="lang-buttons">
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                className={`lang-btn ${difficulty === d.id ? 'lang-active' : ''}`}
                onClick={() => setDifficulty(d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <div className="lang-selector">
          <div className="lang-selector-label">
            <Users size={14} /> O'yinchilar soni (xona uchun)
          </div>
          <div className="players-counter">
            <button className="counter-btn" onClick={() => setMaxPlayers(Math.max(2, maxPlayers - 1))} disabled={maxPlayers <= 2}>
              <Minus size={16} />
            </button>
            <div className="counter-value">{maxPlayers}</div>
            <button className="counter-btn" onClick={() => setMaxPlayers(Math.min(10, maxPlayers + 1))} disabled={maxPlayers >= 10}>
              <Plus size={16} />
            </button>
            <span className="counter-label">2 dan 10 gacha</span>
          </div>
        </div>

        <div className="battle-lobby-new">
          <div className="battle-card">
            <div className="battle-card-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <User size={28} />
            </div>
            <h3>Solo</h3>
            <p>Yolg'iz o'ynash + AI baholash. Praktika uchun ideal.</p>
            <button className="btn-primary" onClick={startSolo} disabled={loadingAction === 'solo'}>
              {loadingAction === 'solo' ? <Loader2 size={16} className="spin-icon" /> : <Play size={16} />} Boshlash
            </button>
          </div>

          <div className="battle-card">
            <div className="battle-card-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
              <Plus size={28} />
            </div>
            <h3>Xona yaratish</h3>
            <p>{maxPlayers} kishilik xona. Do'stlaringizni taklif qiling.</p>
            <button className="btn-primary" onClick={createRoom} disabled={loadingAction === 'create'}>
              {loadingAction === 'create' ? <Loader2 size={16} className="spin-icon" /> : <Plus size={16} />} Yaratish
            </button>
          </div>

          <div className="battle-card">
            <div className="battle-card-icon" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              <Zap size={28} />
            </div>
            <h3>Tezkor match</h3>
            <p>Avtomatik raqib qidirish. Tez va oson.</p>
            <button className="btn-primary" onClick={randomMatch} disabled={loadingAction === 'random'}>
              {loadingAction === 'random' ? <Loader2 size={16} className="spin-icon" /> : <Zap size={16} />} Boshlash
            </button>
          </div>

          <div className="battle-card">
            <div className="battle-card-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
              <Hash size={28} />
            </div>
            <h3>Xona ID</h3>
            <p>Do'stingiz yuborgan xona ID si bilan kiring.</p>
            <button className="btn-primary" onClick={() => {
              if (!requireAuth()) return
              setShowJoinModal(true)
            }}>
              <UserPlus size={16} /> Kirish
            </button>
          </div>
        </div>

        {weekly.length > 0 && (
          <div className="battle-leaderboard">
            <h3><Flame size={22} style={{ color: '#f97316' }} /> Haftalik turnir</h3>
            <p style={{ color: 'var(--text-soft)', fontSize: 13, margin: '-4px 0 14px' }}>
              Har dushanba yangilanadi — bu hafta eng ko'p g'alaba qozonganlar
            </p>
            <div className="leaderboard-list">
              {weekly.map((p, i) => (
                <div key={p.id} className={`leaderboard-item ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                  <div className="leaderboard-rank">
                    {i === 0 ? <Crown size={20} color="#f59e0b" /> :
                      i === 1 ? <Medal size={20} color="#94a3b8" /> :
                        i === 2 ? <Award size={20} color="#f97316" /> :
                          `#${i + 1}`}
                  </div>
                  <div className="leaderboard-name">{p.name}</div>
                  <div className="leaderboard-stats">
                    <span className="leaderboard-points">{p.weekly_points}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="battle-leaderboard">
          <h3><Trophy size={22} style={{ color: '#f59e0b' }} /> Top o'yinchilar</h3>
          {leaderboard.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
              Hozircha o'yinchilar yo'q
            </p>
          ) : (
            <div className="leaderboard-list">
              {leaderboard.slice(0, 10).map((p, i) => (
                <div key={p.id} className={`leaderboard-item ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                  <div className="leaderboard-rank">
                    {i === 0 ? <Crown size={20} color="#f59e0b" /> :
                      i === 1 ? <Medal size={20} color="#94a3b8" /> :
                        i === 2 ? <Award size={20} color="#f97316" /> :
                          `#${i + 1}`}
                  </div>
                  <div className="leaderboard-name">{p.name}</div>
                  <div className="leaderboard-stats">
                    <span className="leaderboard-points">{p.points}</span>
                    <span className="leaderboard-record">{p.wins}W {p.losses}L</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {user && history.length > 0 && (
          <div className="battle-leaderboard" style={{ marginTop: 24 }}>
            <h3><History size={22} style={{ color: 'var(--primary-light)' }} /> Battle tarixi</h3>
            <div className="leaderboard-list">
              {history.map(h => {
                const oc = h.outcome === 'win'
                  ? { label: "G'alaba", color: '#22c55e' }
                  : h.outcome === 'loss'
                    ? { label: "Mag'lubiyat", color: '#ef4444' }
                    : { label: 'Durang', color: '#94a3b8' }
                const rivals = h.mode === 'solo'
                  ? 'Solo'
                  : (h.opponents || []).map(o => o.name).join(', ') || 'Raqib'
                return (
                  <div
                    key={h.id}
                    className="leaderboard-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => viewBattleResult(h.id)}
                  >
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: oc.color,
                      background: oc.color + '1f', padding: '4px 10px',
                      borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0
                    }}>
                      {oc.label}
                    </div>
                    <div className="leaderboard-name" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.problemTitle || 'Masala'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                        {rivals} · {h.language}
                      </div>
                    </div>
                    <div className="leaderboard-stats">
                      <span className="leaderboard-points">{h.myScore ?? 0} ball</span>
                      <span className="leaderboard-record">
                        {h.finishedAt ? new Date(h.finishedAt).toLocaleDateString('uz') : ''}
                      </span>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {showJoinModal && (
          <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <Hash size={28} color="#0ea5e9" />
                <h3>Xona ID ni kiriting</h3>
                <p>Do'stingiz yuborgan 6 xonali kod</p>
              </div>
              <input
                type="text"
                className="modal-input"
                placeholder="ABC123"
                value={joinId}
                onChange={e => setJoinId(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus
              />
              <div className="modal-actions">
                <button className="btn-outline" onClick={() => { setShowJoinModal(false); setJoinId('') }}>
                  Bekor qilish
                </button>
                <button className="btn-primary" onClick={joinRoom} disabled={!joinId || loadingAction === 'join'}>
                  {loadingAction === 'join' ? <Loader2 size={16} className="spin-icon" /> : <UserPlus size={16} />} Kirish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Battle