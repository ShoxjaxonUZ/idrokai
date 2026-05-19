-- Haftalik turnir: har hafta yangilanadigan ball hisobi.
-- weekly_points faqat g'alabalardan o'sadi; week_start o'sha ballning qaysi
-- haftaga tegishliligini bildiradi. Yangi hafta boshlanganda lazy-reset bo'ladi
-- (week_start joriy haftadan farq qilsa, hisob 0 dan boshlanadi).
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS weekly_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS week_start DATE;
