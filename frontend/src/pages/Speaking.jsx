import { useState, useRef, useEffect } from 'react'
import { Mic, Pause, Loader2, Volume2, Sparkles, RotateCcw, MessageCircle, Play, Lightbulb, AlertTriangle, AudioLines, Flag, TrendingUp, Trophy, X, Pencil, Clock } from 'lucide-react'
import { API_URL } from '../lib/api'
import Navbar from '../components/Navbar'
import '../styles/speaking.css'

const LANGS = {
    en: { label: 'English', persona: 'Eva', code: 'EN', voice: 'en-US' },
    ru: { label: 'Русский', persona: 'Anya', code: 'RU', voice: 'ru-RU' }
}

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

// Foydalanuvchi shuncha ms jim tursa — yordamchi gapni ko'rsatamiz
const HINT_AFTER_MS = 5000

// MediaRecorder uchun eng mos audio mime
const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return ''
    const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
    return list.find(m => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } }) || ''
}

const fmtDate = (d) => {
    try { return new Date(d).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' }) } catch { return '' }
}

function Speaking() {
    const [lang, setLang] = useState('en')
    const [messages, setMessages] = useState([]) // {role, text, tip?, help?}
    const [status, setStatus] = useState('idle') // idle | listening | thinking | speaking
    const [interim, setInterim] = useState('')
    const [started, setStarted] = useState(false)
    const [error, setError] = useState('')
    const [showLog, setShowLog] = useState(false)
    const [level, setLevel] = useState('') // aniqlangan CEFR daraja (A1..C2)
    const [hintVisible, setHintVisible] = useState(false) // jim turganda yordamchi ko'rinadi

    // Hamroh ismi (bir marta sozlanadi)
    const [partnerName, setPartnerName] = useState('')
    const [nameInput, setNameInput] = useState('')
    const [savingName, setSavingName] = useState(false)
    const [editingName, setEditingName] = useState(false)

    // Natija / progress
    const [finalizing, setFinalizing] = useState(false)
    const [result, setResult] = useState(null)   // yakuniy sessiya natijasi (karta)
    const [progress, setProgress] = useState(null) // {last, prev, progress, sessions}
    const [showHistory, setShowHistory] = useState(false)

    // Stale-closure'dan qochish uchun ref'lar
    const liveRef = useRef(false)       // suhbat loop faolmi
    const langRef = useRef('en')
    const messagesRef = useRef([])
    const recRef = useRef(null)
    const finalRef = useRef('')
    const speakingRef = useRef(false)
    const processingRef = useRef(false)
    const levelRef = useRef('')
    const bodyRef = useRef(null)
    const partnerRef = useRef('')

    // Audio yozish (MediaRecorder + Web Audio miks: mikrofon + AI ovozi)
    const recorderRef = useRef(null)
    const mediaStreamRef = useRef(null)
    const chunksRef = useRef([])
    const mimeRef = useRef('audio/webm')
    const savedRef = useRef(false) // sessiya saqlandimi (ikki marta saqlamaslik)
    const audioCtxRef = useRef(null)   // Web Audio konteksti
    const mixDestRef = useRef(null)    // aralash oqim (mikrofon + AI) → yozuvga
    const micSourceRef = useRef(null)
    const ttsSrcRef = useRef(null)     // joriy AI ovozi manbasi

    const token = localStorage.getItem('token')
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

    useEffect(() => { langRef.current = lang }, [lang])
    useEffect(() => { messagesRef.current = messages }, [messages])
    useEffect(() => { levelRef.current = level }, [level])
    useEffect(() => { partnerRef.current = partnerName }, [partnerName])

    useEffect(() => {
        const el = bodyRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [messages, interim, status])

    // Jimlik taymeri: tinglash paytida foydalanuvchi HINT_AFTER_MS jim tursa —
    // yordamchi gapni ko'rsatamiz. Gapira boshlashi (interim) yoki holat o'zgarishi darrov yashiradi.
    useEffect(() => {
        if (status === 'listening' && !interim) {
            const t = setTimeout(() => setHintVisible(true), HINT_AFTER_MS)
            return () => clearTimeout(t)
        }
        setHintVisible(false)
    }, [status, interim])

    // Brauzer ovozlarini oldindan yuklash
    useEffect(() => {
        try { window.speechSynthesis?.getVoices() } catch {}
    }, [])

    // Boshlang'ich yuklash: hamroh ismi + oxirgi natija
    useEffect(() => {
        loadPrefs()
        loadProgress()
    }, [])

    // Tozalash
    useEffect(() => () => {
        liveRef.current = false
        try { recRef.current?.abort() } catch {}
        try { window.speechSynthesis?.cancel() } catch {}
        stopStream()
    }, [])

    const loadPrefs = async () => {
        try {
            const res = await fetch(`${API_URL}/api/speaking/prefs`, { headers: authHeaders })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.partnerName) setPartnerName(data.partnerName)
        } catch {}
    }

    const loadProgress = async () => {
        try {
            const res = await fetch(`${API_URL}/api/speaking/progress`, { headers: authHeaders })
            const data = await res.json().catch(() => ({}))
            if (res.ok) setProgress(data)
        } catch {}
    }

    const saveName = async () => {
        const name = nameInput.trim()
        if (!name) return
        setSavingName(true)
        setError('')
        try {
            const res = await fetch(`${API_URL}/api/speaking/prefs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ partnerName: name })
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok) {
                setPartnerName(data.partnerName || name)
                setEditingName(false)
                setNameInput('')
            } else {
                setError(data.message || 'Ismni saqlab bo\'lmadi')
            }
        } catch {
            setError('Server bilan bog\'lanib bo\'lmadi')
        } finally {
            setSavingName(false)
        }
    }

    // ---- TTS: AI javobini ovozli aytish ----
    // Avval server TTS (Web Audio orqali — mikrofon bilan birga YOZILADI, ikkala ovoz saqlanadi).
    // TTS mavjud bo'lmasa (ruscha yoki terms qabul qilinmagan) — brauzer TTS'ga qaytamiz (yozilmaydi).
    const speak = async (text) => {
        if (!text) { afterSpeak(); return }
        try { window.speechSynthesis?.cancel() } catch {}
        try {
            const res = await fetch(`${API_URL}/api/speaking/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ text, lang: langRef.current })
            })
            if (res.status === 200) {
                const buf = await res.arrayBuffer()
                const ok = await playBuffer(buf)
                if (ok) return
            }
            // 204 (TTS yo'q) yoki xato → fallback
        } catch {}
        speakBrowser(text)
    }

    // Server TTS audiosini o'ynatish. Yozuv ctx bo'lsa — Web Audio orqali (yoziladi),
    // aks holda oddiy <audio> (tarixdan tinglash uchun). true = muvaffaqiyatli.
    const playBuffer = async (arrayBuffer) => {
        const ctx = audioCtxRef.current
        try {
            if (ctx && mixDestRef.current) {
                const audioBuf = await ctx.decodeAudioData(arrayBuffer.slice(0))
                const src = ctx.createBufferSource()
                src.buffer = audioBuf
                src.connect(ctx.destination)    // foydalanuvchi eshitadi
                src.connect(mixDestRef.current) // yozuvga tushadi
                ttsSrcRef.current = src
                speakingRef.current = true
                setStatus('speaking')
                try { if (ctx.state === 'suspended') await ctx.resume() } catch {}
                return await new Promise(resolve => {
                    src.onended = () => { speakingRef.current = false; ttsSrcRef.current = null; afterSpeak(); resolve(true) }
                    try { src.start() } catch { speakingRef.current = false; resolve(false) }
                })
            }
            // Yozuv konteksti yo'q — oddiy audio (masalan tarixdan tinglash)
            const url = URL.createObjectURL(new Blob([arrayBuffer], { type: 'audio/wav' }))
            const a = new Audio(url)
            speakingRef.current = true
            setStatus('speaking')
            return await new Promise(resolve => {
                a.onended = () => { speakingRef.current = false; URL.revokeObjectURL(url); afterSpeak(); resolve(true) }
                a.onerror = () => { speakingRef.current = false; URL.revokeObjectURL(url); resolve(false) }
                a.play().catch(() => { speakingRef.current = false; resolve(false) })
            })
        } catch {
            speakingRef.current = false
            return false
        }
    }

    // Fallback: brauzer TTS (Web Audio grafiga ulanmaydi → yozilmaydi)
    const speakBrowser = (text) => {
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

    // ---- Audio yozish (mikrofon + AI ovozi bitta oqimga) ----
    const startRecording = async () => {
        chunksRef.current = []
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            mediaStreamRef.current = stream

            // Web Audio: mikrofon + AI ovozini bitta destination'ga aralashtiramiz
            const Ctx = window.AudioContext || window.webkitAudioContext
            const ctx = new Ctx()
            audioCtxRef.current = ctx
            const mixDest = ctx.createMediaStreamDestination()
            mixDestRef.current = mixDest
            const micSrc = ctx.createMediaStreamSource(stream)
            micSrc.connect(mixDest) // faqat yozuvga (dinamikка emas — echo bo'lmasin)
            micSourceRef.current = micSrc

            const mime = pickMime()
            mimeRef.current = mime || 'audio/webm'
            const rec = new MediaRecorder(mixDest.stream, mime ? { mimeType: mime } : undefined)
            rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
            recorderRef.current = rec
            rec.start(1000) // har soniyada chunk yig'ish
        } catch {
            // Audio yozib bo'lmasa — suhbat baribir davom etadi (audio ixtiyoriy)
            recorderRef.current = null
            audioCtxRef.current = null
            mixDestRef.current = null
        }
    }

    const stopStream = () => {
        try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
        mediaStreamRef.current = null
        try { audioCtxRef.current?.close() } catch {}
        audioCtxRef.current = null
        mixDestRef.current = null
        micSourceRef.current = null
        ttsSrcRef.current = null
    }

    const stopRecording = () => new Promise((resolve) => {
        const rec = recorderRef.current
        const makeBlob = () => {
            const parts = chunksRef.current
            return parts.length ? new Blob(parts, { type: mimeRef.current }) : null
        }
        if (!rec || rec.state === 'inactive') { stopStream(); resolve(makeBlob()); return }
        rec.onstop = () => { const b = makeBlob(); stopStream(); recorderRef.current = null; resolve(b) }
        try { rec.stop() } catch { stopStream(); resolve(makeBlob()) }
    })

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
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({
                    lang: langRef.current,
                    text,
                    level: levelRef.current,
                    partnerName: partnerRef.current,
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
            if (data.level) setLevel(data.level)
            if (data.reply) setMessages(prev => [...prev, { role: 'ai', text: data.reply, tip: data.tip, help: data.help }])
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
        setLevel('')
        setResult(null)
        savedRef.current = false
        liveRef.current = true
        processingRef.current = true
        setStatus('thinking')
        setError('')
        startRecording() // audio yozishni boshlash (best-effort)
        try {
            const res = await fetch(`${API_URL}/api/speaking/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ lang: langRef.current, start: true, partnerName: partnerRef.current, history: [] })
            })
            const data = await res.json().catch(() => ({}))
            processingRef.current = false
            if (res.ok && data.reply) {
                if (data.level) setLevel(data.level)
                setMessages([{ role: 'ai', text: data.reply, tip: data.tip, help: data.help }])
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
            try { ttsSrcRef.current?.stop() } catch {}
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
        try { ttsSrcRef.current?.stop() } catch {}
        speakingRef.current = false
        setStatus('idle')
        setInterim('')
    }

    // ---- Sessiyani yakunlash: audio + matnni saqlash va baholash ----
    const finishSession = async () => {
        if (savedRef.current || finalizing) return
        const msgs = messagesRef.current.filter(m => m.role === 'user' || m.role === 'ai')
        if (!msgs.some(m => m.role === 'user')) {
            setError('Baholash uchun avval biroz gaplashing.')
            return
        }
        savedRef.current = true
        stopConversation()
        setFinalizing(true)
        setError('')
        const blob = await stopRecording()
        try {
            const fd = new FormData()
            fd.append('lang', langRef.current)
            fd.append('transcript', JSON.stringify(msgs.map(m => ({ role: m.role, text: m.text }))))
            if (blob && blob.size > 0) fd.append('audio', blob, 'session.webm')
            const res = await fetch(`${API_URL}/api/speaking/session`, {
                method: 'POST',
                headers: { ...authHeaders },
                body: fd
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok) {
                setResult(data)
                loadProgress()
            } else {
                savedRef.current = false
                setError(data.message || 'Sessiyani saqlab bo\'lmadi')
            }
        } catch {
            savedRef.current = false
            setError('Server bilan bog\'lanib bo\'lmadi')
        } finally {
            setFinalizing(false)
        }
    }

    const resetSession = () => {
        stopConversation()
        stopRecording()
        setMessages([])
        setStarted(false)
        setError('')
        setLevel('')
        setResult(null)
        savedRef.current = false
    }

    const L = LANGS[lang]
    const displayName = partnerName || L.persona
    const statusText = {
        listening: 'Tinglayapman… gapiravering',
        thinking: `${displayName} o'ylayapti…`,
        speaking: `${displayName} gapiryapti…`,
        idle: 'Pauza'
    }[status]
    const lastAi = [...messages].reverse().find(m => m.role === 'ai')
    const needName = !partnerName || editingName
    const lastSession = progress?.last

    return (
        <div className="speaking-page">
            <Navbar />
            <div className="spk">
                {/* Top bar */}
                <div className="spk-top">
                    <div className="spk-who">
                        <AudioLines size={15} /> {displayName} · {L.label}
                        {started && (
                            level
                                ? <span className="spk-level" title="Sizning darajangiz (CEFR)">{level}</span>
                                : <span className="spk-level detecting">daraja aniqlanmoqda…</span>
                        )}
                        {!started && partnerName && (
                            <button className="spk-rename" title="Hamroh ismini o'zgartirish" onClick={() => { setNameInput(partnerName); setEditingName(true) }}>
                                <Pencil size={12} />
                            </button>
                        )}
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
                            {needName ? (
                                /* Hamroh ismini sozlash (bir marta) */
                                <div className="spk-name-setup">
                                    <div className="spk-orb spk-orb--idle"><div className="spk-orb-core" /></div>
                                    <h2>Suhbatdoshingizga ism bering</h2>
                                    <p>Bu sizning shaxsiy AI suhbatdoshingiz. Unga yoqadigan ism qo'ying — {L.label} tilida siz bilan shu nom bilan gaplashadi.</p>
                                    <div className="spk-name-row">
                                        <input
                                            className="spk-name-input"
                                            value={nameInput}
                                            onChange={e => setNameInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                                            placeholder="Masalan: Alex, Nigora, Max…"
                                            maxLength={24}
                                            autoFocus
                                        />
                                        <button className="spk-start" onClick={saveName} disabled={savingName || !nameInput.trim()}>
                                            {savingName ? <><Loader2 size={16} className="spin" /> Saqlanmoqda…</> : 'Saqlash'}
                                        </button>
                                    </div>
                                    {editingName && partnerName && (
                                        <button className="spk-name-cancel" onClick={() => { setEditingName(false); setNameInput('') }}>Bekor qilish</button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Oxirgi natija banneri (kecha vs bugun) */}
                                    {lastSession && progress?.progress && (
                                        <div className={`spk-progress-banner ${progress.progress.levelUp ? 'up' : ''}`}>
                                            {progress.progress.levelUp ? <Trophy size={18} /> : <TrendingUp size={16} />}
                                            <div>
                                                <div className="spk-pb-head">
                                                    O'tgan safar: <b>{lastSession.level || '—'}</b> · {lastSession.score} ball
                                                </div>
                                                <div className="spk-pb-msg">{progress.progress.message}</div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="spk-orb spk-orb--idle"><div className="spk-orb-core" /></div>
                                    <h2>{displayName} bilan erkin gaplashing</h2>
                                    <p>Suhbatni boshlang va shunchaki <strong>gapiravering</strong> — to'xtaganingizda {displayName} darhol javob beradi. Yakunlaganingizda darajangiz baholanadi.</p>
                                    <button className="spk-start" onClick={beginSession} disabled={status === 'thinking'}>
                                        {status === 'thinking' ? <><Loader2 size={17} className="spin" /> Tayyorlanmoqda…</> : <><Mic size={17} /> Suhbatni boshlash</>}
                                    </button>
                                    {!SR && <p className="spk-warn"><AlertTriangle size={14} /> Jonli rejim uchun Chrome yoki Edge kerak.</p>}

                                    {progress?.sessions?.length > 0 && (
                                        <div className="spk-intro-sep"><span>yoki</span></div>
                                    )}
                                    {progress?.sessions?.length > 0 && (
                                        <button className="spk-history-btn" onClick={() => setShowHistory(true)}>
                                            <Clock size={15} /> Natijalar tarixi ({progress.sessions.length})
                                        </button>
                                    )}
                                </>
                            )}
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
                                {lastAi?.help && hintVisible && (
                                    <button className="spk-help" onClick={() => speak(lastAi.help)} title="Tinglash uchun bosing">
                                        <span className="spk-help-label"><Sparkles size={12} /> Shunday ayting</span>
                                        <span className="spk-help-text">"{lastAi.help}"</span>
                                        <Volume2 size={14} />
                                    </button>
                                )}
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
                            className="spk-ctrl spk-ctrl--finish"
                            onClick={finishSession}
                            disabled={finalizing}
                            title="Yakunlash va baholash"
                        >
                            {finalizing ? <Loader2 size={18} className="spin" /> : <Flag size={18} />}
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
                                    <span className="spk-log-who">{m.role === 'ai' ? displayName : 'Siz'}</span>
                                    <span>{m.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Yakuniy natija kartasi */}
                {result && (
                    <div className="spk-result" onClick={() => setResult(null)}>
                        <div className="spk-result-card" onClick={e => e.stopPropagation()}>
                            <button className="spk-result-close" onClick={() => setResult(null)}><X size={18} /></button>
                            <div className={`spk-result-badge ${result.progress?.levelUp ? 'up' : ''}`}>
                                {result.progress?.levelUp ? <Trophy size={30} /> : <Sparkles size={28} />}
                            </div>
                            <div className="spk-result-level">{result.level || '—'}</div>
                            <div className="spk-result-sub">Bugungi darajangiz · {result.score} ball</div>

                            {result.progress?.message && (
                                <div className={`spk-result-msg ${result.progress.levelUp ? 'up' : ''}`}>{result.progress.message}</div>
                            )}

                            <div className="spk-result-stats">
                                <div><span>{result.wordCount}</span>so'z</div>
                                <div><span>{result.turns}</span>marta gapirdingiz</div>
                                <div><span>{result.fluency}</span>ravonlik</div>
                                <div><span>{result.mistakes}</span>xato</div>
                            </div>

                            {result.summary && <p className="spk-result-summary">{result.summary}</p>}

                            {result.audioUrl && (
                                <audio className="spk-result-audio" controls src={result.audioUrl} preload="none" />
                            )}

                            <div className="spk-result-actions">
                                <button className="spk-start" onClick={() => { setResult(null); resetSession(); }}>
                                    <Mic size={16} /> Yana gaplashish
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Natijalar tarixi */}
                {showHistory && (
                    <div className="spk-log" onClick={() => setShowHistory(false)}>
                        <div className="spk-log-panel" onClick={e => e.stopPropagation()}>
                            <div className="spk-log-head"><Clock size={15} /> Natijalarim tarixi</div>
                            {!progress?.sessions?.length ? (
                                <p className="spk-log-empty">Hali natija yo'q</p>
                            ) : progress.sessions.map(s => (
                                <div key={s.id} className="spk-hist-item">
                                    <div className="spk-hist-top">
                                        <span className="spk-hist-lang">{(LANGS[s.lang] || LANGS.en).code}</span>
                                        <span className="spk-hist-level">{s.level || '—'}</span>
                                        <span className="spk-hist-score">{s.score} ball</span>
                                        <span className="spk-hist-date">{fmtDate(s.createdAt)}</span>
                                    </div>
                                    {s.summary && <p className="spk-hist-summary">{s.summary}</p>}
                                    <div className="spk-hist-meta">{s.wordCount} so'z · {s.fluency} ravonlik · {s.mistakes} xato</div>
                                    {s.audioUrl && <audio className="spk-result-audio" controls src={s.audioUrl} preload="none" />}
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
