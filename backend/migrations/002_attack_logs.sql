-- Hujum aniqlash log'lari
-- Har bir aniqlangan kiber hujum urinishini saqlaydi (IP, geo, payload, vaqt)
CREATE TABLE IF NOT EXISTS attack_logs (
  id SERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT NOW(),
  ip TEXT NOT NULL,
  user_agent TEXT,
  method TEXT,
  url TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  pattern TEXT,
  payload TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  country TEXT,
  city TEXT,
  isp TEXT,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_attack_logs_ts ON attack_logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_attack_logs_ip ON attack_logs(ip);
CREATE INDEX IF NOT EXISTS idx_attack_logs_category ON attack_logs(category);
CREATE INDEX IF NOT EXISTS idx_attack_logs_severity ON attack_logs(severity);
