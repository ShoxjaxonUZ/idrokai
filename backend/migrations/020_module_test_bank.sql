-- Modul testi savollar banki — kurs darajasida kesh.
-- Muammo: hozir har user / har modul / har kungi urinish uchun alohida
-- Groq AI chaqiruvi ketadi (qimmat + sekin). Bir xil modul savollarini
-- (course_id, module_index) bo'yicha bir marta generatsiya qilib saqlaymiz.
-- prompt_hash kurs mazmuni o'zgarsa keshni avtomatik yangilash uchun.

CREATE TABLE IF NOT EXISTS module_test_bank (
  course_id TEXT NOT NULL,
  module_index INTEGER NOT NULL,
  questions JSONB NOT NULL,        -- to'liq (correct bilan), 20 ta savol
  prompt_hash TEXT NOT NULL,       -- kurs+darslar mazmuni hash'i (invalidatsiya)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (course_id, module_index)
);
