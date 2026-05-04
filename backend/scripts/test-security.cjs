/* eslint-disable */
// Xavfsizlik tizimini sinash uchun — turli hujum naqshlarini yuboradi.
// Server ishlab turishi kerak (npm run dev).
//
// Ishlatish:
//   cd d:/Desktop/eduuz1/backend
//   node scripts/test-security.cjs
//
// Natija: terminal'da har bir test uchun "✓ aniqlandi" yoki "✗" chiqadi.
// Server konsolida "[Threat]" log'lari ko'rinadi.
// DB'da `attack_logs` jadvalida yangi yozuvlar paydo bo'ladi.
// Telegram bot sozlangan bo'lsa — xabar keladi.

const BASE = process.env.API_URL || 'http://localhost:5000'

const tests = [
  {
    name: 'SQL injection (login)',
    expectCategory: 'sqli',
    fn: () => fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: "admin' OR '1'='1",
        password: 'anything'
      })
    })
  },
  {
    name: 'SQL UNION SELECT',
    expectCategory: 'sqli',
    fn: () => fetch(`${BASE}/api/courses?id=1 UNION SELECT * FROM users`)
  },
  {
    name: 'XSS payload (register)',
    expectCategory: 'xss',
    fn: () => fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '<script>alert(1)</script>',
        email: 'xss@test.com',
        password: 'Test1234'
      })
    })
  },
  {
    name: 'XSS onerror',
    expectCategory: 'xss',
    fn: () => fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '<img src=x onerror=alert(1)>',
        email: 'xss2@test.com',
        password: 'Test1234'
      })
    })
  },
  {
    name: 'Path traversal',
    expectCategory: 'path_traversal',
    fn: () => fetch(`${BASE}/uploads/../../../etc/passwd`)
  },
  {
    name: 'Probe path (.env)',
    expectCategory: 'probe',
    fn: () => fetch(`${BASE}/.env`)
  },
  {
    name: 'Probe path (wp-admin)',
    expectCategory: 'probe',
    fn: () => fetch(`${BASE}/wp-admin/setup-config.php`)
  },
  {
    name: 'Probe path (.git)',
    expectCategory: 'probe',
    fn: () => fetch(`${BASE}/.git/config`)
  },
  {
    name: 'Scanner User-Agent (sqlmap)',
    expectCategory: 'scanner',
    fn: () => fetch(`${BASE}/api/courses`, {
      headers: { 'User-Agent': 'sqlmap/1.5.12' }
    })
  },
  {
    name: 'Scanner User-Agent (nikto)',
    expectCategory: 'scanner',
    fn: () => fetch(`${BASE}/`, {
      headers: { 'User-Agent': 'Nikto/2.1.5' }
    })
  },
  {
    name: 'Failed login (3 marta)',
    expectCategory: 'failed_login',
    fn: async () => {
      for (let i = 0; i < 3; i++) {
        await fetch(`${BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'wrongtest@test.uz', password: 'wrong' + i })
        })
      }
    }
  },
  {
    name: 'Command injection',
    expectCategory: 'cmd_injection',
    fn: () => fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test; cat /etc/passwd',
        email: 'cmd@test.com',
        password: 'Test1234'
      })
    })
  }
]

const wait = (ms) => new Promise(r => setTimeout(r, ms))

;(async () => {
  console.log(`\n🛡️  Xavfsizlik testlari — ${BASE}\n`)
  let passed = 0, failed = 0

  for (const t of tests) {
    process.stdout.write(`  ${t.name.padEnd(40, ' ')} `)
    try {
      await t.fn()
      console.log('✓ yuborildi')
      passed++
    } catch (e) {
      console.log('✗ xato:', e.message)
      failed++
    }
    await wait(300) // server'ni bosmaslik uchun
  }

  console.log(`\n📊 Yuborildi: ${passed}, Xato: ${failed}\n`)

  console.log('🔍 Tekshirish:')
  console.log('   1. Server konsolida "[Threat]" log\'lari paydo bo\'ldimi?')
  console.log('   2. DB tekshiring: SELECT category, COUNT(*) FROM attack_logs')
  console.log('                     WHERE ts > NOW() - INTERVAL \'5 minutes\' GROUP BY category;')
  console.log('   3. Admin sifatida kirib /api/security/stats ni ochib ko\'ring')
  console.log('   4. Telegram bot sozlangan bo\'lsa — push xabarlar kelgani kerak\n')

  // 5 soniya kutamiz, async log yozish tugashi uchun
  console.log('⏳ 5 soniya kutamiz log\'lar DB ga yozilishi uchun...')
  await wait(5000)

  // DB'dagi natijalarni ko'rsatamiz
  try {
    require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
    const pool = require('../src/db')
    const r = await pool.query(`
      SELECT category, severity, COUNT(*)::int AS count, MAX(ts) AS last
      FROM attack_logs
      WHERE ts > NOW() - INTERVAL '5 minutes'
      GROUP BY category, severity
      ORDER BY count DESC
    `)
    console.log('\n📋 So\'nggi 5 daqiqada aniqlangan hujumlar:')
    console.table(r.rows)
    process.exit(0)
  } catch (e) {
    console.log('DB tekshirish xatosi:', e.message)
    process.exit(0)
  }
})()
