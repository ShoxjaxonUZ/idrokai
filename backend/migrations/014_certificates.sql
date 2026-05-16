-- Berilgan sertifikatlar — QR orqali verify qilinadi
CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  cert_code TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  course_title TEXT NOT NULL,
  lessons_count INTEGER DEFAULT 0,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(cert_code);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
