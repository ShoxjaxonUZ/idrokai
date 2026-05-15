-- Har dars uchun student savol-javob (Q&A)
CREATE TABLE IF NOT EXISTS lesson_questions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_index INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ,
  upvotes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',  -- 'open' | 'answered' | 'closed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson
  ON lesson_questions(course_id, lesson_index, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_questions_user
  ON lesson_questions(user_id);

-- Upvote'lar uchun alohida jadval (bir user bir marta upvote qiladi)
CREATE TABLE IF NOT EXISTS lesson_question_votes (
  question_id INTEGER REFERENCES lesson_questions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (question_id, user_id)
);
