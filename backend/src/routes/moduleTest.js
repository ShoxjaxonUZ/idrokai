const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth } = require('../middleware/auth')
const { extractAndParseJson } = require('../lib/jsonParse')
const notifications = require('../lib/notifications')

const getTodayDate = () => new Date().toISOString().split('T')[0]

const { groqFetch } = require('../lib/groq')

router.get('/status/:courseId/:moduleIndex', auth, async (req, res) => {
  try {
    const { courseId, moduleIndex } = req.params
    const moduleIdx = parseInt(moduleIndex, 10)
    if (Number.isNaN(moduleIdx) || moduleIdx < 0 || moduleIdx > 100) {
      return res.status(400).json({ message: 'moduleIndex noto\'g\'ri' })
    }
    const today = getTodayDate()

    const todayAttempt = await pool.query(`
      SELECT id, score, passed, completed_at FROM module_tests
      WHERE user_id = $1 AND course_id = $2 AND module_index = $3 AND attempt_date = $4
    `, [req.user.id, courseId, moduleIdx, today])

    const passed = await pool.query(`
      SELECT score, completed_at FROM module_tests
      WHERE user_id = $1 AND course_id = $2 AND module_index = $3 AND passed = TRUE
      ORDER BY completed_at DESC LIMIT 1
    `, [req.user.id, courseId, moduleIdx])

    const att = todayAttempt.rows[0] || null
    res.json({
      passed: passed.rows.length > 0,
      lastAttempt: att,
      canAttempt: !att || (att && !att.completed_at),
      score: passed.rows[0]?.score || null
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/generate', auth, async (req, res) => {
  try {
    const { courseId, moduleIndex } = req.body
    const moduleIdx = parseInt(moduleIndex, 10)
    if (!courseId || Number.isNaN(moduleIdx) || moduleIdx < 0 || moduleIdx > 100) {
      return res.status(400).json({ message: 'courseId/moduleIndex noto\'g\'ri' })
    }
    const today = getTodayDate()

    const enrolled = await pool.query(
      'SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    )
    if (enrolled.rows.length === 0) {
      return res.status(403).json({ message: 'Avval kursga yozilish kerak' })
    }

    const todayAttempt = await pool.query(`
      SELECT id, passed, completed_at, questions FROM module_tests
      WHERE user_id = $1 AND course_id = $2 AND module_index = $3 AND attempt_date = $4
    `, [req.user.id, courseId, moduleIdx, today])

    if (todayAttempt.rows.length > 0) {
      const att = todayAttempt.rows[0]
      if (att.passed) {
        return res.status(400).json({ message: 'Allaqachon o\'tdingiz', alreadyPassed: true })
      }
      if (att.completed_at) {
        return res.status(429).json({
          message: 'Bugun urinish qilingan. Ertaga qayta urinib ko\'ring',
          nextAttempt: 'tomorrow'
        })
      }
      const stored = typeof att.questions === 'string' ? JSON.parse(att.questions) : att.questions
      const safe = (stored || []).map(q => ({ question: q.question, options: q.options }))
      return res.json({ questions: safe, total: safe.length, attemptId: att.id })
    }

    const courseRes = await pool.query('SELECT * FROM courses WHERE id = $1', [courseId])
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ message: 'Kurs topilmadi' })
    }
    const course = courseRes.rows[0]
    let lessons
    try {
      lessons = typeof course.lessons === 'string' ? JSON.parse(course.lessons) : course.lessons
    } catch {
      return res.status(500).json({ message: 'Kurs darslari buzilgan' })
    }
    if (!Array.isArray(lessons)) {
      return res.status(500).json({ message: 'Kurs darslari noto\'g\'ri formatda' })
    }

    const startLesson = moduleIdx * 5
    const endLesson = startLesson + 5
    const moduleLessons = lessons.slice(startLesson, endLesson)
    if (moduleLessons.length === 0) {
      return res.status(400).json({ message: 'Bu modulda darslar yo\'q' })
    }
    const lessonTitles = moduleLessons.map((l, i) => `${startLesson + i + 1}. ${l.title}`).join('\n')

    const prompt = `Sen test yaratuvchi AI san. ${course.title} kursi uchun 20 ta MUSHKUL test savolini yarat.

KURS HAQIDA: ${course.about || course.description || course.title}
KATEGORIYA: ${course.category}
DARAJA: ${course.daraja}

USHBU MODUL DARSLARI:
${lessonTitles}

QOIDALAR:
1. Aynan SHU darslar mavzularidan 20 ta savol yarat
2. Har savolda 4 ta variant (A, B, C, D)
3. Faqat BITTA to'g'ri javob
4. Savollar TO'G'RI JAVOBI har xil joyda bo'lsin (A, B, C, D barchasi tasodifiy)
5. Aniq va to'g'ri o'zbek tilida (lotin yozuvi)
6. Savollar mantiqiy va kursga oid bo'lsin

JAVOB FAQAT JSON formatda (boshqa hech narsa yozma):
{"questions": [
  {"question": "Savol matni", "options": ["A variant", "B variant", "C variant", "D variant"], "correct": 0},
  ...
]}

correct — to'g'ri javob indeksi (0 dan 3 gacha)`

    let groqRes
    try {
      groqRes = await groqFetch({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000
      })
    } catch {
      return res.status(504).json({ message: 'AI javob bermadi' })
    }

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content || ''
    const parsed = extractAndParseJson(text)
    if (!parsed) {
      return res.status(500).json({ message: "AI savollar yaratolmadi" })
    }

    const all = Array.isArray(parsed.questions) ? parsed.questions : []
    const questions = all
      .filter(q =>
        q && typeof q.question === 'string' &&
        Array.isArray(q.options) && q.options.length === 4 &&
        Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3
      )
      .slice(0, 20)

    if (questions.length < 20) {
      return res.status(500).json({ message: 'Savollar yetarli emas, qayta urinib ko\'ring' })
    }

    const inserted = await pool.query(`
      INSERT INTO module_tests (user_id, course_id, module_index, attempt_date, score, total, passed, questions, user_answers, completed_at)
      VALUES ($1, $2, $3, $4, 0, 20, FALSE, $5::jsonb, NULL, NULL)
      ON CONFLICT (user_id, course_id, module_index, attempt_date)
      DO UPDATE SET questions = EXCLUDED.questions
      RETURNING id
    `, [req.user.id, courseId, moduleIdx, today, JSON.stringify(questions)])

    const safe = questions.map(q => ({ question: q.question, options: q.options }))
    res.json({ questions: safe, total: safe.length, attemptId: inserted.rows[0].id })
  } catch (err) {
    console.error('Generate error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/submit', auth, async (req, res) => {
  try {
    const { courseId, moduleIndex, answers } = req.body
    const moduleIdx = parseInt(moduleIndex, 10)
    if (!courseId || Number.isNaN(moduleIdx) || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Noto\'g\'ri so\'rov' })
    }
    const today = getTodayDate()

    const row = await pool.query(`
      SELECT id, questions, passed, completed_at FROM module_tests
      WHERE user_id = $1 AND course_id = $2 AND module_index = $3 AND attempt_date = $4
    `, [req.user.id, courseId, moduleIdx, today])

    if (row.rows.length === 0) {
      return res.status(400).json({ message: 'Avval testni yarating' })
    }
    const att = row.rows[0]
    if (att.completed_at) {
      return res.status(400).json({ message: 'Bu test allaqachon yuborilgan' })
    }

    const questions = typeof att.questions === 'string' ? JSON.parse(att.questions) : att.questions
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ message: 'Savollar topilmadi' })
    }

    let correctCount = 0
    questions.forEach((q, i) => {
      const ans = parseInt(answers[i], 10)
      if (Number.isInteger(ans) && ans === parseInt(q.correct, 10)) {
        correctCount++
      }
    })

    const passed = correctCount >= 16

    await pool.query(`
      UPDATE module_tests
      SET score = $1, passed = $2, user_answers = $3::jsonb, completed_at = NOW()
      WHERE id = $4
    `, [correctCount, passed, JSON.stringify(answers), att.id])

    // Notification — test pass bo'lganda
    if (passed) {
      // Kursdagi jami modullarni hisoblash
      const courseRow = await pool.query(
        'SELECT title, lessons FROM courses WHERE id = $1',
        [courseId]
      )
      const course = courseRow.rows[0]
      let totalModules = 1
      if (course) {
        try {
          const lessons = typeof course.lessons === 'string' ? JSON.parse(course.lessons) : course.lessons
          totalModules = Math.max(1, Math.ceil((lessons?.length || 0) / 5))
        } catch {}
      }

      const isLastModule = (moduleIdx + 1) >= totalModules
      const courseTitle = course?.title || 'Kurs'

      if (isLastModule) {
        notifications.notify(
          req.user.id,
          'cert_ready',
          'Sertifikatingiz tayyor!',
          `"${courseTitle}" kursini muvaffaqiyatli tugatdingiz. Sertifikatingizni oling.`,
          `/certificate/${courseId}`,
          'award'
        ).catch(() => {})
      } else {
        notifications.notify(
          req.user.id,
          'system',
          `${moduleIdx + 1}-qism testi o'tildi!`,
          `"${courseTitle}" — keyingi qism ochildi, davom eting`,
          `/courses/${courseId}`,
          'award'
        ).catch(() => {})
      }
    }

    res.json({
      passed,
      score: correctCount,
      total: questions.length,
      percentage: Math.round((correctCount / questions.length) * 100)
    })
  } catch (err) {
    console.error('Submit error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

module.exports = router
