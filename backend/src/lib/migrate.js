// Server boshlanganda DB schema'sini avtomatik tayyorlash.
// migrations/ papkasidagi *.sql fayllarni tartib bilan qo'llaydi.
// Qaysilari qo'llanganligini schema_migrations jadvalida saqlaydi.

const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const pool = require('../db')

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations')

// Asosiy users/courses jadvallari (loyiha boshlanganida kerak)
const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  daraja TEXT,
  emoji TEXT,
  description TEXT,
  about TEXT,
  image TEXT,
  lessons JSONB DEFAULT '[]'::jsonb,
  darslar INTEGER DEFAULT 0,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT,
  lesson_index INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, course_id, lesson_index)
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  subject TEXT,
  experience TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  age_group TEXT,
  goal TEXT,
  experience TEXT,
  interests TEXT[],
  available_time TEXT,
  preferred_field TEXT,
  recommended_courses TEXT[],
  ai_advice TEXT,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ratings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 1000,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  total_battles INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  host_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  max_players INTEGER DEFAULT 2,
  problem_id TEXT,
  problem_title TEXT,
  problem_text TEXT,
  language TEXT,
  template TEXT,
  status TEXT DEFAULT 'waiting',
  winner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS battle_players (
  id SERIAL PRIMARY KEY,
  battle_id TEXT REFERENCES battles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(battle_id, user_id)
);

CREATE TABLE IF NOT EXISTS battle_submissions (
  id SERIAL PRIMARY KEY,
  battle_id TEXT REFERENCES battles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  code TEXT,
  language TEXT,
  score INTEGER DEFAULT 0,
  time_taken INTEGER DEFAULT 0,
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(battle_id, user_id)
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL,
  difficulty TEXT,
  language TEXT,
  problem_title TEXT,
  problem_text TEXT,
  template TEXT,
  user_code TEXT,
  score INTEGER,
  feedback TEXT,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, challenge_date)
);

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  last_completed_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS module_tests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT,
  module_index INTEGER,
  attempt_date DATE NOT NULL,
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 20,
  passed BOOLEAN DEFAULT FALSE,
  questions JSONB,
  user_answers JSONB,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, course_id, module_index, attempt_date)
);

CREATE TABLE IF NOT EXISTS ai_teacher_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, usage_date)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
`

const runMigrations = async () => {
  try {
    // 1. Asosiy schema (idempotent — IF NOT EXISTS)
    await pool.query(BASE_SCHEMA)
    console.log('📦 Asosiy schema qo\'llandi')

    // 2. migrations/*.sql fayllar
    if (!fs.existsSync(MIGRATIONS_DIR)) return

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const applied = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [file]
      )
      if (applied.rows.length > 0) continue

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      try {
        await pool.query(sql)
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        )
        console.log(`✅ Migration ${file} qo'llandi`)
      } catch (err) {
        console.error(`❌ Migration ${file} xatosi:`, err.message)
        throw err
      }
    }
    console.log('✅ Barcha migration\'lar yangi')

    // 3. Admin foydalanuvchi yaratish (faqat birinchi marta)
    await ensureAdminUser()
  } catch (err) {
    console.error('Migration runner xatosi:', err.message)
    throw err
  }
}

const ensureAdminUser = async () => {
  const email = (process.env.ADMIN_EMAIL || 'admin@eduzy.uz').toLowerCase()
  const password = process.env.ADMIN_PASSWORD

  if (!password) {
    console.warn('⚠️  ADMIN_PASSWORD .env da yo\'q — admin yaratilmaydi')
    return
  }

  // Mavjud adminni tekshirish
  const existing = await pool.query(
    'SELECT id, role, email_verified FROM users WHERE email = $1',
    [email]
  )

  if (existing.rows.length > 0) {
    const u = existing.rows[0]
    // Mavjud lekin admin emas yoki tasdiqlanmagan — tuzatamiz
    if (u.role !== 'admin' || !u.email_verified) {
      await pool.query(
        `UPDATE users SET role = 'admin', email_verified = TRUE WHERE id = $1`,
        [u.id]
      )
      console.log('🔧 Admin roli tiklandi:', email)
    } else {
      console.log('👤 Admin allaqachon mavjud:', email)
    }
    return
  }

  // Admin yo'q — yaratamiz
  const hash = await bcrypt.hash(password, 12)
  await pool.query(
    `INSERT INTO users (name, email, password, role, email_verified)
     VALUES ($1, $2, $3, 'admin', TRUE)`,
    ['Admin', email, hash]
  )
  console.log('✅ Admin yaratildi:', email)
}

module.exports = { runMigrations, ensureAdminUser }
