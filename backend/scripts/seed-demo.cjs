/* eslint-disable */
// Demo ma'lumot yaratish — investorlarga ko'rsatish uchun.
// 5 ta professional kurs + 3 ta demo foydalanuvchi (1 ta o'qituvchi).
//
// Ishlatish:
//   cd backend && node scripts/seed-demo.cjs

require('dotenv').config()
const bcrypt = require('bcryptjs')
const pool = require('../src/db')

const COURSES = [
  {
    id: 'python-asoslari',
    title: 'Python Dasturlash Asoslari',
    category: 'Dasturlash',
    daraja: 'Boshlovchi',
    emoji: '🐍',
    description: 'Python dasturlash tilini noldan o\'rganing. O\'zgaruvchilar, sikllar, funksiyalar va loyihalar.',
    about: 'Bu kurs Python tilini hech qanday tajribasiz o\'rganishni boshlamoqchilar uchun. Har bir mavzu video, misol va amaliy mashqlar bilan tushuntiriladi. Kurs oxirida mustaqil Python loyihasi yarata olasiz.',
    image: '/uploads/images/demo-python.jpg',
    lessons: Array.from({ length: 15 }, (_, i) => ({
      title: [
        'Pythonga kirish va o\'rnatish',
        'O\'zgaruvchilar va ma\'lumot turlari',
        'Operatorlar va ifodalar',
        'String va matn bilan ishlash',
        'Ro\'yxat (list) va tuple',
        'Lug\'atlar (dict) va to\'plamlar',
        'Sharti operatorlar (if/else)',
        'Sikllar (for, while)',
        'Funksiyalar va lambda',
        'Modullar va paketlar',
        'Fayl bilan ishlash',
        'Xatoliklarni boshqarish (try/except)',
        'Object Oriented Programming',
        'Dekoratorlar',
        'Yakuniy loyiha — Python kalkulator'
      ][i],
      videoUrl: '',
      description: '',
      materialUrl: '',
      materialName: ''
    }))
  },
  {
    id: 'javascript-web',
    title: 'JavaScript va Web Dasturlash',
    category: 'Dasturlash',
    daraja: 'O\'rta',
    emoji: '⚡',
    description: 'Zamonaviy JavaScript (ES6+), DOM manipulyatsiyasi va React asoslari.',
    about: 'Web saytlar yaratishni o\'rganmoqchimisiz? Bu kurs JavaScript tilini chuqur o\'rgatadi: ES6 sintaksisi, async/await, fetch API, va React. Kurs oxirida o\'zingiz to-do app yaratasiz.',
    image: '/uploads/images/demo-js.jpg',
    lessons: Array.from({ length: 20 }, (_, i) => ({
      title: `${i + 1}-dars: JavaScript ${['asoslari', 'turi', 'sintaksisi', 'amaliyoti', 'mavzulari'][i % 5]}`,
      videoUrl: '', description: '', materialUrl: '', materialName: ''
    }))
  },
  {
    id: 'matematika-ege',
    title: 'Oliy matematika — Algebra va Kalkulyatsiya',
    category: 'Matematika',
    daraja: 'O\'rta',
    emoji: '📐',
    description: 'Maktab matematikasi va oliy o\'quv yurti uchun tayyorgarlik. Algebra, geometriya, hosila, integral.',
    about: 'Akademik matematikadan kuchsiz bo\'lsangiz yoki imtihonga tayyorlanyapsizmi? Bu kurs sizga kerak. Har mavzu nazariy material va 50+ amaliy masaladan iborat.',
    image: '/uploads/images/demo-math.jpg',
    lessons: Array.from({ length: 25 }, (_, i) => ({
      title: `${i + 1}-mavzu: ${['Algebra', 'Geometriya', 'Trigonometriya', 'Hosila', 'Integral'][i % 5]}`,
      videoUrl: '', description: '', materialUrl: '', materialName: ''
    }))
  },
  {
    id: 'ingliz-tili',
    title: 'Ingliz Tili — A1 dan B2 gacha',
    category: 'Til',
    daraja: 'Boshlovchi',
    emoji: '🇬🇧',
    description: 'Ingliz tilini noldan o\'rganing. Grammatika, so\'z boyligi, talaffuz va suhbat amaliyoti.',
    about: 'Ingliz tilida erkin gaplashishni xohlaysizmi? Bu kurs A1 (boshlovchi) darajasidan B2 (yuqori o\'rta) gacha olib boradi. IELTS va TOEFL imtihonlariga ham tayyorlaydi.',
    image: '/uploads/images/demo-eng.jpg',
    lessons: Array.from({ length: 30 }, (_, i) => ({
      title: `Lesson ${i + 1}: ${['Greetings', 'Past Tense', 'Future', 'Conditionals', 'Phrasal Verbs'][i % 5]}`,
      videoUrl: '', description: '', materialUrl: '', materialName: ''
    }))
  },
  {
    id: 'react-pro',
    title: 'React.js — Mukammal Kurs',
    category: 'Dasturlash',
    daraja: 'Yuqori',
    emoji: '⚛️',
    description: 'Zamonaviy React: Hooks, Context, Redux, Next.js va real loyihalar.',
    about: 'React Frontend kutubxonasini chuqur o\'rganing. Bu kurs sizni Junior darajasidan Middle React Developer darajasiga ko\'taradi. Bir nechta haqiqiy loyihalar bilan portfolio yaratasiz.',
    image: '/uploads/images/demo-react.jpg',
    lessons: Array.from({ length: 18 }, (_, i) => ({
      title: `${i + 1}-mavzu: React ${['Hooks', 'Context', 'Router', 'Redux', 'Next.js'][i % 5]}`,
      videoUrl: '', description: '', materialUrl: '', materialName: ''
    }))
  }
]

