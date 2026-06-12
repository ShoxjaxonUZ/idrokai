import { useEffect, useState, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  Sparkles, Rocket, BookOpen, Award, Bot, Swords,
  Smartphone, ArrowRight, Star, Users, Play, UserPlus,
  Target, Trophy, ChevronDown, Globe, Flame, Check,
  Quote, Send, MessageCircle, GraduationCap
} from 'lucide-react'
import { API_URL, assetUrl, getUser, getToken } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import '../styles/home.css'

// Count-up — raqam 0 dan haqiqiy qiymatga sanaydi (ko'ringanda)
function CountUp({ value, suffix }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (doneRef.current) { setDisplay(Number(value) || 0); return }
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !doneRef.current) {
        doneRef.current = true
        obs.disconnect()
        const target = Number(value) || 0
        const start = performance.now()
        const tick = (now) => {
          const p = Math.min(1, (now - start) / 1400)
          setDisplay(Math.round(target * (1 - Math.pow(1 - p, 3))))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.4 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value])

  return <span ref={ref}>{display}<span className="ln-stat-suffix">{suffix}</span></span>
}

const CODE_SNIPPETS = [
  { lang: 'main.py', code: "# Birinchi dasturim\ndef salomlash(ism):\n    return f\"Salom, {ism}!\"\n\nprint(salomlash(\"Aziz\"))\n# Natija: Salom, Aziz!" },
  { lang: 'app.js', code: "// Sonlar yig'indisi\nconst sum = (a, b) => a + b;\n\nconsole.log(sum(7, 14));\n// Natija: 21" },
  { lang: 'data.py', code: "# Eng katta sonni topish\nsonlar = [4, 9, 2, 17, 5]\neng_katta = max(sonlar)\n\nprint(eng_katta)\n# Natija: 17" }
]

