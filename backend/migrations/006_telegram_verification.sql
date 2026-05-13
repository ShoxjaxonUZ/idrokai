-- Telegram orqali tasdiqlash uchun ustunlar
-- verification_token endi 6 raqamli kod sifatida ishlatiladi (Telegram orqali yuboriladi)

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