const DEMO_USERS = [
  { name: 'Bekzod Karimov', email: 'demo.bekzod@eduzy.uz', password: 'Demo1234', role: 'student' },
  { name: 'Sevara O\'roqova', email: 'demo.sevara@eduzy.uz', password: 'Demo1234', role: 'student' },
  { name: 'Aziz Rahimov', email: 'demo.teacher@eduzy.uz', password: 'Demo1234', role: 'teacher' }
]

;(async () => {
  console.log('\n🌱 Demo ma\'lumot yaratilmoqda...\n')

  try {
    // 1. Foydalanuvchilar
    console.log('👥 Demo foydalanuvchilar:')
    const userIds = {}
    for (const u of DEMO_USERS) {
      const hash = await bcrypt.hash(u.password, 12)
      const r = await pool.query(
        `INSERT INTO users (name, email, password, role, email_verified)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, role = EXCLUDED.role, email_verified = TRUE
         RETURNING id`,
        [u.name, u.email.toLowerCase(), hash, u.role]
      )
      userIds[u.email] = r.rows[0].id
      console.log(`   ✓ ${u.role.padEnd(8)} ${u.email} (parol: ${u.password})`)
    }

    // 2. Kurslar
    console.log('\n📚 Demo kurslar:')
    const teacherId = userIds['demo.teacher@eduzy.uz']
    for (const c of COURSES) {
      await pool.query(
        `INSERT INTO courses (id, title, category, daraja, emoji, description, about, image, lessons, darslar, teacher_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, NOW())
         ON CONFLICT (id) DO UPDATE
         SET title = EXCLUDED.title, category = EXCLUDED.category, daraja = EXCLUDED.daraja,
             emoji = EXCLUDED.emoji, description = EXCLUDED.description, about = EXCLUDED.about,
             image = EXCLUDED.image, lessons = EXCLUDED.lessons, darslar = EXCLUDED.darslar`,
        [c.id, c.title, c.category, c.daraja, c.emoji, c.description, c.about, c.image,
         JSON.stringify(c.lessons), c.lessons.length, teacherId]
      )
      console.log(`   ${c.emoji} ${c.title} (${c.lessons.length} dars)`)
    }

    // 3. Test enrollments — Bekzod Python va JS ga yozilgan
    console.log('\n🎓 Demo o\'qish progressi:')
    const bekzodId = userIds['demo.bekzod@eduzy.uz']
    const sevaraId = userIds['demo.sevara@eduzy.uz']

    await pool.query(
      `INSERT INTO enrollments (user_id, course_id, progress, created_at)
       VALUES ($1, 'python-asoslari', 60, NOW() - INTERVAL '14 days'),
              ($1, 'javascript-web', 25, NOW() - INTERVAL '7 days'),
              ($2, 'matematika-ege', 80, NOW() - INTERVAL '30 days'),
              ($2, 'ingliz-tili', 40, NOW() - INTERVAL '10 days')
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [bekzodId, sevaraId]
    )
    console.log(`   Bekzod: Python (60%), JavaScript (25%)`)
    console.log(`   Sevara: Matematika (80%), Ingliz tili (40%)`)

    // 4. Reytinglar
    await pool.query(
      `INSERT INTO ratings (user_id, points, wins, losses, total_battles)
       VALUES ($1, 1450, 12, 5, 17),
              ($2, 1280, 8, 4, 12)
       ON CONFLICT (user_id) DO UPDATE
       SET points = EXCLUDED.points, wins = EXCLUDED.wins,
           losses = EXCLUDED.losses, total_battles = EXCLUDED.total_battles`,
      [bekzodId, sevaraId]
    )
    console.log('   Reytinglar yaratildi')

    // 5. Streaks
    await pool.query(
      `INSERT INTO user_streaks (user_id, current_streak, longest_streak, total_completed, total_points, last_completed_date)
       VALUES ($1, 7, 14, 23, 380, CURRENT_DATE - 1),
              ($2, 3, 11, 18, 290, CURRENT_DATE - 1)
       ON CONFLICT (user_id) DO UPDATE
       SET current_streak = EXCLUDED.current_streak, longest_streak = EXCLUDED.longest_streak,
           total_completed = EXCLUDED.total_completed, total_points = EXCLUDED.total_points`,
      [bekzodId, sevaraId]
    )
    console.log('   Streak\'lar yaratildi')

    console.log('\n✅ Demo ma\'lumot tayyor!')
    console.log('\n📋 INVESTOR DEMO uchun:')
    console.log('   • Admin login:    admin@eduzy.uz / Admin1234')
    console.log('   • Student login:  demo.bekzod@eduzy.uz / Demo1234')
    console.log('   • Teacher login:  demo.teacher@eduzy.uz / Demo1234')
    console.log('   • 5 ta kurs (108 ta dars)')
    console.log('   • Demo progress va reytinglar mavjud\n')

    process.exit(0)
  } catch (err) {
    console.error('XATO:', err.message)
    process.exit(1)
  }
})()
