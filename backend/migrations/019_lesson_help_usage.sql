-- Dars AI yordami uchun alohida kunlik limit (AI Teacher'dan mustaqil)
CREATE TABLE IF NOT EXISTS lesson_help_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, usage_date)
);
