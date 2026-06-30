import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Loader2, Volume2, Sparkles, RotateCcw, MessageCircle } from 'lucide-react'
import { API_URL } from '../lib/api'
import Navbar from '../components/Navbar'
import '../styles/speaking.css'

const LANGS = {
    en: { label: 'English', persona: 'Eva', flag: '🇬🇧', voice: 'en-US' },
    ru: { label: 'Русский', persona: 'Anya', flag: '🇷🇺', voice: 'ru-RU' }
}

const FILE_EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4' }

function Speaking() {
    const [lang, setLang] = useState('en')
    const [messages, setMessages] = useState([]) // {role:'user'|'ai', text, tip?}
    const [recording, setRecording] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [started, setStarted] = useState(false)
    const [error, setError] = useState('')

    const mediaRef = useRef(null)
    const chunksRef = useRef([])
    const streamRef = useRef(null)
    const bodyRef = useRef(null)

    const token = localStorage.getItem('token')

    // Suhbat o'sganda pastga surish
    useEffect(() => {
        const el = bodyRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [messages, processing])

    // Sahifadan chiqqanda ovozni to'xtatish
    useEffect(() => () => {
        try { window.speechSynthesis?.cancel() } catch {}
        streamRef.current?.getTracks().forEach(t => t.stop())
    }, [])

    const speak = (text) => {
        if (!text || !window.speechSynthesis) return
        try {
            window.speechSynthesis.cancel()
            const u = new SpeechSynthesisUtterance(text)
            u.lang = LANGS[lang].voice
            u.rate = 0.95
            const vs = window.speechSynthesis.getVoices()
            const match = vs.find(v => v.lang === LANGS[lang].voice) || vs.find(v => v.lang?.startsWith(lang))
            if (match) u.voice = match
            window.speechSynthesis.speak(u)
        } catch {}
    }

    // Backend bilan bitta almashinuv (audio yoki start)
    const sendTurn = async ({ audioBlob = null, start = false }) => {
        setProcessing(true)
        setError('')
        try {
            const fd = new FormData()
            fd.append('lang', lang)
            fd.append('history', JSON.stringify(messages.map(m => ({ role: m.role, text: m.text }))))
            if (start) fd.append('start', 'true')
            if (audioBlob) {
                const ext = FILE_EXT[audioBlob.type.split(';')[0]] || 'webm'
                fd.append('audio', audioBlob, `audio.${ext}`)
            }

            const res = await fetch(`${API_URL}/api/speaking/talk`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: fd
            })
            const data = await res.json().catch(() => ({}))

            if (!res.ok) {
                setError(data.message || 'Xatolik yuz berdi')
                setProcessing(false)
                return
            }

            setMessages(prev => {
                const next = [...prev]
                if (data.userText) next.push({ role: 'user', text: data.userText })
                if (data.reply) next.push({ role: 'ai', text: data.reply, tip: data.tip })
                return next
            })
            speak(data.reply)
        } catch {
            setError('Server bilan bog\'lanib bo\'lmadi')
        }
        setProcessing(false)
    }

    const beginSession = async () => {
        setStarted(true)
        setMessages([])
        await sendTurn({ start: true })
    }

    const startRecording = async () => {
        if (recording || processing) return
        setError('')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            const mr = new MediaRecorder(stream)
            chunksRef.current = []
            mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
            mr.onstop = async () => {
                streamRef.current?.getTracks().forEach(t => t.stop())
                const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
                if (blob.size > 1000) await sendTurn({ audioBlob: blob })
                else setError('Ovoz juda qisqa — biroz uzunroq gapiring')
            }
            mediaRef.current = mr
            mr.start()
            setRecording(true)
            try { window.speechSynthesis?.cancel() } catch {}
        } catch {
            setError('Mikrofonga ruxsat berilmadi. Brauzer sozlamasidan ruxsat bering.')
        }
    }

    const stopRecording = () => {
        if (!recording) return
        setRecording(false)
        try { mediaRef.current?.stop() } catch {}
    }

    const resetSession = () => {
        try { window.speechSynthesis?.cancel() } catch {}
        setMessages([])
        setStarted(false)
        setError('')
    }

    const L = LANGS[lang]

    return (
        <div>
            <Navbar />
            <div className="sp-wrap">
                <div className="sp-card">
                    {/* Header */}
                    <div className="sp-head">
                        <div className="sp-persona">
                            <div className="sp-avatar">{L.flag}</div>
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
                                    onClick={() => { if (!recording && !processing) { setLang(k); resetSession() } }}
                                    disabled={recording || processing}
                                >
                                    {v.flag} {v.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Conversation */}
                    <div className="sp-body" ref={bodyRef}>
                        {!started ? (
                            <div className="sp-empty">
                                <Sparkles size={32} />
                                <h3>{L.persona} bilan erkin gaplashing</h3>
                                <p>Mikrofon orqali gapiring — {L.persona} javob beradi, rag'batlantiradi va suhbatni davom ettiradi. Xato qilsangiz, yumshoq maslahat beradi.</p>
                                <button className="btn-primary sp-start-btn" onClick={beginSession} disabled={processing}>
                                    {processing ? <><Loader2 size={16} className="spin" /> Tayyorlanmoqda…</> : <><MessageCircle size={16} /> Suhbatni boshlash</>}
                                </button>
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
                                        {m.tip && <div className="sp-tip">💡 {m.tip}</div>}
                                    </div>
                                ))}
                                {processing && (
                                    <div className="sp-msg sp-ai">
                                        <div className="sp-msg-text sp-typing"><Loader2 size={14} className="spin" /> {L.persona} o'ylayapti…</div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {error && <div className="sp-error">{error}</div>}

                    {/* Mic control */}
                    {started && (
                        <div className="sp-controls">
                            <button className="sp-reset" onClick={resetSession} title="Boshidan">
                                <RotateCcw size={16} />
                            </button>
                            <button
                                className={`sp-mic ${recording ? 'recording' : ''}`}
                                onClick={recording ? stopRecording : startRecording}
                                disabled={processing}
                            >
                                {recording ? <Square size={26} /> : <Mic size={26} />}
                            </button>
                            <div className="sp-mic-hint">
                                {recording ? 'Tinglayapman… tugatish uchun bosing' : processing ? 'Kutib turing…' : 'Gapirish uchun bosing'}
                            </div>
                        </div>
                    )}
                </div>
                <p className="sp-note">Prototip · Eng yaxshi Chrome/Edge'da ishlaydi · Ovoz Groq Whisper bilan tahlil qilinadi</p>
            </div>
        </div>
    )
}

export default Speaking
