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
        idle: 'Pauza — davom etish uchun bosing'
    }[status]

    return (
        <div>
            <Navbar />
            <div className="sp-wrap">
                <div className="sp-card">
                    {/* Header */}
                    <div className="sp-head">
                        <div className="sp-persona">
                            <div className={`sp-avatar ${status === 'speaking' ? 'speaking' : ''} ${status === 'listening' ? 'listening' : ''}`}>
                                <AudioLines size={22} />
                            </div>
                            <div>
                                <div className="sp-name">{L.persona}</div>
                                <div className="sp-sub">{L.label} speaking partner</div>
                            </div>
                        </div>
                        <div className="sp-lang-toggle">
                            {Object.entries(LANGS).map(([k, v]) => (
                                <button
                                    key={k}
                                    className={`sp-lang-btn ${lang === k ? 'active' : ''}`}
                                    onClick={() => { if (status === 'idle' || !started) { stopConversation(); setLang(k); if (started) resetSession() } }}
                                    disabled={started && status !== 'idle'}
                                    title={v.label}
                                >
                                    {v.code}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Conversation */}
                    <div className="sp-body" ref={bodyRef}>
                        {!started ? (
                            <div className="sp-empty">
                                <div className="sp-orb"><Sparkles size={44} /></div>
                                <h3>{L.persona} bilan erkin gaplashing</h3>
                                <p>Suhbatni boshlang va shunchaki <strong>gapiravering</strong> — to'xtaganingizda {L.persona} darhol javob beradi. Tugma bosib turish shart emas. Xato qilsangiz yumshoq maslahat beradi.</p>
                                <button className="sp-start-btn" onClick={beginSession} disabled={status === 'thinking'}>
                                    {status === 'thinking' ? <><Loader2 size={16} className="spin" /> Tayyorlanmoqda…</> : <><MessageCircle size={16} /> Suhbatni boshlash</>}
                                </button>
                                {!SR && <p className="sp-warn"><AlertTriangle size={14} /> Jonli rejim uchun Chrome yoki Edge kerak.</p>}
                            </div>
                        ) : (
                            <>
                                {messages.map((m, i) => (
                                    <div key={i} className={`sp-msg ${m.role === 'user' ? 'sp-user' : 'sp-ai'}`}>
                                        {m.role === 'ai' && (
                                            <button className="sp-replay" title="Qayta tinglash" onClick={() => speak(m.text)}>
                                                <Volume2 size={14} />
                                            </button>
                                        )}
                                        <div className="sp-msg-text">{m.text}</div>
                                        {m.tip && <div className="sp-tip"><Lightbulb size={13} /> {m.tip}</div>}
                                    </div>
                                ))}
                                {interim && (
                                    <div className="sp-msg sp-user sp-interim"><div className="sp-msg-text">{interim}</div></div>
                                )}
                                {status === 'thinking' && (
                                    <div className="sp-msg sp-ai">
                                        <div className="sp-msg-text sp-typing"><Loader2 size={14} className="spin" /> {L.persona} o'ylayapti…</div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {error && <div className="sp-error">{error}</div>}

                    {/* Controls */}
                    {started && (
                        <div className="sp-controls">
                            <button className="sp-reset" onClick={resetSession} title="Boshidan">
                                <RotateCcw size={16} />
                            </button>
                            <button
                                className={`sp-mic ${status === 'listening' ? 'recording' : ''} ${status === 'speaking' ? 'speaking' : ''}`}
                                onClick={toggleLive}
                                title={liveRef.current ? 'Pauza' : 'Davom ettirish'}
                            >
                                {status === 'thinking' ? <Loader2 size={26} className="spin" />
                                    : liveRef.current ? <Pause size={26} /> : <Play size={26} />}
                            </button>
                            <div className="sp-mic-hint">{statusText}</div>
                        </div>
                    )}
                </div>
                <p className="sp-note">Prototip · Chrome/Edge'da jonli ishlaydi · Gapiring — {L.persona} o'zi javob beradi</p>
            </div>
        </div>
    )
}

export default Speaking
