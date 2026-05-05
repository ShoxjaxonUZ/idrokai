/* eslint-disable */
// DB ma'lumotlarini tozalash — admin va schema saqlanadi.
//
// Ishlatish:
//   Lokal:    cd backend && node scripts/reset-data.cjs
//   Render:   Render Shell ochib: node scripts/reset-data.cjs
//
// XAVF: bu skript foydalanuvchilar, kurslar, hujum log'lari va boshqa
// ma'lumotlarni o'chiradi! Admin foydalanuvchi saqlanadi.

require('dotenv').config()
const pool = require('../src/db')

;(async () => {
  console.log('\n⚠️  DB MA\'LUMOTLARINI TOZALASH')
  console.log('   Admin va schema saqlanadi, qolgan hammasi o\'chiriladi.\n')

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@idrokai.uz').toLowerCase()

  try {
    // 1. Admin id'ni topib qo'yamiz
    const adminRes = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail])
    const adminId = adminRes.rows[0]?.id
    if (!adminId) {
      console.warn('⚠️  Admin topilmadi:', adminEmail)
    } else {
      console.log('👤 Admin topildi (id:', adminId, ')')
    }

    // 2. Tozalash tartibida (foreign key cascade'ga ishonamiz)
    const queries = [
      // Hujum log'lari
      `DELETE FROM attack_logs`,
      // Battle
      `DELETE FROM battle_submissions`,
      `DELETE FROM battle_players`,
      `DELETE FROM battles`,
      // Daily
      `DELETE FROM daily_challenges`,
      `DELETE FROM user_streaks`,
      // Ta'lim
      `DELETE FROM module_tests`,
      `DELETE FROM lesson_progress`,
      `DELETE FROM enrollments`,
      `DELETE FROM comments`,
      // Teacher
      `DELETE FROM teacher_requests`,
      // Profil
      `DELETE FROM user_profiles`,
      // Reyting
      `DELETE FROM ratings`,
      // AI ishlatish
      `DELETE FROM ai_teacher_usage`,
      // Kurslar
      `DELETE FROM courses`,
      // Foydalanuvchilar (admin'dan tashqari)
      adminId
        ? { text: `DELETE FROM users WHERE id != $1`, values: [adminId] }
        : `DELETE FROM users WHERE role != 'admin'`
    ]

    for (const q of queries) {
      try {
        const r = typeof q === 'string'
          ? await pool.query(q)
          : await pool.query(q.text, q.values)
        const tableName = (typeof q === 'string' ? q : q.text).match(/FROM (\w+)/)[1]
        console.log(`🗑  ${tableName.padEnd(22, ' ')} → ${r.rowCount} qator o'chirildi`)
      } catch (err) {
        const tableName = (typeof q === 'string' ? q : q.text).match(/FROM (\w+)/)?.[1] || '?'
        console.log(`⚠️  ${tableName} — ${err.message}`)
      }
    }

    // 3. Sequence (id auto-increment) ni reset qilish
    console.log('\n🔄 ID hisoblagichlarini reset qilish:')
    const seqs = [
      'users_id_seq',
      'comments_id_seq',
      'enrollments_id_seq',
      'lesson_progress_id_seq',
      'teacher_requests_id_seq',
      'user_profiles_id_seq',
      'battle_players_id_seq',
      'battle_submissions_id_seq',
      'daily_challenges_id_seq',
      'module_tests_id_seq',
      'ai_teacher_usage_id_seq',
      'attack_logs_id_seq'
    ]
    for (const seq of seqs) {
      try {
        // Admin id'dan keyin boshlanadigan qilamiz (admin'ni saqlash uchun)
        const restartId = (seq === 'users_id_seq' && adminId) ? adminId + 1 : 1
        await pool.query(`ALTER SEQUENCE ${seq} RESTART WITH ${restartId}`)
        console.log(`   ${seq} → ${restartId} dan boshlanadi`)
      } catch (err) {
        // Sequence mavjud bo'lmasa o'tkazib yuboramiz
      }
    }

    // 4. Yakuniy holat
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users)::int AS users,
        (SELECT COUNT(*) FROM courses)::int AS courses,
        (SELECT COUNT(*) FROM enrollments)::int AS enrollments,
        (SELECT COUNT(*) FROM attack_logs)::int AS attack_logs
    `)
    console.log('\n✅ Tozalash yakunlandi.')
    console.log('📊 Yakuniy holat:', counts.rows[0])
    console.log('\nAdmin akkaunt o\'zgartirilmagan — eski parol bilan kirishingiz mumkin.\n')

    process.exit(0)
  } catch (err) {
    console.error('XATO:', err.message)
    process.exit(1)
  }
})()
