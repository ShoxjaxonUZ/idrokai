-- Video davom ettirish — student qayerda to'xtaganini eslab qolish
CREATE TABLE IF NOT EXISTS lesson_video_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_index INTEGER NOT NULL,
  position_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration_seconds DOUBLE PRECISION,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id, lesson_index)
);

CREATE INDEX IF NOT EXISTS idx_lvp_user_course
  ON lesson_video_progress(user_id, course_id);
