-- Dars davomida student yozadigan eslatmalar
CREATE TABLE IF NOT EXISTS lesson_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_index INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id, lesson_index)
);

CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_course
  ON lesson_notes(user_id, course_id);
