import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap, Target, Heart, Rocket, Users,
  Award, Globe, Sparkles, ArrowRight, BookOpen,
  Bot, Swords, Flame, Shield, Zap, Calendar,
  Lightbulb, TrendingUp, Code2, Smartphone, MessageCircle
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import '../styles/pages.css'

function About() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = "Biz haqimizda — IdrokAI"
  }, [])

  const values = [
    { Icon: Target, title: "Sifatli ta'lim", desc: "Har bir kurs professional o'qituvchilar tomonidan tayyorlangan" },
    { Icon: Heart, title: 'Bepul', desc: "Hamma uchun teng ta'lim imkoniyati — to'lov yo'q" },
    { Icon: Globe, title: 'Istalgan joyda', desc: "24/7 onlayn, istalgan qurilmada o'qish mumkin" },
    { Icon: Rocket, title: 'Innovatsiya', desc: 'AI, Battle va zamonaviy texnologiyalar' },
    { Icon: Shield, title: 'Xavfsiz', desc: "Ma'lumotlar shifrlangan, parollar himoyalangan" },
    { Icon: Smartphone, title: 'Mobil-first', desc: "Telefon yoki kompyuter — bir xil qulay" },
    { Icon: Zap, title: 'Tezkor', desc: "Yengil sahifalar, tez yuklanish, smooth UX" },
    { Icon: MessageCircle, title: 'Yordam', desc: "AI Teacher 24/7 + telegram orqali qo'llab-quvvatlash" },
  ]

  const bigStats = [
    { Icon: Users, value: '500+', label: "Faol o'quvchi", color: '#5B5BD6' },
    { Icon: BookOpen, value: '50+', label: 'Sifatli kurs', color: '#0F9D77' },
    { Icon: Award, value: '300+', label: 'Sertifikat', color: '#DC8B1A' },
    { Icon: Bot, value: '24/7', label: 'AI yordam', color: '#0788C7' },
    { Icon: Swords, value: '1000+', label: 'Code Battle', color: '#EC4899' },
    { Icon: Heart, value: '95%', label: 'Mamnunlik', color: '#A78BFA' },
  ]

  const timeline = [
    {
      year: '2024',
      title: 'IdrokAI g\'oyasi',
      desc: "O'zbek tilida sifatli, bepul ta'lim platformasi yaratish g'oyasi paydo bo'ldi",
      Icon: Lightbulb,
      color: '#DC8B1A'
    },
    {
      year: '2025',
      title: 'Birinchi versiya',
      desc: "Asosiy platforma — kurslar, darslar va testlar tizimi ishga tushirildi",
      Icon: Rocket,
      color: '#5B5BD6'
    },
    {
      year: '2025',
      title: 'AI Teacher',
      desc: "4 sohada 24/7 yordam beruvchi sun'iy intellekt o'qituvchi qo'shildi",
      Icon: Bot,
      color: '#0788C7'
    },
    {
      year: '2025',
      title: 'Code Battle',
      desc: "Real vaqtda kod yozish musobaqasi va kunlik masala tizimi",
      Icon: Swords,
      color: '#EC4899'
    },
    {
      year: '2026',
      title: 'Sertifikat tizimi',
      desc: "Avtomatik sertifikat berish, QR kod va onlayn tasdiqlash",
      Icon: Award,
      color: '#0F9D77'
    },
    {
      year: 'Hozir',
      title: "Kelajakda...",
      desc: "Mobile app, video kurslar, marafonlar va ko'plab yangi imkoniyatlar yo'lda",
      Icon: TrendingUp,
      color: '#A78BFA'
    },
  ]

  return (
    <div>
      <Navbar />
      <div className="page-wrap">

        {/* Hero */}
        <div className="page-hero">
          <div className="page-badge">
            <GraduationCap size={14} /> Biz haqimizda
          </div>
          <h1>O'zbek tilida <span className="gradient-text">sifatli ta'lim</span> uchun</h1>
          <p>
            IdrokAI — O'zbekistondagi zamonaviy ta'lim platformasi.
            Bepul kurslar, sun'iy intellekt yordami va real vaqtda musobaqalar bilan
            har kim o'rganishni boshlay oladi.
          </p>
        </div>

        {/* Big Stats */}
        <div className="page-section about-stats-section">
          <div className="about-stats-grid">
            {bigStats.map((s, i) => (
              <div key={i} className="about-stat-card">
                <div className="about-stat-icon" style={{ background: s.color + '15', color: s.color }}>
                  <s.Icon size={26} />
                </div>
                <div className="about-stat-value">{s.value}</div>
                <div className="about-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mission */}
        <div className="page-section">
          <div className="section-header-page">
            <h2>Bizning <span className="gradient-text">missiyamiz</span></h2>
            <p>Nima uchun ushbu platformani yaratdik va nimaga intilamiz</p>
          </div>

          <div className="about-grid">
            <div className="about-card">
              <div className="about-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                <Sparkles size={26} />
              </div>
              <h3>Bizning maqsadimiz</h3>
              <p>
                Har bir o'zbekistonlik uchun sifatli ta'limni bepul va oson yetkazib
                berish. Texnologiya, dasturlash va zamonaviy kasblarni har kim o'rgana oladi.
              </p>
            </div>

            <div className="about-card">
              <div className="about-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                <Heart size={26} />
              </div>
              <h3>Bizning qadriyatlar</h3>
              <p>
                Ochiq, sifatli va erkin ta'lim. Sun'iy intellekt yordamida har bir
                o'quvchining shaxsiy ehtiyojlariga mos darslar va testlar.
              </p>
            </div>

            <div className="about-card">
              <div className="about-icon" style={{ background: 'var(--secondary-bg)', color: 'var(--secondary)' }}>
                <Rocket size={26} />
              </div>
              <h3>Bizning kelajak</h3>
              <p>
                O'zbekistonda texnologiya sohasida mutaxassislar tayyorlash,
                ta'limni raqamlashtirish va dunyo darajasidagi darslar yaratish.
              </p>
            </div>
          </div>
        </div>

        {/* Timeline — Hikoyamiz */}
        <div className="page-section">
          <div className="section-header-page">
            <div className="page-badge" style={{ marginBottom: 20 }}>
              <Calendar size={14} /> Bizning hikoyamiz
            </div>
            <h2>Bosqichma-bosqich <span className="gradient-text">rivojlanish</span></h2>
            <p>IdrokAI qanday yaratildi va qaerga ketmoqda</p>
          </div>

          <div className="timeline">
            {timeline.map((t, i) => (
              <div key={i} className="timeline-item">
                <div className="timeline-marker" style={{ background: t.color }}>
                  <t.Icon size={18} />
                </div>
                <div className="timeline-content">
                  <div className="timeline-year" style={{ color: t.color }}>{t.year}</div>
                  <h4>{t.title}</h4>
                  <p>{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Values */}
        <div className="page-section">
          <div className="section-header-page">
            <h2>Nima uchun <span className="gradient-text">bizni tanlashadi</span></h2>
            <p>IdrokAI ni boshqa platformalardan ajratib turuvchi sabablar</p>
          </div>

          <div className="values-grid values-grid-8">
            {values.map((v, i) => (
              <div key={i} className="value-card">
                <div className="value-icon">
                  <v.Icon size={22} />
                </div>
                <h4>{v.title}</h4>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="page-cta">
          <h2>Bizning jamoamizga <span className="gradient-text">qo'shiling</span></h2>
          <p>Hozir ro'yxatdan o'tib, bepul ta'lim sayohatingizni boshlang</p>
          <button className="btn-primary btn-hero" onClick={() => navigate('/register')}>
            <Rocket size={18} /> Ro'yxatdan o'tish <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default About
