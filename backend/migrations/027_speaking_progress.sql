-- AI Speaking Partner: hamroh ismi (bir marta) + har sessiya tarixi/baholash.
-- Maqsad: foydalanuvchi o'z suhbatdoshiga ism beradi, har suhbat audio+matn saqlanadi
-- va har safar kechagi natija bilan taqqoslanadi (daraja o'ssa — rag'batlantiramiz).

-- Foydalanuvchi AI suhbatdoshiga bergan ism (til-ustidan bitta ism).
CREATE TABLE IF NOT EXISTS speaking_prefs (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  partner_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Har bir tugallangan speaking sessiyasi: matn transkript + audio URL + baho.
CREATE TABLE IF NOT EXISTS speaking_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lang TEXT NOT NULL DEFAULT 'en',
  transcript JSONB NOT NULL DEFAULT '[]',   -- [{role:'user'|'ai', text}]
  audio_url TEXT,                            -- R2/lokal URL (butun sessiya ovozi)
  audio_key TEXT,                            -- R2 key (o'chirish uchun)
  level TEXT,                                -- CEFR daraja (A1..C2)
  score INTEGER,                             -- umumiy ball 0..100
  word_count INTEGER NOT NULL DEFAULT 0,     -- foydalanuvchi aytgan so'zlar soni
  mistakes INTEGER NOT NULL DEFAULT 0,       -- sezilgan xatolar soni
  fluency INTEGER,                           -- ravonlik 0..100
  turns INTEGER NOT NULL DEFAULT 0,          -- foydalanuvchi necha marta gapirdi
  summary TEXT,                              -- qisqa o'zbekcha izoh
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speaking_sessions_user
  ON speaking_sessions(user_id, created_at DESC);
