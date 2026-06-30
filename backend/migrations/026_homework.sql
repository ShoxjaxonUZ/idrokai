-- Uyga vazifa topshiriqlari — har user, har dars uchun bitta topshiriq (qayta yuborilsa yangilanadi).
-- Vazifa MATNI darsning o'zida saqlanadi (courses.lessons[i].homework jsonb), bu jadval faqat TALABA JAVOBI.
-- Baholash AI (Groq) orqali avtomatik — score 0..100, feedback o'zbekcha izoh.

CREATE TABLE IF NOT EXISTS homework_submissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_index INTEGER NOT NULL,
  answer TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  feedback TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, course_id, lesson_index)
);

CREATE INDEX IF NOT EXISTS idx_homework_user ON homework_submissions(user_id, course_id);
