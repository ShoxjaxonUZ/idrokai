import { useEffect, useState, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  Sparkles, Rocket, BookOpen, Award, Bot, Swords,
  Smartphone, ArrowRight, Play, GraduationCap, BarChart3,
  Star, Users, Clock, Target, UserPlus, PlayCircle,
  Trophy, CheckCircle2, ChevronDown, Shield, Zap,
  Quote, Globe, Code2, Lightbulb, TrendingUp, Heart,
  MessageCircle, Calendar, Flame, X, Check, Newspaper
} from 'lucide-react'
import { API_URL, assetUrl, getUser, getToken } from '../lib/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import '../styles/home.css'

// Count-up — raqam 0 dan haqiqiy qiymatga sanaydi (ko'ringanda).
// Home'dan TASHQARIDA — aks holda typewriter re-render'da remount bo'ladi.
function CountUp({ value, suffix }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Animatsiya tugagandan keyin value o'zgarsa (fetch) — darrov sync
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

  return <span ref={ref}>{display}<span className="big-stat-suffix">{suffix}</span></span>
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
  const [stats, setStats] = useState({ users: 0, courses: 0, lessons: 0 })
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

    const els = document.querySelectorAll('.reveal')
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [isAuth, courses])

  useEffect(() => {
    if (isAuth) return
    const snippet = CODE_SNIPPETS[snippetIdx]
    const full = snippet.code
    let pos = 0
    let timer

    // Yozish fazasi
    const type = () => {
      if (pos <= full.length) {
        setTypedText(full.slice(0, pos))
        pos++
        timer = setTimeout(type, 38)
      } else {
        // To'liq yozilgach 2.6s kutib keyingisiga o'tish
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
    document.title = "IdrokAI — O'zbek tilida bepul ta'lim"

    fetch(`${API_URL}/api/teacher/all-courses`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCourses(data.slice(0, 6))
          const totalStudents = data.reduce((acc, c) => acc + (c.students_count || 0), 0)
          const totalLessons = data.reduce((acc, c) => acc + (c.lessons?.length || 0), 0)
          setStats({
            users: totalStudents || 150,
            courses: data.length,
            lessons: totalLessons
          })
        }
      })
      .catch(() => { })
  }, [isAuth])

  if (isAuth) {
    return <Navigate to="/dashboard" replace />
  }

  const features = [
    { Icon: GraduationCap, title: "O'zbek tilida", desc: "Barcha kurslar sof o'zbek tilida tayyorlangan", color: "#8b5cf6" },
    { Icon: Bot, title: "AI Test tizimi", desc: "Sun'iy intellekt yordamida shaxsiy testlar", color: "#0ea5e9" },
    { Icon: Swords, title: "Code Battle", desc: "Real vaqtda dasturchilar bilan musobaqa", color: "#22c55e" },
    { Icon: Award, title: "Sertifikat", desc: "Kursni tugatib rasmiy sertifikat oling", color: "#f59e0b" },
    { Icon: Zap, title: "Modular tizim", desc: "Har 5 darsdan keyin bilimni tekshirish", color: "#ec4899" },
    { Icon: Smartphone, title: "Barcha qurilma", desc: "Telefon, planshet va kompyuterda", color: "#06b6d4" },
    { Icon: Shield, title: "Xavfsiz", desc: "Ma'lumotlar shifrlangan va himoyalangan", color: "#10b981" },
    { Icon: Globe, title: "Istalgan vaqtda", desc: "24/7 onlayn, istalgan joydan", color: "#f97316" },
  ]

  const steps = [
    {
      num: "01",
      Icon: UserPlus,
      title: "Ro'yxatdan o'ting",
      desc: "Bepul akkaunt yarating — bir necha soniyada."
    },
    {
      num: "02",
      Icon: BookOpen,
      title: "Kursni tanlang",
      desc: "O'zingizga mos sohani tanlang va darslarni ko'rishni boshlang."
    },
    {
      num: "03",
      Icon: Trophy,
      title: "Sertifikat oling",
      desc: "Testlardan o'ting va rasmiy sertifikatingizni yuklab oling."
    }
  ]

  const testimonials = [
    {
      name: "Alijon Karimov",
      role: "Junior Frontend Developer",
      text: "IdrokAI da Python va JavaScript kurslarini o'rganib, bugun ish topdim. Darslar juda tushunarli va praktik. Ajoyib platforma!",
      avatar: "A",
      color: "#8b5cf6"
    },
    {
      name: "Malika Rahimova",
      role: "Student",
      text: "Code Battle tizimi eng zo'r qism! Boshqa dasturchilar bilan real vaqtda kod yozish juda qiziqarli va foydali.",
      avatar: "M",
      color: "#ec4899"
    },
    {
      name: "Bekzod Aliyev",
      role: "O'qituvchi",
      text: "AI test juda samarali ishlaydi. O'quvchilarim bilimini har 5 darsdan keyin avtomatik tekshirish — ajoyib imkoniyat.",
      avatar: "B",
      color: "#0ea5e9"
    }
  ]

  // Asosiy statistikalar — kuchli ko'rinish
  const bigStats = [
    { Icon: Users, value: stats.users || 500, suffix: '+', label: "Faol o'quvchi", color: '#5B5BD6' },
    { Icon: BookOpen, value: stats.courses || 50, suffix: '+', label: 'Kurs', color: '#0F9D77' },
    { Icon: Play, value: stats.lessons || 1000, suffix: '+', label: 'Dars', color: '#DC8B1A' },
    { Icon: Heart, value: 95, suffix: '%', label: 'Mamnunlik', color: '#EC4899' },
    { Icon: Bot, value: 24, suffix: '/7', label: 'AI yordam', color: '#0788C7' },
    { Icon: Award, value: 100, suffix: '%', label: 'Bepul', color: '#A78BFA' },
  ]

  // Bizning ustunliklarimiz — taqqoslash
  const advantages = [
    {
      Icon: Bot,
      title: 'AI Teacher 4 sohada',
      desc: "Dasturlash, matematika, fizika va ingliz tili bo'yicha 24/7 individual yordam",
      highlight: 'Faqat IdrokAI'
    },
    {
      Icon: Swords,
      title: 'Code Battle multiplayer',
      desc: "Real vaqtda 1 dan 10 kishigacha kod yozish musobaqasi. Solo praktika ham bor",
      highlight: 'Yagona O\'zbekistonda'
    },
    {
      Icon: Flame,
      title: 'Kunlik masala + streak',
      desc: "Har kuni yangi challenge, daraja oshirish va reytingda ko'tarilish",
      highlight: 'Gamification'
    },
    {
      Icon: Award,
      title: 'Avtomatik sertifikat',
      desc: "Kurs tugagandan keyin rasmiy sertifikat PDF formatda yuklab oling",
      highlight: 'Bepul'
    },
    {
      Icon: Globe,
      title: "Sof o'zbek tilida",
      desc: "Barcha materiallar, AI javoblar va testlar o'zbek tilida — tarjima emas",
      highlight: 'O\'zimizniki'
    },
    {
      Icon: Smartphone,
      title: 'Mobil-first dizayn',
      desc: "Telefon, planshet va kompyuterda bir xil qulay — istalgan joydan o'rganing",
      highlight: 'Responsive'
    },
  ]

  // Yangiliklar — so'nggi platform yangilanishlari
  const news = [
    {
      tag: 'YANGI',
      tagColor: '#0F9D77',
      Icon: Bot,
      title: 'AI Teacher endi rasmlarni ham tahlil qiladi',
      desc: 'Daftaringizdagi misol yoki kod ekranini rasm qilib yuboring — AI darrov javob beradi.',
      date: 'Bu hafta'
    },
    {
      tag: 'YANGILANDI',
      tagColor: '#5B5BD6',
      Icon: Swords,
      title: 'Code Battle 1-10 o\'yinchi rejimida',
      desc: 'Endi do\'stlaringiz bilan birgalikda real vaqtda kod yozish musobaqasini o\'ynashingiz mumkin.',
      date: 'O\'tgan hafta'
    },
    {
      tag: 'YAXSHILANDI',
      tagColor: '#DC8B1A',
      Icon: Trophy,
      title: 'Sertifikatlar yangi dizaynda',
      desc: 'Premium ko\'rinish, QR kod va onlayn tasdiqlash bilan rasmiy sertifikatlar.',
      date: '2 hafta oldin'
    },
    {
      tag: 'YANGI',
      tagColor: '#EC4899',
      Icon: Flame,
      title: 'Kunlik masala — streak va daraja',
      desc: 'Har kun bitta masala yeching, ketma-ket kunlar uchun bonus ball va rang to\'plang.',
      date: '3 hafta oldin'
    },
  ]

  const faqs = [
    {
      q: "IdrokAI haqiqatan ham bepulmi?",
      a: "Ha, barcha kurslar to'liq bepul. Hech qanday yashirin to'lov yo'q. Siz istalgan vaqtda istalgan kursni o'rganishingiz mumkin."
    },
    {
      q: "Sertifikat qanday olaman?",
      a: "Kursni tugatib, barcha AI testlardan muvaffaqiyatli o'tsangiz, sertifikat avtomatik tayyor bo'ladi. Uni PDF formatida yuklab olishingiz mumkin."
    },
    {
      q: "Code Battle nima?",
      a: "Bu dasturchilar uchun real vaqtda musobaqa tizimi. Boshqa o'quvchilar bilan 5 daqiqada masala yechib, ball to'plang va reytingda ko'tariling."
    },
    {
      q: "AI Test qanday ishlaydi?",
      a: "Sun'iy intellekt har bir kurs uchun shaxsiy testlar yaratadi. Har 5 darsdan keyin bilimingizni tekshiradi va kamchiliklaringizni aniqlaydi."
    },
    {
      q: "Mobil qurilmada ishlaydimi?",
      a: "Albatta! IdrokAI butunlay moslashuvchan — telefon, planshet va kompyuterda bir xil qulaylikda ishlaydi."
    }
  ]

  return (
    <div>
      <Navbar />

      {/* HERO */}
      <section className="hero-new">
        <div className="hero-bg-glow"></div>
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <Sparkles size={14} /> O'zbekistonning zamonaviy ta'lim platformasi
            </div>
            <h1 className="hero-title">
              Kelajak kasblarini
              <br />
              <span className="gradient-text">o'zbek tilida</span> o'rganing
            </h1>
            <p className="hero-subtitle">
              Dasturlash, matematika va zamonaviy kasblar bo'yicha bepul kurslar.
              AI yordami, Code Battle va rasmiy sertifikatlar bilan.
            </p>

            <div className="hero-actions">
              <button className="btn-primary btn-hero" onClick={() => navigate(user ? '/courses' : '/register')}>
                {user ? (
                  <><BookOpen size={18} /> Kurslarga o'tish</>
                ) : (
                  <><Rocket size={18} /> Bepul boshlash</>
                )}
              </button>
              <button className="btn-outline btn-hero" onClick={() => navigate('/courses')}>
                <PlayCircle size={18} /> Kurslarni ko'rish
              </button>
            </div>

            <div className="hero-trust">
              <div className="trust-avatars">
                {['#8b5cf6', '#ec4899', '#0ea5e9', '#22c55e'].map((c, i) => (
                  <div key={i} className="trust-avatar" style={{ background: c }}>
                    {['A', 'M', 'B', 'D'][i]}
                  </div>
                ))}
              </div>
              <div className="trust-text">
                <div className="trust-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>
                <span><strong>{stats.users}+</strong> o'quvchi bizni tanlagan</span>
              </div>
            </div>
          </div>

          {/* Hero illustration */}
          <div className="hero-illustration">
            <div className="illustration-wrap">
              {/* Asosiy kartochka — typewriter kod */}
              <div className="illu-main-card">
                <div className="illu-header">
                  <div className="illu-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div className="illu-tab">{CODE_SNIPPETS[snippetIdx].lang}</div>
                </div>
                <div className="illu-code illu-code-typed">
                  <pre>{typedText}<span className="illu-cursor">▋</span></pre>
                </div>
              </div>

              {/* Floating kartochkalar */}
              <div className="illu-float-1">
                <div className="float-icon" style={{ background: '#8b5cf6' }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <div className="float-title">{stats.courses}+ kurs</div>
                  <div className="float-sub">Barcha sohalar</div>
                </div>
              </div>

              <div className="illu-float-2">
                <div className="float-icon" style={{ background: '#22c55e' }}>
                  <Trophy size={20} />
                </div>
                <div>
                  <div className="float-title">{stats.users}+ o'quvchi</div>
                  <div className="float-sub">Faol talabalar</div>
                </div>
              </div>

              <div className="illu-float-3">
                <div className="float-icon" style={{ background: '#f59e0b' }}>
                  <Award size={20} />
                </div>
                <div>
                  <div className="float-title">Sertifikat</div>
                  <div className="float-sub">Rasmiy hujjat</div>
                </div>
              </div>

              {/* Dekorativ shakllar */}
              <div className="illu-shape illu-shape-1"></div>
              <div className="illu-shape illu-shape-2"></div>
              <div className="illu-shape illu-shape-3"></div>
            </div>
          </div>
        </div>
      </section>

      {/* BIG STATS — kuchli raqamlar */}
      <section className="big-stats-section">
        <div className="home-container">
          <div className="big-stats-header reveal">
            <div className="section-badge">
              <TrendingUp size={14} /> Bizning ko'rsatkichlar
            </div>
            <h2>O'zbekistondagi <span className="gradient-text">eng kuchli</span> ta'lim platformasi</h2>
            <p>Minglab o'quvchilar tanlagan, sevgan va ishongan platformamiz</p>
          </div>

          <div className="big-stats-grid">
            {bigStats.map((s, i) => (
              <div key={i} className="big-stat-card reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                <div className="big-stat-icon" style={{ background: s.color + '15', color: s.color }}>
                  <s.Icon size={28} />
                </div>
                <div className="big-stat-value">
                  <CountUp value={s.value} suffix={s.suffix} />
                </div>
                <div className="big-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MASHHUR KURSLAR */}
      {courses.length > 0 && (
        <section className="home-section">
          <div className="home-container">
            <div className="section-header reveal">
              <div className="section-badge">
                <BookOpen size={14} /> Kurslar
              </div>
              <h2>Mashhur kurslar</h2>
              <p>Eng ko'p o'qilgan va sevilgan kurslar bilan tanishing</p>
            </div>

            <div className="home-course-grid reveal">
              {courses.map(kurs => (
                <div key={kurs.id} className="home-course-card" onClick={() => navigate(`/courses/${kurs.id}`)}>
                  <div className="home-course-thumb">
                    {kurs.image ? (
                      <img src={assetUrl(kurs.image)} alt={kurs.title} />
                    ) : (
                      <div className="home-course-empty">
                        <BookOpen size={48} />
                      </div>
                    )}
                    <div className="home-course-badge">
                      <Sparkles size={10} /> Bepul
                    </div>
                  </div>
                  <div className="home-course-body">
                    <div className="home-course-tags">
                      <span className="home-tag">{kurs.category}</span>
                      <span className="home-tag">
                        <BarChart3 size={10} /> {kurs.daraja}
                      </span>
                    </div>
                    <h3>{kurs.title}</h3>
                    <p>{(kurs.desc || kurs.description || '').substring(0, 80)}...</p>
                    <div className="home-course-meta">
                      <span><BookOpen size={12} /> {kurs.lessons?.length || 0} dars</span>
                      <span><Users size={12} /> {kurs.students_count || 0}</span>
                      {kurs.ratings_count > 0 ? (
                        <span className="home-course-rating">
                          <Star size={12} fill="currentColor" /> {kurs.avg_rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="home-course-rating" style={{ opacity: 0.6 }}>
                          <Star size={12} /> Yangi
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="section-cta">
              <button className="btn-outline" onClick={() => navigate('/courses')}>
                Barcha kurslarni ko'rish <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* BIZNING USTUNLIKLAR */}
      <section className="home-section advantages-section">
        <div className="home-container">
          <div className="section-header reveal">
            <div className="section-badge">
              <Sparkles size={14} /> Bizning ustunliklar
            </div>
            <h2>Nima uchun <span className="gradient-text">aynan IdrokAI</span>?</h2>
            <p>Boshqa platformalarda topilmaydigan, faqat bizda mavjud bo'lgan imkoniyatlar</p>
          </div>

          <div className="advantages-grid reveal">
            {advantages.map((a, i) => (
              <div key={i} className="advantage-card">
                <div className="advantage-header">
                  <div className="advantage-icon">
                    <a.Icon size={22} />
                  </div>
                  <span className="advantage-highlight">{a.highlight}</span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.desc}</p>
                <div className="advantage-check">
                  <Check size={14} /> IdrokAI'da mavjud
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QANDAY ISHLAYDI */}
      <section className="home-section steps-section">
        <div className="home-container">
          <div className="section-header reveal">
            <div className="section-badge">
              <Target size={14} /> 3 bosqich
            </div>
            <h2>Qanday ishlaydi?</h2>
            <p>Uch oddiy qadamda o'rganishni boshlang</p>
          </div>

          <div className="steps-grid reveal">
            {steps.map((s, i) => (
              <div key={i} className="step-card">
                <div className="step-num">{s.num}</div>
                <div className="step-icon">
                  <s.Icon size={32} />
                </div>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
                {i < steps.length - 1 && <div className="step-arrow"><ArrowRight size={20} /></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* YANGILIKLAR */}
      <section className="home-section news-section">
        <div className="home-container">
          <div className="section-header reveal">
            <div className="section-badge">
              <Newspaper size={14} /> Yangiliklar
            </div>
            <h2>So'nggi <span className="gradient-text">yangilanishlar</span></h2>
            <p>Platformani doim yaxshilash uchun harakat qilamiz — har hafta yangi xususiyatlar</p>
          </div>

          <div className="news-grid reveal">
            {news.map((n, i) => (
              <article key={i} className="news-card">
                <div className="news-tag" style={{ background: n.tagColor + '15', color: n.tagColor, borderColor: n.tagColor + '30' }}>
                  {n.tag}
                </div>
                <div className="news-icon">
                  <n.Icon size={24} />
                </div>
                <h3>{n.title}</h3>
                <p>{n.desc}</p>
                <div className="news-date">
                  <Calendar size={12} /> {n.date}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="home-section testimonials-section">
        <div className="home-container">
          <div className="section-header reveal">
            <div className="section-badge">
              <Quote size={14} /> Fikrlar
            </div>
            <h2>O'quvchilar nima deyishadi?</h2>
            <p>Minglab baxtli o'quvchilarning ta'surotlari</p>
          </div>

          <div className="testimonials-grid reveal">
            {testimonials.map((t, i) => (
              <div key={i} className="testimonial-card">
                <div className="testimonial-quote"><Quote size={32} /></div>
                <p className="testimonial-text">"{t.text}"</p>
                <div className="testimonial-stars">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>
                <div className="testimonial-author">
                  <div className="testimonial-avatar" style={{ background: t.color }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="home-section faq-section">
        <div className="home-container">
          <div className="section-header reveal">
            <div className="section-badge">
              <Lightbulb size={14} /> FAQ
            </div>
            <h2>Tez-tez so'raladigan savollar</h2>
            <p>Sizni qiziqtirgan savollarga javoblar</p>
          </div>

          <div className="faq-list reveal">
            {faqs.map((f, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? 'faq-open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                >
                  <span>{f.q}</span>
                  <ChevronDown size={20} className="faq-chevron" />
                </button>
                {openFaq === i && (
                  <div className="faq-answer">
                    <p>{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {!user && (
        <section className="cta-section">
          <div className="home-container">
            <div className="cta-box-new reveal">
              <div className="cta-content">
                <div className="cta-badge">
                  <Rocket size={14} /> Bugundan boshlang
                </div>
                <h2>
                  Bepul ta'lim <span className="gradient-text">hozir boshlanadi</span>
                </h2>
                <p>
                  Ro'yxatdan o'ting va {stats.courses}+ kurslarga ega bo'ling.
                  Hech qanday to'lov yo'q. Faqat bilim.
                </p>
                <div className="cta-actions">
                  <button className="btn-primary btn-hero" onClick={() => navigate('/register')}>
                    <UserPlus size={18} /> Ro'yxatdan o'tish
                  </button>
                  <button className="btn-outline btn-hero" onClick={() => navigate('/login')}>
                    Kirish
                  </button>
                </div>
                <div className="cta-features">
                  <span><CheckCircle2 size={14} color="#22c55e" /> Bepul</span>
                  <span><CheckCircle2 size={14} color="#22c55e" /> Sertifikat</span>
                  <span><CheckCircle2 size={14} color="#22c55e" /> AI yordam</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  )
}

export default Home