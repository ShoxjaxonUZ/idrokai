import { useEffect, useState, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  Sparkles, Rocket, BookOpen, Award, Bot, Swords,
  Smartphone, ArrowRight,
  Star, Users, Play, UserPlus, Target,
  Trophy, ChevronDown, Globe, Flame, Check,
  Phone, Quote
} from 'lucide-react'
import { API_URL, assetUrl, getUser, getToken } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import '../styles/home.css'

// Count-up — raqam 0 dan haqiqiy qiymatga sanaydi (ko'ringanda).
function CountUp({ value, suffix }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (doneRef.current) {
      setDisplay(Number(value) || 0)
      return
    }
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !doneRef.current) {
        doneRef.current = true
        obs.disconnect()
        const target = Number(value) || 0
        const duration = 1400
        const start = performance.now()
        const tick = (now) => {
          const p = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - p, 3)
          setDisplay(Math.round(target * eased))
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

// Hero typewriter — navbatma-navbat kod misollari yoziladi
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
  const [stats, setStats] = useState({ users: 0, courses: 0, lessons: 0, certificates: 0 })
  const [openFaq, setOpenFaq] = useState(0)

  // Typewriter holati
  const [snippetIdx, setSnippetIdx] = useState(0)
  const [typedText, setTypedText] = useState('')

  // Scroll-reveal — section'lar ko'ringanda fade-in
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
    const snippet = CODE_SNIPPETS[snippetIdx]
    const full = snippet.code
    let pos = 0
    let timer

    const type = () => {
      if (pos <= full.length) {
        setTypedText(full.slice(0, pos))
        pos++
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
    document.title = "Eduzy — O'zbek tilida bepul ta'lim"

    fetch(`${API_URL}/api/teacher/all-courses`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCourses(data.slice(0, 6))
        }
      })
      .catch(() => { })

    fetch(`${API_URL}/api/stats`)
      .then(r => r.json())
      .then(d => {
        setStats({
          users: d.users || 0,
          courses: d.courses || 0,
          lessons: d.lessons || 0,
          certificates: d.certificates || 0
        })
      })
      .catch(() => { })
  }, [isAuth])

  if (isAuth) {
    return <Navigate to="/dashboard" replace />
  }

  // BIZ HAQIMIZDA — statistika bandi
  const aboutStats = [
    { value: stats.users, suffix: '', label: "O'quvchilar" },
    { value: stats.courses, suffix: '', label: 'Kurslar' },
    { value: stats.lessons, suffix: '', label: 'Darslar' },
    { value: stats.certificates, suffix: '', label: 'Sertifikatlar' },
    { value: 24, suffix: '/7', label: 'AI yordam' },
  ]

  // BIZNING AFZALLIKLAR
  const benefits = [
    {
      Icon: Bot,
      title: 'AI Teacher — 4 sohada',
      desc: "Dasturlash, matematika, fizika va ingliz tili bo'yicha 24/7 shaxsiy yordamchi. Rasm yuborib ham savol bering.",
      tag: 'Faqat Eduzy',
    },
    {
      Icon: Swords,
      title: 'Code Battle multiplayer',
      desc: "Real vaqtda 1 dan 10 kishigacha kod yozish musobaqasi. Solo praktika rejimi ham mavjud.",
      tag: "O'zbekistonda yagona",
    },
    {
      Icon: BookOpen,
      title: 'Oxshash kurslar tizimi',
      desc: "Har bir kurs modullarga bo'lingan. Har 5 darsdan keyin bilim AI test orqali tekshiriladi.",
      tag: 'Modular',
    },
    {
      Icon: Award,
      title: 'Avtomatik sertifikat',
      desc: "Kurs va testlarni yakunlang — rasmiy sertifikat QR kod bilan PDF formatda tayyor bo'ladi.",
      tag: 'Bepul',
    },
    {
      Icon: Flame,
      title: 'Kunlik masala + streak',
      desc: "Har kuni yangi challenge, ketma-ket kunlar uchun bonus ball va reytingda ko'tarilish.",
      tag: 'Gamification',
    },
    {
      Icon: Globe,
      title: "Sof o'zbek tilida",
      desc: "Barcha materiallar, AI javoblar va testlar o'zbek tilida — tarjima qilingan emas, o'zimizniki.",
      tag: "O'zbekcha",
    },
  ]

  // Online ta'lim — bullet list
  const onlineFeatures = [
    'Telefon yoki kompyuter bilan istalgan joydan o\'rganing',
    'AI ustoz Professor bilan 24/7 shaxsiy mashg\'ulotlar',
    'Modulli darslar va avtomatik bilim nazorati',
    'Code Battle orqali amaliyot va musobaqa',
    'Bepul — hech qanday yashirin to\'lov yo\'q',
  ]

  const steps = [
    { num: '01', Icon: UserPlus, title: "Ro'yxatdan o'ting", desc: 'Bepul akkaunt yarating — bir necha soniyada.' },
    { num: '02', Icon: BookOpen, title: 'Kursni tanlang', desc: "O'zingizga mos sohani tanlab darslarni boshlang." },
    { num: '03', Icon: Trophy, title: 'Sertifikat oling', desc: "Testlardan o'ting va rasmiy sertifikatni yuklab oling." },
  ]

  const testimonials = [
    { name: 'Alijon Karimov', role: 'Junior Frontend Developer', text: "Eduzy da Python va JavaScript kurslarini o'rganib bugun ish topdim. Darslar tushunarli va praktik!", avatar: 'A' },
    { name: 'Malika Rahimova', role: 'Student', text: "Code Battle eng zo'r qism! Boshqa dasturchilar bilan real vaqtda kod yozish juda qiziqarli.", avatar: 'M' },
    { name: 'Bekzod Aliyev', role: "O'qituvchi", text: "AI test juda samarali. O'quvchilarim bilimini avtomatik tekshirish — ajoyib imkoniyat.", avatar: 'B' },
  ]

  const faqs = [
    { q: 'Eduzy haqiqatan ham bepulmi?', a: "Ha, barcha kurslar to'liq bepul. Hech qanday yashirin to'lov yo'q. Istalgan vaqtda istalgan kursni o'rganishingiz mumkin." },
    { q: 'Sertifikat qanday olaman?', a: "Kursni tugatib barcha AI testlardan o'tsangiz, sertifikat avtomatik tayyor bo'ladi va uni PDF formatda yuklab olasiz." },
    { q: 'Code Battle nima?', a: "Dasturchilar uchun real vaqtdagi musobaqa tizimi. Boshqa o'quvchilar bilan masala yechib ball to'plang va reytingda ko'tariling." },
    { q: 'AI Test qanday ishlaydi?', a: "Sun'iy intellekt har bir kurs uchun shaxsiy testlar yaratadi va har 5 darsdan keyin bilimingizni tekshiradi." },
    { q: 'Mobil qurilmada ishlaydimi?', a: "Albatta! Eduzy butunlay moslashuvchan — telefon, planshet va kompyuterda bir xil qulay ishlaydi." },
  ]

  return (
    <div className="eduzy-landing">
      <Navbar />

      {/* ============ HERO — to'liq ekran, matn pastki-chapda ============ */}
      <section className="ln-hero">
        <div className="ln-hero-grid"></div>
        <div className="ln-hero-glow"></div>

        {/* Fon bezagi — typewriter kod kartochkasi (yumshoq, orqada) */}
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
              O'zbekistondagi zamonaviy bepul ta'lim platformasi — dasturlash,
              AI yordamchi, Code Battle va rasmiy sertifikatlar bilan.
            </p>
            <button className="ln-btn ln-btn-gold ln-btn-lg" onClick={() => navigate('/register')}>
              <Rocket size={18} /> Bepul boshlash
            </button>

            <div className="ln-hero-trust">
              <div className="ln-trust-avatars">
                {['#FFCF00', '#FF7A59', '#5B5BD6', '#22c55e'].map((c, i) => (
                  <span key={i} className="ln-trust-avatar" style={{ background: c }}>
                    {['A', 'M', 'B', 'D'][i]}
                  </span>
                ))}
              </div>
              <div className="ln-trust-text">
                <div className="ln-trust-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill="#FFCF00" color="#FFCF00" />
                  ))}
                </div>
                <span><strong>{stats.users}</strong> o'quvchi bizni tanlagan</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS BAND (BIZ HAQIMIZDA) ============ */}
      <section className="ln-stats-band">
        <div className="ln-container">
          <div className="ln-stats-row ln-reveal">
            {aboutStats.map((s, i) => (
              <div key={i} className="ln-stat">
                <div className="ln-stat-num"><CountUp value={s.value} suffix={s.suffix} /></div>
                <div className="ln-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BIZNING AFZALLIKLAR ============ */}
      <section className="ln-section">
        <div className="ln-container">
          <div className="ln-head ln-reveal">
            <span className="ln-eyebrow">Bizning afzalliklar</span>
            <h2>Nima uchun <span className="ln-gold">aynan Eduzy</span>?</h2>
            <p>Boshqa platformalarda topilmaydigan, faqat bizda mavjud imkoniyatlar</p>
          </div>
          <div className="ln-benefits ln-reveal">
            {benefits.map((b, i) => (
              <article key={i} className="ln-benefit" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="ln-benefit-ic"><b.Icon size={24} /></div>
                <span className="ln-benefit-tag">{b.tag}</span>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ONLINE TA'LIM (highlight) ============ */}
      <section className="ln-section ln-online">
        <div className="ln-container ln-online-grid">
          <div className="ln-online-text ln-reveal">
            <span className="ln-eyebrow ln-eyebrow-dark">Yangi darajadagi ta'lim</span>
            <h2>Endi o'rganishga <span className="ln-gold">masofa to'siq emas</span></h2>
            <p>Bitta smartfon yoki kompyuter — va siz O'zbekistonning eng kuchli ta'lim platformasidasiz.</p>
            <ul className="ln-checklist">
              {onlineFeatures.map((f, i) => (
                <li key={i}><Check size={16} /> {f}</li>
              ))}
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
                    {kurs.image ? (
                      <img src={assetUrl(kurs.image)} alt={kurs.title} />
                    ) : (
                      <div className="ln-course-empty"><BookOpen size={42} /></div>
                    )}
                    <span className="ln-course-free"><Sparkles size={10} /> Bepul</span>
                  </div>
                  <div className="ln-course-body">
                    <div className="ln-course-tags">
                      <span>{kurs.category}</span>
                      <span>{kurs.daraja}</span>
                    </div>
                    <h3>{kurs.title}</h3>
                    <p>{(kurs.desc || kurs.description || '').substring(0, 78)}…</p>
                    <div className="ln-course-meta">
                      <span><BookOpen size={12} /> {kurs.lessons?.length || 0} dars</span>
                      <span><Users size={12} /> {kurs.students_count || 0}</span>
                      {kurs.ratings_count > 0 ? (
                        <span className="ln-course-rate"><Star size={12} fill="currentColor" /> {kurs.avg_rating.toFixed(1)}</span>
                      ) : (
                        <span className="ln-course-rate" style={{ opacity: 0.6 }}><Star size={12} /> Yangi</span>
                      )}
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

      {/* ============ CTA / KONTAKT ============ */}
      <section className="ln-cta">
        <div className="ln-container">
          <div className="ln-cta-box ln-reveal">
            <span className="ln-eyebrow ln-eyebrow-dark">Bugundan boshlang</span>
            <h2>Bepul ta'lim <span className="ln-gold">hozir boshlanadi</span></h2>
            <p>Ro'yxatdan o'ting va {stats.courses}+ kursga ega bo'ling. Hech qanday to'lov yo'q — faqat bilim.</p>
            <div className="ln-cta-actions">
              <button className="ln-btn ln-btn-gold" onClick={() => navigate('/register')}>
                <UserPlus size={18} /> Ro'yxatdan o'tish
              </button>
              <a className="ln-btn ln-btn-ghost-dark" href="tel:+998000000000">
                <Phone size={18} /> Biz bilan bog'lanish
              </a>
            </div>
            <div className="ln-cta-feats">
              <span><Check size={14} /> Bepul</span>
              <span><Check size={14} /> Sertifikat</span>
              <span><Check size={14} /> AI yordam</span>
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
