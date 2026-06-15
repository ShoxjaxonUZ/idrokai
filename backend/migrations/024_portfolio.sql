-- Natija halqasi — ulashiladigan portfel: profil + loyihalar.
-- Sertifikat/kurs/streak/reyting MAVJUD jadvallardan hisoblanadi (bu yerda saqlanmaydi).

CREATE TABLE IF NOT EXISTS portfolios (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT,
  bio TEXT,
  github_url TEXT,
  telegram_url TEXT,
  looking_for_work BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  tech TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
