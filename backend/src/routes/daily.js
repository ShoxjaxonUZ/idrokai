const express = require('express')
const router = express.Router()
const pool = require('../db')
const { auth } = require('../middleware/auth')

const MAX_CODE_LEN = 10000

const groqFetch = async (body, ms = 30000) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

const getUserLevel = async (userId) => {
  const profile = await pool.query('SELECT experience FROM user_profiles WHERE user_id = $1', [userId])
  const exp = profile.rows[0]?.experience || 'beginner'
  if (exp === 'beginner' || exp === 'basic') return 'easy'
  if (exp === 'intermediate') return 'medium'
  if (exp === 'advanced') return 'hard'
  return 'easy'
}

const getTodayDate = () => new Date().toISOString().split('T')[0]

const detectLanguage = (course) => {
  const text = ((course.title || '') + ' ' + (course.category || '') + ' ' + (course.about || '')).toLowerCase()
  if (text.includes('javascript') || text.includes('react') || text.includes('node') || text.includes('vue')) return 'javascript'
  if (text.includes('python') || text.includes('django') || text.includes('flask')) return 'python'
  if (text.includes('c++') || text.includes('cpp')) return 'cpp'
  if (text.includes('java') && !text.includes('javascript')) return 'java'
  if (text.includes('php')) return 'php'
  return 'python'
}

const isProgrammingCourse = (course) => {
  const text = ((course.title || '') + ' ' + (course.category || '')).toLowerCase()
  const programmingKeywords = ['dasturlash', 'programming', 'javascript', 'python', 'react', 'node', 'java', 'c++', 'cpp', 'php', 'web', 'kod', 'code']
  return programmingKeywords.some(kw => text.includes(kw))
}

const generateProblem = async (difficulty, language, courseInfo = '') => {
  const difficultyMap = {
    easy: 'oson (yangi boshlovchilar uchun)',
    medium: 'o\'rta darajada',
    hard: 'qiyin (ilg\'or daraja)'
  }

  const courseContext = courseInfo
    ? `\nFoydalanuvchi quyidagi kursda o'qiyapti:\n${courseInfo}\n\nMasala SHU MAVZUGA bog'liq bo'lsin (kurs mazmuni asosida).`
    : ''

  const prompt = `Sen dasturlash masalalari yaratuvchi AI san. Bugun uchun YANGI va QIZIQARLI dasturlash masalasini yarat.

DARAJA: ${difficultyMap[difficulty] || 'oson'}
DASTURLASH TILI: ${language}
${courseContext}

QOIDALAR:
1. Masala ${language} tilida yechilsin
2. Funksiya yozish kerak bo'ladi
3. 2-3 ta misol bersin
4. Aniq va tushunarli o'zbek tilida bo'lsin

JAVOB FAQAT JSON formatda:
{
  "title": "Masala nomi (qisqa, 3-5 so'z)",
  "text": "Masala matni (tushuntirish + 2-3 misol)\\nMisol:\\nfuncName(arg) → result",
  "template": "Funksiya shabloni"
}`

  const fallbacks = {
    python: { title: 'Sonni teskari aylantirish', text: 'reverse(123) → 321', template: 'def reverse(n):\n    pass' },
    javascript: { title: 'Massiv yig\'indisi', text: 'sumArray([1,2,3]) → 6', template: 'function sumArray(arr) {\n}' },
    cpp: { title: 'Sonlar yig\'indisi', text: 'sum(3, 5) → 8', template: 'int sum(int a, int b) {\n    return 0;\n}' },
    java: { title: 'Sonlar yig\'indisi', text: 'sum(3, 5) → 8', template: 'public static int sum(int a, int b) {\n    return 0;\n}' },
    php: { title: 'Massiv yig\'indisi', text: 'sumArray([1,2,3]) → 6', template: '<?php\nfunction sumArray($arr) {\n}\n?>' }
  }

  try {
    const groqRes = await groqFetch({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 800
    })

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content || ''
    const match = text.match(/\{[\s\S]*\}/)

    if (match) {
      const parsed = JSON.parse(match[0])
      return {
        title: String(parsed.title || 'Kunlik masala').slice(0, 200),
        text: String(parsed.text || 'Masala matni').slice(0, 4000),
        template: String(parsed.template || '').slice(0, 4000)
      }
    }
  } catch (err) {
    console.error('AI generate error:', err)
  }

  return fallbacks[language] || fallbacks.python
}

