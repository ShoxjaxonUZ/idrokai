-- Battle qiyinlik darajasi: oson / orta / qiyin.
-- Masala generatsiyasiga ta'sir qiladi va tezkor match shu daraja bo'yicha
-- raqib topadi.
ALTER TABLE battles ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'orta';