function Home() {
  const navigate = useNavigate()
  const user = getUser()
  const token = getToken()
  const isAuth = !!(user && token)
  const [courses, setCourses] = useState([])
  // API'dan real son kelguncha (yoki 0 bo'lsa) marketing minimal qiymatlar
  // ko'rsatiladi — landing'da hech qachon "0 o'quvchi" chiqmasligi kerak
  const [stats, setStats] = useState({ users: 500, courses: 50, lessons: 300, certificates: 300 })
  const [openFaq, setOpenFaq] = useState(0)

  const [snippetIdx, setSnippetIdx] = useState(0)
  const [typedText, setTypedText] = useState('')

  // Kontakt forma
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [formErr, setFormErr] = useState('')

  useEffect(() => {
    if (isAuth) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    const els = document.querySelectorAll('.ln-reveal')
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [isAuth, courses])

  useEffect(() => {
    if (isAuth) return
    const full = CODE_SNIPPETS[snippetIdx].code
    let pos = 0
    let timer
    const type = () => {
      if (pos <= full.length) {
        setTypedText(full.slice(0, pos)); pos++
        timer = setTimeout(type, 38)
      } else {
        timer = setTimeout(() => {
          setTypedText('')
          setSnippetIdx(i => (i + 1) % CODE_SNIPPETS.length)
        }, 2600)
      }
    }
    timer = setTimeout(type, 400)
    return () => clearTimeout(timer)
  }, [snippetIdx, isAuth])

  useEffect(() => {
    if (isAuth) return
    document.title = "Eduzy — O'zbek tilida zamonaviy ta'lim"
    fetch(`${API_URL}/api/teacher/all-courses`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setCourses(data.slice(0, 6)) })
      .catch(() => { })
    fetch(`${API_URL}/api/stats`)
      .then(r => r.json())
      .then(d => setStats(s => ({
        users: d.users || s.users, courses: d.courses || s.courses,
        lessons: d.lessons || s.lessons, certificates: d.certificates || s.certificates
      })))
      .catch(() => { })
  }, [isAuth])

  if (isAuth) return <Navigate to="/dashboard" replace />

  const submitContact = async (e) => {
    e.preventDefault()
    setFormErr('')
    if (form.name.trim().length < 2) return setFormErr('Ismingizni kiriting')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setFormErr('Email noto\'g\'ri')
    if (form.message.trim().length < 10) return setFormErr('Xabar kamida 10 belgi bo\'lsin')
    setSending(true)
    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Xatolik')
      setSent(true)
      setForm({ name: '', email: '', message: '' })
    } catch (err) {
      setFormErr(err.message || 'Yuborib bo\'lmadi')
    } finally {
      setSending(false)
    }
  }

  const aboutStats = [
    { Icon: Users, value: stats.users, suffix: '+', label: "O'quvchilar" },
    { Icon: BookOpen, value: stats.courses, suffix: '+', label: 'Kurslar' },
    { Icon: Play, value: stats.lessons, suffix: '+', label: 'Darslar' },
    { Icon: Award, value: stats.certificates, suffix: '+', label: 'Sertifikatlar' },
    { Icon: Bot, value: 24, suffix: '/7', label: 'AI yordam' },
  ]

  const smallBenefits = [
    { Icon: Swords, title: 'Code Battle', desc: "Real vaqtda 1–10 kishilik kod musobaqasi va solo praktika." },
    { Icon: Award, title: 'Avtomatik sertifikat', desc: 'Kursni yakunlang — QR kodli rasmiy PDF sertifikat tayyor.' },
    { Icon: Flame, title: 'Kunlik masala + streak', desc: "Har kuni yangi challenge, bonus ball va reytingda ko'tarilish." },
    { Icon: Globe, title: "Sof o'zbek tilida", desc: 'Materiallar, AI javoblar va testlar — tarjima emas, o\'zimizniki.' },
    { Icon: Smartphone, title: 'Mobil-first', desc: 'Telefon, planshet va kompyuterda bir xil qulay ishlaydi.' },
  ]

  const onlineFeatures = [
    "Istalgan joydan — faqat telefon yoki kompyuter kerak",
    "AI ustoz bilan 24/7 shaxsiy mashg'ulotlar",
    "Modulli darslar va avtomatik bilim nazorati",
    "Code Battle orqali amaliyot va musobaqa",
    "Bepul boshlang — Premium obuna barchasini ochadi",
  ]

  const steps = [
    { num: '01', Icon: UserPlus, title: "Ro'yxatdan o'ting", desc: 'Bepul akkaunt yarating — bir necha soniyada.' },
    { num: '02', Icon: BookOpen, title: 'Kursni tanlang', desc: "O'zingizga mos sohani tanlab darslarni boshlang." },
    { num: '03', Icon: Trophy, title: 'Sertifikat oling', desc: "Testlardan o'ting va rasmiy sertifikatni yuklab oling." },
  ]

  const testimonials = [
    { name: 'Alijon Karimov', role: 'Junior Frontend Developer', text: "Eduzy da Python va JavaScript o'rganib bugun ish topdim. Darslar tushunarli va praktik!", avatar: 'A' },
    { name: 'Malika Rahimova', role: 'Student', text: "Code Battle eng zo'r qism! Boshqalar bilan real vaqtda kod yozish juda qiziqarli.", avatar: 'M' },
    { name: 'Bekzod Aliyev', role: "O'qituvchi", text: "AI test juda samarali. O'quvchilarim bilimini avtomatik tekshirish — ajoyib.", avatar: 'B' },
  ]

  const faqs = [
    { q: 'Eduzy bepulmi?', a: "Ro'yxatdan o'tish va boshlash bepul — ko'plab kurslar ochiq. Premium obuna esa barcha kurslar, kengaytirilgan AI va cheksiz sertifikatlarni ochadi." },
    { q: 'Sertifikat qanday olaman?', a: "Kursni tugatib AI testlardan o'tsangiz, sertifikat avtomatik PDF formatda tayyor bo'ladi." },
    { q: 'Code Battle nima?', a: "Dasturchilar uchun real vaqtdagi musobaqa — masala yechib ball to'plang va reytingda ko'tariling." },
    { q: 'AI Test qanday ishlaydi?', a: "Sun'iy intellekt har bir kurs uchun shaxsiy testlar yaratadi va har 5 darsdan keyin bilimni tekshiradi." },
    { q: 'Mobil qurilmada ishlaydimi?', a: "Albatta! Eduzy telefon, planshet va kompyuterda bir xil qulay ishlaydi." },
  ]

  return (
    <div className="eduzy-landing">
      <Navbar />

      {/* ============ HERO ============ */}
      <section className="ln-hero">
        <div className="ln-hero-grid"></div>
        <div className="ln-hero-glow"></div>
        <div className="ln-hero-deco" aria-hidden="true">
          <div className="ln-code-card">
            <div className="ln-code-head">
              <div className="ln-code-dots"><span></span><span></span><span></span></div>
              <div className="ln-code-tab">{CODE_SNIPPETS[snippetIdx].lang}</div>
            </div>
            <div className="ln-code-body">
              <pre>{typedText}<span className="ln-cursor">▋</span></pre>
            </div>
          </div>
        </div>

        <div className="ln-container ln-hero-inner">
          <div className="ln-hero-content">
            <span className="ln-hero-eyebrow">EDUZY</span>
            <h1 className="ln-hero-title">
              Kelajak kasblarini<br /><span className="ln-gold">o'zbek tilida</span> o'rganing
            </h1>
            <p className="ln-hero-sub">
              O'zbekistonning zamonaviy ta'lim platformasi — dasturlash,
              AI yordamchi, Code Battle va rasmiy sertifikatlar bilan.
            </p>
            <button className="ln-btn ln-btn-gold ln-btn-lg" onClick={() => navigate('/register')}>
              <Rocket size={18} /> Bepul boshlash
            </button>
            <div className="ln-hero-trust">
              <div className="ln-trust-avatars">
                {['#FFCF00', '#FF7A59', '#5B5BD6', '#22c55e'].map((c, i) => (
                  <span key={i} className="ln-trust-avatar" style={{ background: c }}>{['A', 'M', 'B', 'D'][i]}</span>
                ))}
              </div>
              <div className="ln-trust-text">
                <div className="ln-trust-stars">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="#FFCF00" color="#FFCF00" />)}
                </div>
                <span><strong>{stats.users}+</strong> o'quvchi bizni tanlagan</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ BIZ HAQIMIZDA (stats) ============ */}
      <section className="ln-section ln-about">
        <span className="ln-blob ln-blob-a" aria-hidden="true"></span>
        <div className="ln-container">
          <div className="ln-head ln-reveal">
            <span className="ln-eyebrow">Biz haqimizda</span>
            <h2>O'zbekistondagi <span className="ln-gold">zamonaviy</span> ta'lim platformasi</h2>
            <p>Minglab o'quvchilar tanlagan — sifatli, zamonaviy va o'zbek tilida.</p>
          </div>
          <div className="ln-stats-row ln-reveal">
            {aboutStats.map((s, i) => (
              <div key={i} className="ln-stat">
                <div className="ln-stat-ic"><s.Icon size={22} /></div>
                <div className="ln-stat-num"><CountUp value={s.value} suffix={s.suffix} /></div>
                <div className="ln-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BIZNING AFZALLIKLAR (bento) ============ */}
      <section className="ln-section ln-soft ln-benefits-sec">
        <span className="ln-blob ln-blob-b" aria-hidden="true"></span>
        <div className="ln-container">
          <div className="ln-head ln-reveal">
            <span className="ln-eyebrow">Bizning afzalliklar</span>
            <h2>Nima uchun aynan <span className="ln-gold">Eduzy</span>?</h2>
            <p>Boshqa platformalarda topilmaydigan, faqat bizda mavjud imkoniyatlar</p>
          </div>

          <div className="ln-bento ln-reveal">
            {/* Katta featured karta — AI Teacher */}
            <article className="ln-bento-big">
              <div className="ln-bento-big-top">
                <span className="ln-benefit-tag ln-tag-gold">Faqat Eduzy</span>
                <div className="ln-bento-ic"><Bot size={26} /></div>
                <h3>AI Teacher — 4 sohada 24/7</h3>
                <p>Dasturlash, matematika, fizika va ingliz tili bo'yicha shaxsiy AI yordamchi. Rasm yuborib ham savol bering.</p>
                <button className="ln-btn ln-btn-gold ln-btn-sm" onClick={() => navigate('/register')}>
                  Sinab ko'rish <ArrowRight size={15} />
                </button>
              </div>
              <div className="ln-chat" aria-hidden="true">
                <div className="ln-chat-msg ln-chat-q">Python'da list nima?</div>
                <div className="ln-chat-msg ln-chat-a">List — bu tartiblangan, o'zgaruvchan to'plam. Misol: <code>sonlar = [1, 2, 3]</code> …</div>
                <div className="ln-chat-msg ln-chat-q">Rahmat! 🙌</div>
              </div>
            </article>

            {smallBenefits.map((b, i) => (
              <article key={i} className="ln-bento-cell">
                <div className="ln-benefit-ic"><b.Icon size={22} /></div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ONLINE TA'LIM ============ */}
      <section className="ln-section ln-online">
        <span className="ln-blob ln-blob-c" aria-hidden="true"></span>
        <div className="ln-container ln-online-grid">
          <div className="ln-online-text ln-reveal">
            <span className="ln-eyebrow ln-eyebrow-dark">Eduzy Online</span>
            <h2>Endi o'rganishga <span className="ln-gold">masofa to'siq emas</span></h2>
            <p>Bitta smartfon yoki kompyuter — va siz O'zbekistonning eng kuchli ta'lim platformasidasiz.</p>
            <ul className="ln-checklist">
              {onlineFeatures.map((f, i) => <li key={i}><Check size={16} /> {f}</li>)}
            </ul>
            <button className="ln-btn ln-btn-gold" onClick={() => navigate('/register')}>
              Online o'qishni boshlash <ArrowRight size={16} />
            </button>
          </div>
          <div className="ln-online-visual ln-reveal">
            <div className="ln-visual-card ln-vc-1"><Bot size={22} /> <span>AI Teacher</span></div>
            <div className="ln-visual-card ln-vc-2"><Swords size={22} /> <span>Code Battle</span></div>
            <div className="ln-visual-card ln-vc-3"><Smartphone size={22} /> <span>Mobil-first</span></div>
            <div className="ln-visual-card ln-vc-4"><Award size={22} /> <span>Sertifikat</span></div>
          </div>
        </div>
      </section>

      {/* ============ QANDAY ISHLAYDI ============ */}
      <section className="ln-section">
        <div className="ln-container">
          <div className="ln-head ln-reveal">
            <span className="ln-eyebrow">3 bosqich</span>
            <h2>Qanday ishlaydi?</h2>
            <p>Uch oddiy qadamda o'rganishni boshlang</p>
          </div>
          <div className="ln-steps ln-reveal">
            {steps.map((s, i) => (
              <div key={i} className="ln-step">
                <div className="ln-step-num">{s.num}</div>
                <div className="ln-step-ic"><s.Icon size={28} /></div>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MASHHUR KURSLAR ============ */}
      {courses.length > 0 && (
        <section className="ln-section ln-soft">
          <div className="ln-container">
            <div className="ln-head ln-reveal">
              <span className="ln-eyebrow">Kurslar</span>
              <h2>Mashhur kurslar</h2>
              <p>Eng ko'p o'qilgan va sevilgan kurslar bilan tanishing</p>
            </div>
            <div className="ln-courses ln-reveal">
              {courses.map(kurs => (
                <div key={kurs.id} className="ln-course" onClick={() => navigate(`/courses/${kurs.id}`)}>
                  <div className="ln-course-thumb">
                    {kurs.image ? <img src={assetUrl(kurs.image)} alt={kurs.title} />
                      : <div className="ln-course-empty"><BookOpen size={42} /></div>}
                    <span className="ln-course-free"><Sparkles size={10} /> Top</span>
                  </div>
                  <div className="ln-course-body">
                    <div className="ln-course-tags">
                      <span>{kurs.category}</span><span>{kurs.daraja}</span>
                    </div>
                    <h3>{kurs.title}</h3>
                    <p>{(kurs.desc || kurs.description || '').substring(0, 78)}…</p>
                    <div className="ln-course-meta">
                      <span><BookOpen size={12} /> {kurs.lessons?.length || 0} dars</span>
                      <span><Users size={12} /> {kurs.students_count || 0}</span>
                      {kurs.ratings_count > 0
                        ? <span className="ln-course-rate"><Star size={12} fill="currentColor" /> {kurs.avg_rating.toFixed(1)}</span>
                        : <span className="ln-course-rate" style={{ opacity: .6 }}><Star size={12} /> Yangi</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="ln-center">
              <button className="ln-btn ln-btn-dark" onClick={() => navigate('/courses')}>
                Barcha kurslar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ============ NATIJALAR / FIKRLAR ============ */}
      <section className="ln-section">
        <div className="ln-container">
          <div className="ln-head ln-reveal">
            <span className="ln-eyebrow">Natijalar</span>
            <h2>O'quvchilar nima deyishadi?</h2>
            <p>Minglab o'quvchilarning haqiqiy taassurotlari</p>
          </div>
          <div className="ln-tests ln-reveal">
            {testimonials.map((t, i) => (
              <div key={i} className="ln-test">
                <Quote className="ln-test-q" size={28} />
                <p className="ln-test-text">{t.text}</p>
                <div className="ln-test-stars">
                  {[...Array(5)].map((_, j) => <Star key={j} size={13} fill="#FFCF00" color="#FFCF00" />)}
                </div>
                <div className="ln-test-author">
                  <span className="ln-test-avatar">{t.avatar}</span>
                  <div>
                    <div className="ln-test-name">{t.name}</div>
                    <div className="ln-test-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="ln-section ln-soft">
        <div className="ln-container ln-faq-wrap">
          <div className="ln-head ln-reveal">
            <span className="ln-eyebrow">FAQ</span>
            <h2>Sizni qiziqtirgan savollarga javob</h2>
          </div>
          <div className="ln-faq ln-reveal">
            {faqs.map((f, i) => (
              <div key={i} className={`ln-faq-item ${openFaq === i ? 'ln-open' : ''}`}>
                <button className="ln-faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                  <span>{f.q}</span>
                  <ChevronDown size={20} className="ln-faq-chev" />
                </button>
                {openFaq === i && <div className="ln-faq-a"><p>{f.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ KONTAKT ============ */}
      <section className="ln-section ln-contact">
        <div className="ln-container">
          <div className="ln-contact-box ln-reveal">
            <div className="ln-contact-left">
              <span className="ln-eyebrow">Bog'lanish</span>
              <h2>Savollaringiz qoldimi?<br />Biz bilan <span className="ln-gold">bog'laning!</span></h2>
              <p>Ism, email va xabaringizni qoldiring — tez orada javob beramiz.</p>
              <div className="ln-qa" aria-hidden="true">
                <span className="ln-qa-q">Q</span>
                <span className="ln-qa-a">A</span>
              </div>
            </div>

            {sent ? (
              <div className="ln-contact-success">
                <div className="ln-success-ic"><Check size={32} /></div>
                <h3>Xabaringiz yuborildi!</h3>
                <p>Rahmat — tez orada siz bilan bog'lanamiz.</p>
                <button className="ln-btn ln-btn-dark ln-btn-sm" onClick={() => setSent(false)}>Yana yuborish</button>
              </div>
            ) : (
              <form className="ln-contact-form" onSubmit={submitContact}>
                <input
                  type="text" placeholder="Ismingiz" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
                <input
                  type="email" placeholder="Email manzilingiz" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
                <textarea
                  rows={3} placeholder="Xabaringiz…" value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                />
                {formErr && <div className="ln-form-err">{formErr}</div>}
                <button type="submit" className="ln-btn ln-btn-grad" disabled={sending}>
                  {sending ? 'Yuborilmoqda…' : <><Send size={17} /> Ariza qoldirish</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="ln-cta">
        <div className="ln-container">
          <div className="ln-cta-box ln-reveal">
            <div className="ln-cta-ic"><GraduationCap size={30} /></div>
            <h2>Bepul ta'lim <span className="ln-gold">hozir boshlanadi</span></h2>
            <p>Ro'yxatdan o'ting va {stats.courses}+ kursni kashf qiling. Bepul boshlang — xohlagan paytda Premium'ga o'ting.</p>
            <div className="ln-cta-actions">
              <button className="ln-btn ln-btn-gold" onClick={() => navigate('/register')}>
                <UserPlus size={18} /> Ro'yxatdan o'tish
              </button>
              <button className="ln-btn ln-btn-ghost-dark" onClick={() => navigate('/courses')}>
                <BookOpen size={18} /> Kurslarni ko'rish
              </button>
            </div>
            <div className="ln-cta-feats">
              <span><Check size={14} /> Bepul</span>
              <span><Check size={14} /> Sertifikat</span>
              <span><MessageCircle size={14} /> AI yordam</span>
              <span><Target size={14} /> 24/7</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default Home
