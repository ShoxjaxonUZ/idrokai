import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HelpCircle, ChevronDown, MessageCircle, Mail
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import '../styles/pages.css'

function Help() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(0)

  useEffect(() => {
    document.title = "Yordam — Eduzy"
  }, [])

  const faqs = [
    {
      q: "Qanday ro'yxatdan o'taman?",
      a: "Bosh sahifadan 'Ro'yxatdan o'tish' tugmasini bosing — ism, email va parol kiriting. Telegram orqali bir tugmali tasdiqlash bilan akkaunt darrov ochiladi."
    },
    {
      q: "Kursga qanday yozilaman?",
      a: "Kurslar sahifasidan kerakli kursni tanlang va 'Kursni boshlash' tugmasini bosing. Hammasi bepul va avtomatik."
    },
    {
      q: "Sertifikat qanday olaman?",
      a: "Kursdagi barcha darslarni tugating va har 5 dars uchun modul testidan o'ting. Hammasi bajarilgach 'Sertifikat olish' tugmasi aktiv bo'ladi."
    },
    {
      q: "AI Teacher qanday ishlaydi?",
      a: "AI Teacher 4 sohada (dasturlash, matematika, fizika, ingliz tili) sizning savolingizga javob beradi. Kuniga 20 ta savol bepul. Rasm ham yuborishingiz mumkin."
    },
    {
      q: "Code Battle nima?",
      a: "Real vaqtda 1-10 kishigacha kod yozish musobaqasi. Solo praktika ham bor. Yutuq — ball va reytingda o'rin."
    },
    {
      q: "Profilimni qanday o'zgartiraman?",
      a: "Yuqori o'ng burchakdagi avataringizni bosing → 'Profil' → istalgan ma'lumotni tahrirlang."
    },
    {
      q: "Tungi va kunduzgi rejim",
      a: "Navbar'da quyosh/oy ikonkasini bosing — tanlovingiz avtomatik saqlanadi."
    },
    {
      q: "Parolni unutdim, nima qilaman?",
      a: "Hozircha parolni tiklash funksiyasi yo'q. /contact orqali yozing, admin yordam beradi."
    }
  ]

  return (
    <div>
      <Navbar />
      <div className="page-wrap">

        <div className="page-hero">
          <div className="page-badge">
            <HelpCircle size={14} /> Yordam markazi
          </div>
          <h1>Sizga <span className="gradient-text">qanday yordam</span> beramiz?</h1>
          <p>Ko'p uchraydigan savollarga javoblar. Boshqa savol bo'lsa — biz bilan bog'laning</p>
        </div>

        {/* FAQ */}
        <div className="page-section">
          <div className="faq-list" style={{ maxWidth: '760px', margin: '0 auto' }}>
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

        {/* Help CTA */}
        <div className="page-cta">
          <MessageCircle size={44} color="var(--primary)" style={{ margin: '0 auto 14px', display: 'block' }} />
          <h2>Javob <span className="gradient-text">topa olmadingizmi?</span></h2>
          <p>Biz bilan to'g'ridan-to'g'ri bog'laning — tez orada javob beramiz</p>
          <button className="btn-primary btn-hero" onClick={() => navigate('/contact')}>
            <Mail size={16} /> Xabar yozish
          </button>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default Help
