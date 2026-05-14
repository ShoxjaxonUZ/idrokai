-- Sayt ichidagi bildirishnomalar (in-app notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,             -- 'admin_reply' | 'daily_remind' | 'cert_ready' | 'battle_invite' | 'system'
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,                       -- ichki yo'l: /dashboard, /battle, /certificate/:id va h.k.
  icon TEXT,                       -- lucide icon name (mail, award, swords, ...) — frontend belgilaydi
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Eski notification'larni avtomatik tozalash uchun (30 kun)
-- Bu manuel job'da yoki cron'da bajariladi (hozircha index)
