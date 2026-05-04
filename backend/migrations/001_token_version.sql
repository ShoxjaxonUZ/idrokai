-- Token versiyasi: rol/parol o'zgarganda eski tokenlarni invalidatsiya qilish uchun.
-- Foydalanuvchining JWT token'i `tv` claim ichida o'z versiyasini olib yuradi.
-- DB versiyasi token versiyasidan farq qilsa, token rad etiladi.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
