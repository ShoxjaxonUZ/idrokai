import { useState, useRef, useEffect } from 'react'
import { Mic, Pause, Loader2, Volume2, Sparkles, RotateCcw, MessageCircle, Play, Lightbulb, AlertTriangle, AudioLines } from 'lucide-react'
import { API_URL } from '../lib/api'
import Navbar from '../components/Navbar'
import '../styles/speaking.css'

const LANGS = {
    en: { label: 'English', persona: 'Eva', code: 'EN', voice: 'en-US' },
    ru: { label: 'Русский', persona: 'Anya', code: 'RU', voice: 'ru-RU' }
}

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

function Speaking() {
    const [lang, setLang] = useState('en')
    const [messages, setMessages] = useState([]) // {role, text, tip?}
    const [status, setStatus] = useState('idle') // idle | listening | thinking | speaking
    const [interim, setInterim] = useState('')
    const [started, setStarted] = useState(false)
    const [error, setError] = useState('')
    const [showLog, setShowLog] = useState(false)

    // Stale-closure'dan qochish uchun ref'lar
    const liveRef = useRef(false)       // suhbat loop faolmi
    const langRef = useRef('en')
    const messagesRef = useRef([])
    const recRef = useRef(null)
    const finalRef = useRef('')
    const speakingRef = useRef(false)
    const processingRef = useRef(false)
    const bodyRef = useRef(null)

    const token = localStorage.getItem('token')

    useEffect(() => { langRef.current = lang }, [lang])
    useEffect(() => { messagesRef.current = messages }, [messages])

    useEffect(() => {
        const el = bodyRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [messages, interim, status])

    // Brauzer ovozlarini oldindan yuklash
    useEffect(() => {
        try { window.speechSynthesis?.getVoices() } catch {}
    }, [])

    // Tozalash
    useEffect(() => () => {
        liveRef.current = false
        try { recRef.current?.abort() } catch {}
        try { window.speechSynthesis?.cancel() } catch {}
    }, [])

    // ---- TTS: AI javobini ovozli aytish ----
    const speak = (text) => {
        if (!text || !window.speechSynthesis) { afterSpeak(); return }
        try {
            window.speechSynthesis.cancel()
            const u = new SpeechSynthesisUtterance(text)
            u.lang = LANGS[langRef.current].voice
            u.rate = 0.95
            const vs = window.speechSynthesis.getVoices()
            const m = vs.find(v => v.lang === u.lang) || vs.find(v => v.lang?.startsWith(langRef.current))
            if (m) u.voice = m
            speakingRef.current = true
            setStatus('speaking')
            u.onend = () => { speakingRef.current = false; afterSpeak() }
            u.onerror = () => { speakingRef.current = false; afterSpeak() }
            window.speechSynthesis.speak(u)
        } catch {
            speakingRef.current = false
            afterSpeak()
        }
    }

    // AI gapirib bo'lgach — yana tinglashga o'tish
    const afterSpeak = () => {
        if (liveRef.current) startListening()
        else setStatus('idle')
    }

    // ---- Tinglash (jonli STT) ----
    const startListening = () => {
        if (!SR || !liveRef.current || speakingRef.current || processingRef.current) return
        try {
            const rec = new SR()
            recRef.current = rec
            rec.lang = LANGS[langRef.current].voice
            rec.continuous = false
            rec.interimResults = true
            finalRef.current = ''

            rec.onresult = (e) => {
                let interimTxt = ''
                let finalTxt = ''
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const t = e.results[i][0].transcript
                    if (e.results[i].isFinal) finalTxt += t
                    else interimTxt += t
                }
                if (finalTxt) finalRef.current += finalTxt
                setInterim(interimTxt || finalRef.current)
            }

            rec.onerror = (e) => {
                if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                    setError('Mikrofonga ruxsat berilmadi. Brauzer sozlamasidan ruxsat bering.')
                    stopConversation()
                }
            }

            rec.onend = () => {
                const said = finalRef.current.trim()
                setInterim('')
                if (said) {
                    handleUserText(said)
                } else if (liveRef.current && !speakingRef.current && !processingRef.current) {
                    // Jim — tinglashda davom etamiz
                    setTimeout(() => startListening(), 250)
                }
            }

            setStatus('listening')
            rec.start()
        } catch {
            // Ba'zi brauzerlar tez-tez start/stop'da xato beradi — biroz kutib qayta
            setTimeout(() => { if (liveRef.current && !speakingRef.current) startListening() }, 400)
        }
    }

    // ---- Foydalanuvchi gapi tayyor → AI javobi ----
    const handleUserText = async (text) => {
        processingRef.current = true
        setStatus('thinking')
        setError('')
        setMessages(prev => [...prev, { role: 'user', text }])
        try {
            const res = await fetch(`${API_URL}/api/speaking/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    lang: langRef.current,
                    text,
                    history: messagesRef.current.map(m => ({ role: m.role, text: m.text }))
                })
            })
            const data = await res.json().catch(() => ({}))
            processingRef.current = false
            if (!res.ok) {
                setError(data.message || 'Xatolik')
                if (liveRef.current) startListening()
                return
            }
            if (data.reply) setMessages(prev => [...prev, { role: 'ai', text: data.reply, tip: data.tip }])
            speak(data.reply)
        } catch {
            processingRef.current = false
            setError('Server bilan bog\'lanib bo\'lmadi')
            if (liveRef.current) startListening()
        }
    }

    // ---- Suhbatni boshlash (AI salomlashadi) ----
    const beginSession = async () => {
        if (!SR) { setError('Brauzer jonli nutqni qo\'llamaydi. Chrome yoki Edge ishlating.'); return }
        setStarted(true)
        setMessages([])
        liveRef.current = true
        processingRef.current = true
        setStatus('thinking')
        setError('')
        try {
            const res = await fetch(`${API_URL}/api/speaking/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ lang: langRef.current, start: true, history: [] })
            })
            const data = await res.json().catch(() => ({}))
            processingRef.current = false
            if (res.ok && data.reply) {
                setMessages([{ role: 'ai', text: data.reply, tip: data.tip }])
                speak(data.reply)
            } else {
                setError(data.message || 'Boshlab bo\'lmadi')
            }
        } catch {
            processingRef.current = false
            setError('Server bilan bog\'lanib bo\'lmadi')
        }
    }

    // Pauza / davom
    const toggleLive = () => {
        if (liveRef.current) {
            liveRef.current = false
            try { recRef.current?.abort() } catch {}
            try { window.speechSynthesis?.cancel() } catch {}
            speakingRef.current = false
            setStatus('idle')
            setInterim('')
        } else {
            liveRef.current = true
            startListening()
        }
    }

    const stopConversation = () => {
        liveRef.current = false
        try { recRef.current?.abort() } catch {}
        try { window.speechSynthesis?.cancel() } catch {}
        speakingRef.current = false
        setStatus('idle')
        setInterim('')
    }

    const resetSession = () => {
        stopConversation()
        setMessages([])
        setStarted(false)
        setError('')
    }

    const L = LANGS[lang]
    const statusText = {
        listening: 'Tinglayapman… gapiravering',
        thinking: `${L.persona} o'ylayapti…`,
        speaking: `${L.persona} gapiryapti…`,
        idle: 'Pauza'
    }[status]
    const lastAi = [...messages].reverse().find(m => m.role === 'ai')

    return (
        <div className="speaking-page">
            <Navbar />
            <div className="spk">
                {/* Top bar */}
                <div className="spk-top">
                    <div className="spk-who">
                        <AudioLines size={15} /> {L.persona} · {L.label}
                    </div>
                    <div className="spk-langs">
                        {Object.entries(LANGS).map(([k, v]) => (
                            <button
                                key={k}
                                className={`spk-lang ${lang === k ? 'active' : ''}`}
                                onClick={() => { if (status === 'idle' || !started) { stopConversation(); setLang(k); if (started) resetSession() } }}
                                disabled={started && status !== 'idle'}
                                title={v.label}
                            >
                                {v.code}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stage */}
                <div className="spk-stage">
                    {!started ? (
                        <div className="spk-intro">
                            <div className="spk-orb spk-orb--idle">
                                <div className="spk-orb-core" />
                            </div>
                            <h2>{L.persona} bilan erkin gaplashing</h2>
                            <p>Suhbatni boshlang va shunchaki <strong>gapiravering</strong> — to'xtaganingizda {L.persona} darhol javob beradi. Tugma bosib turish shart emas.</p>
                            <button className="spk-start" onClick={beginSession} disabled={status === 'thinking'}>
                                {status === 'thinking' ? <><Loader2 size={17} className="spin" /> Tayyorlanmoqda…</> : <><Mic size={17} /> Suhbatni boshlash</>}
                            </button>
                            {!SR && <p className="spk-warn"><AlertTriangle size={14} /> Jonli rejim uchun Chrome yoki Edge kerak.</p>}
                        </div>
                    ) : (
                        <div className="spk-live">
                            <div className={`spk-orb spk-orb--${status}`}>
                                <div className="spk-orb-core" />
                                {status === 'thinking' && <Loader2 className="spk-orb-icon spin" size={30} />}
                            </div>

                            <div className="spk-status">{statusText}</div>

                            <div className="spk-captions">
                                {lastAi && (
                                    <p className="spk-cap-ai">
                                        {lastAi.text}
                                        <button className="spk-cap-replay" title="Qayta tinglash" onClick={() => speak(lastAi.text)}>
                                            <Volume2 size={15} />
                                        </button>
                                    </p>
                                )}
                                {lastAi?.tip && <p className="spk-cap-tip"><Lightbulb size={13} /> {lastAi.tip}</p>}
                                {interim && <p className="spk-cap-user">{interim}…</p>}
                            </div>
                        </div>
                    )}
                </div>

                {error && <div className="spk-error">{error}</div>}

                {/* Controls */}
                {started && (
                    <div className="spk-controls">
                        <button className="spk-ctrl" onClick={resetSession} title="Boshidan">
                            <RotateCcw size={18} />
                        </button>
                        <button
                            className={`spk-ctrl spk-ctrl--main ${liveRef.current && status !== 'idle' ? 'live' : ''}`}
                            onClick={toggleLive}
                            title={liveRef.current ? 'Pauza' : 'Davom ettirish'}
                        >
                            {liveRef.current && status !== 'idle' ? <Pause size={22} /> : <Play size={22} />}
                        </button>
                        <button
                            className={`spk-ctrl ${showLog ? 'active' : ''}`}
                            onClick={() => setShowLog(s => !s)}
                            title="Suhbat tarixi"
                        >
                            <MessageCircle size={18} />
                        </button>
                    </div>
                )}

                {/* Transcript overlay */}
                {showLog && started && (
                    <div className="spk-log" onClick={() => setShowLog(false)}>
                        <div className="spk-log-panel" onClick={e => e.stopPropagation()} ref={bodyRef}>
                            <div className="spk-log-head"><Sparkles size={15} /> Suhbat tarixi</div>
                            {messages.length === 0 ? (
                                <p className="spk-log-empty">Hali xabar yo'q</p>
                            ) : messages.map((m, i) => (
                                <div key={i} className={`spk-log-msg ${m.role}`}>
                                    <span className="spk-log-who">{m.role === 'ai' ? L.persona : 'Siz'}</span>
                                    <span>{m.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Speaking
