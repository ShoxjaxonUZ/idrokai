-- Qurilma sessiyalari: bitta akkaunt cheklangan sonli qurilmada faol turadi.
-- Har login yangi sessiya yozuvi yaratadi; JWT token'ning `jti` claim'i
-- shu yozuv id'siga bog'lanadi. Sessiya o'chirilsa, o'sha token darhol kuchsiz.
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,                         -- jti (JWT token id)
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_label TEXT,                           -- "Chrome — Windows" kabi
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
  ON user_sessions(user_id, last_active_at DESC);
