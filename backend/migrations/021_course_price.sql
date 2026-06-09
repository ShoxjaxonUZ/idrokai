-- Kurs narxi: har bir ro'yxatdan o'tgan o'quvchi uchun kurs egasiga to'lanadigan
-- summa (so'm). Admin hisobotida to'lovni hisoblash uchun ishlatiladi.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0;
