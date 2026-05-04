-- Email tasdiqlash: foydalanuvchi haqiqiy emailga ega ekanligini tasdiqlash uchun.
-- Yangi register: email_verified=FALSE, link emailga yuboriladi → bosilsa TRUE bo'ladi.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token) WHERE verification_token IS NOT NULL;

-- Mavjud admin va testlar uchun foydalanuvchilarni tasdiqlangan deb belgilash
-- (production'ga chiqishdan oldin emaslariga ham link yuborishingiz mumkin)
UPDATE users SET email_verified = TRUE WHERE role = 'admin' OR id IN (SELECT id FROM users LIMIT 0);