const ensureStreak = async (userId) => {
  await pool.query(
    'INSERT INTO user_streaks (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  )
  const r = await pool.query('SELECT * FROM user_streaks WHERE user_id = $1', [userId])
  return r.rows[0]
}

router.get('/my-courses', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.title, c.category, c.daraja, c.about, c.image
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = $1
      ORDER BY e.created_at DESC
    `, [req.user.id])

    const programmingCourses = result.rows
      .filter(c => isProgrammingCourse(c))
      .map(c => ({
        id: c.id,
        title: c.title,
        category: c.category,
        daraja: c.daraja,
        image: c.image,
        language: detectLanguage(c)
      }))

    res.json(programmingCourses)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.get('/today', auth, async (req, res) => {
  try {
    const today = getTodayDate()
    const requestedCourseId = req.query.courseId

    await ensureStreak(req.user.id)

    let challengeRes = await pool.query(
      'SELECT * FROM daily_challenges WHERE user_id = $1 AND challenge_date = $2',
      [req.user.id, today]
    )

    let challenge

    if (challengeRes.rows.length === 0) {
      let selectedCourse = null

      if (requestedCourseId) {
        const cr = await pool.query(`
          SELECT c.title, c.category, c.daraja, c.about
          FROM enrollments e
          JOIN courses c ON e.course_id = c.id
          WHERE e.user_id = $1 AND c.id = $2
        `, [req.user.id, String(requestedCourseId)])

        if (cr.rows.length > 0 && isProgrammingCourse(cr.rows[0])) {
          selectedCourse = cr.rows[0]
        }
      }

      if (!selectedCourse) {
        const cr = await pool.query(`
          SELECT c.title, c.category, c.daraja, c.about
          FROM enrollments e
          JOIN courses c ON e.course_id = c.id
          WHERE e.user_id = $1
          ORDER BY e.created_at DESC
        `, [req.user.id])

        const programming = cr.rows.filter(c => isProgrammingCourse(c))
        if (programming.length > 0) {
          selectedCourse = programming[0]
        }
      }

      let courseInfo = ''
      let detectedLang = 'python'

      if (selectedCourse) {
        courseInfo = `"${selectedCourse.title}" (${selectedCourse.category}, ${selectedCourse.daraja}) - ${(selectedCourse.about || '').substring(0, 100)}`
        detectedLang = detectLanguage(selectedCourse)
      }

      const difficulty = await getUserLevel(req.user.id)
      const problem = await generateProblem(difficulty, detectedLang, courseInfo)

      const insertRes = await pool.query(`
        INSERT INTO daily_challenges (user_id, challenge_date, difficulty, language, problem_title, problem_text, template, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        ON CONFLICT (user_id, challenge_date) DO NOTHING
        RETURNING *
      `, [req.user.id, today, difficulty, detectedLang, problem.title, problem.text, problem.template])

      if (insertRes.rows.length > 0) {
        challenge = insertRes.rows[0]
      } else {
        const reread = await pool.query(
          'SELECT * FROM daily_challenges WHERE user_id = $1 AND challenge_date = $2',
          [req.user.id, today]
        )
        challenge = reread.rows[0]
      }
    } else {
      challenge = challengeRes.rows[0]
    }

    const streakRes = await pool.query('SELECT * FROM user_streaks WHERE user_id = $1', [req.user.id])
    const streak = streakRes.rows[0]

    res.json({
      challenge: {
        id: challenge.id,
        title: challenge.problem_title,
        text: challenge.problem_text,
        template: challenge.template,
        language: challenge.language,
        difficulty: challenge.difficulty,
        status: challenge.status,
        score: challenge.score,
        userCode: challenge.user_code,
        feedback: challenge.feedback
      },
      streak: {
        current: streak.current_streak,
        longest: streak.longest_streak,
        totalCompleted: streak.total_completed,
        totalPoints: streak.total_points
      }
    })
  } catch (err) {
    console.error('Daily today error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/regenerate', auth, async (req, res) => {
  try {
    const { courseId } = req.body
    if (!courseId) return res.status(400).json({ message: 'courseId kerak' })
    const today = getTodayDate()

    const existing = await pool.query(
      'SELECT id, status FROM daily_challenges WHERE user_id = $1 AND challenge_date = $2',
      [req.user.id, today]
    )

    if (existing.rows.length > 0 && existing.rows[0].status === 'completed') {
      return res.status(400).json({ message: 'Bugungi masala allaqachon yechilgan' })
    }

    const cr = await pool.query(`
      SELECT c.title, c.category, c.daraja, c.about
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = $1 AND c.id = $2
    `, [req.user.id, String(courseId)])

    if (cr.rows.length === 0) {
      return res.status(404).json({ message: 'Kurs topilmadi' })
    }

    const course = cr.rows[0]
    if (!isProgrammingCourse(course)) {
      return res.status(400).json({ message: 'Bu dasturlash kursi emas' })
    }

    const courseInfo = `"${course.title}" (${course.category}, ${course.daraja}) - ${(course.about || '').substring(0, 100)}`
    const detectedLang = detectLanguage(course)
    const difficulty = await getUserLevel(req.user.id)
    const problem = await generateProblem(difficulty, detectedLang, courseInfo)

    if (existing.rows.length > 0) {
      const upd = await pool.query(`
        UPDATE daily_challenges
        SET difficulty = $1, language = $2, problem_title = $3, problem_text = $4,
            template = $5, status = 'pending', user_code = NULL, score = NULL,
            feedback = NULL, completed_at = NULL
        WHERE id = $6
        RETURNING *
      `, [difficulty, detectedLang, problem.title, problem.text, problem.template, existing.rows[0].id])
      const challenge = upd.rows[0]
      return res.json({
        challenge: {
          id: challenge.id, title: challenge.problem_title, text: challenge.problem_text,
          template: challenge.template, language: challenge.language,
          difficulty: challenge.difficulty, status: challenge.status, userCode: challenge.user_code
        }
      })
    }

    const insertRes = await pool.query(`
      INSERT INTO daily_challenges (user_id, challenge_date, difficulty, language, problem_title, problem_text, template, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *
    `, [req.user.id, today, difficulty, detectedLang, problem.title, problem.text, problem.template])

    const challenge = insertRes.rows[0]

    res.json({
      challenge: {
        id: challenge.id,
        title: challenge.problem_title,
        text: challenge.problem_text,
        template: challenge.template,
        language: challenge.language,
        difficulty: challenge.difficulty,
        status: challenge.status,
        userCode: challenge.user_code
      }
    })
  } catch (err) {
    console.error('Regenerate error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/submit/:id', auth, async (req, res) => {
  const today = getTodayDate()
  const { code } = req.body
  const challengeId = parseInt(req.params.id, 10)

  if (Number.isNaN(challengeId)) return res.status(400).json({ message: 'id noto\'g\'ri' })
  if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ message: 'Kod bo\'sh' })
  if (code.length > MAX_CODE_LEN) return res.status(400).json({ message: 'Kod juda uzun' })
  if (code.trim().length < 10) return res.status(400).json({ message: 'Kod juda qisqa' })

  // 1-bosqich: challenge'ni 'judging' ga olib qo'yish — bu yana submit qilishni bloklaydi.
  // Server qulamasa, 60 soniyada AI tugaydi. Stuck 'judging' bo'lsa, 60s dan keyin qayta olishga ruxsat beriladi.
  let challenge
  try {
    const claim = await pool.query(
      `UPDATE daily_challenges
       SET status = 'judging', completed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND challenge_date = $3
         AND status != 'completed'
         AND (status != 'judging' OR completed_at < NOW() - INTERVAL '60 seconds')
       RETURNING id, problem_title, problem_text, language`,
      [challengeId, req.user.id, today]
    )
    if (claim.rows.length === 0) {
      const existing = await pool.query(
        'SELECT status FROM daily_challenges WHERE id = $1 AND user_id = $2 AND challenge_date = $3',
        [challengeId, req.user.id, today]
      )
      if (existing.rows.length === 0) return res.status(404).json({ message: 'Topilmadi' })
      if (existing.rows[0].status === 'completed') return res.status(400).json({ message: 'Allaqachon yechgansiz' })
      return res.status(409).json({ message: 'Tahlil hali tugamagan, kuting' })
    }
    challenge = claim.rows[0]
  } catch (err) {
    console.error('Submit claim error:', err)
    return res.status(500).json({ message: 'Xatolik' })
  }

  // 2-bosqich: AI baholash (DB lock ushlanmaydi)
  const aiPrompt = `Kod baholovchi AI. QATTIQ baholang.
MASALA: ${challenge.problem_title}
${challenge.problem_text}

KOD:
\`\`\`${challenge.language}
${code}
\`\`\`

Tekshirish: Kod masala yechadimi? Placeholder bormi?
JAVOB JSON: {"score": 0-100, "feedback": "qisqa o'zbek tahlil"}`

  let score = 0
  let feedback = 'Tahlil bekor qilindi'

  try {
    const groqRes = await groqFetch({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: aiPrompt }],
      temperature: 0.2,
      max_tokens: 300
    })
    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content || ''
    const match = text.match(/\{[\s\S]*?\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      score = Math.min(100, Math.max(0, parseInt(parsed.score) || 0))
      feedback = String(parsed.feedback || 'Tahlil qilindi').slice(0, 1000)
    }
  } catch (err) {
    console.error('AI scoring error:', err)
  }

  const passed = score >= 60

  // 3-bosqich: natijani yozish + streak yangilash (qisqa tranzaksiya)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      UPDATE daily_challenges
      SET user_code = $1, score = $2, feedback = $3, status = $4, completed_at = NOW()
      WHERE id = $5
    `, [code, score, feedback, passed ? 'completed' : 'failed', challenge.id])

    if (!passed) {
      await client.query('COMMIT')
      return res.json({ passed: false, score, feedback, pointsEarned: 0 })
    }

    const streakRes = await client.query(
      'SELECT * FROM user_streaks WHERE user_id = $1 FOR UPDATE',
      [req.user.id]
    )
    const streak = streakRes.rows[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    let newStreak = 1
    if (streak.last_completed_date) {
      const lastDate = new Date(streak.last_completed_date).toISOString().split('T')[0]
      if (lastDate === yesterdayStr) newStreak = streak.current_streak + 1
      else if (lastDate === today) newStreak = streak.current_streak
    }

    const longestStreak = Math.max(newStreak, streak.longest_streak)
    const pointsEarned = 10 + (newStreak * 2)

    await client.query(`
      UPDATE user_streaks
      SET current_streak = $1, longest_streak = $2, last_completed_date = $3,
          total_completed = total_completed + 1, total_points = total_points + $4,
          updated_at = NOW()
      WHERE user_id = $5
    `, [newStreak, longestStreak, today, pointsEarned, req.user.id])

    await client.query('COMMIT')
    res.json({ passed: true, score, feedback, pointsEarned, newStreak, longestStreak })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Submit write error:', err)
    // 'judging' holatidan qaytarish — foydalanuvchi qayta urinishi mumkin
    await pool.query(
      `UPDATE daily_challenges SET status = 'pending' WHERE id = $1 AND status = 'judging'`,
      [challenge.id]
    ).catch(() => {})
    res.status(500).json({ message: 'Xatolik' })
  } finally {
    client.release()
  }
})

router.get('/stats', auth, async (req, res) => {
  try {
    await ensureStreak(req.user.id)
    const result = await pool.query('SELECT * FROM user_streaks WHERE user_id = $1', [req.user.id])
    const stats = result.rows[0]
    res.json({
      currentStreak: stats.current_streak,
      longestStreak: stats.longest_streak,
      totalCompleted: stats.total_completed,
      totalPoints: stats.total_points
    })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

module.exports = router
