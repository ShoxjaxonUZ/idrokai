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

const PROBLEMS = {
  python: [
    { id: 'py-1', title: 'Sonlar yig\'indisi', text: `Berilgan ikki sonni qo'shing va natijani qaytaring.\n\nMisol:\nsum(3, 5) → 8\nsum(10, 20) → 30`, template: `def sum(a, b):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(sum(3, 5))` },
    { id: 'py-2', title: 'Eng katta son', text: `Berilgan ro'yxatdan eng katta sonni toping.\n\nMisol:\nmax_num([1, 5, 3, 9, 2]) → 9`, template: `def max_num(nums):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(max_num([1, 5, 3, 9, 2]))` },
    { id: 'py-3', title: 'Palindrom', text: `So'z palindrom yoki yo'qligini tekshiring.\n\nMisol:\nis_palindrom("madam") → True\nis_palindrom("hello") → False`, template: `def is_palindrom(word):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(is_palindrom("madam"))` },
    { id: 'py-4', title: 'Faktorial', text: `N sonning faktorialini hisoblang.\nN! = 1*2*3*...*N\n\nMisol:\nfactorial(5) → 120`, template: `def factorial(n):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(factorial(5))` },
    { id: 'py-5', title: 'Juft sonlar', text: `1 dan N gacha juft sonlar yig'indisini toping.\n\nMisol:\neven_sum(10) → 30 (2+4+6+8+10)`, template: `def even_sum(n):\n    # Kodingizni shu yerga yozing\n    pass\n\nprint(even_sum(10))` }
  ],
  javascript: [
    { id: 'js-1', title: 'Sonlar yig\'indisi', text: `Ikki sonni qo'shing.\n\nsum(3, 5) → 8`, template: `function sum(a, b) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(sum(3, 5));` },
    { id: 'js-2', title: 'Eng katta son', text: `Massivdan eng katta sonni toping.\n\nmaxNum([1, 5, 3, 9]) → 9`, template: `function maxNum(nums) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(maxNum([1, 5, 3, 9]));` },
    { id: 'js-3', title: 'Massivni teskari', text: `Massivni teskari aylantirib qaytaring.\n\nreverse([1,2,3,4]) → [4,3,2,1]`, template: `function reverse(arr) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(reverse([1,2,3,4]));` },
    { id: 'js-4', title: 'Unli harflar', text: `String dagi unli harflar (a,e,i,o,u) sonini hisoblang.\n\ncountVowels("hello") → 2`, template: `function countVowels(str) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(countVowels("hello"));` },
    { id: 'js-5', title: 'Fibonachchi', text: `Fibonachchi N-elementi.\n1, 1, 2, 3, 5, 8, 13, 21...\n\nfib(8) → 21`, template: `function fib(n) {\n    // Kodingizni shu yerga yozing\n}\n\nconsole.log(fib(8));` }
  ],
  cpp: [
    { id: 'cpp-1', title: 'Sonlar yig\'indisi', text: `Ikki sonni qo'shadigan funksiya.\n\nsum(3, 5) → 8`, template: `#include <iostream>\nusing namespace std;\n\nint sum(int a, int b) {\n    // Kodingizni yozing\n    return 0;\n}\n\nint main() {\n    cout << sum(3, 5) << endl;\n    return 0;\n}` },
    { id: 'cpp-2', title: 'Faktorial', text: `N sonning faktorialini hisoblang.\n\nfactorial(5) → 120`, template: `#include <iostream>\nusing namespace std;\n\nint factorial(int n) {\n    // Kodingizni yozing\n    return 0;\n}\n\nint main() {\n    cout << factorial(5) << endl;\n    return 0;\n}` }
  ],
  java: [
    { id: 'java-1', title: 'Sonlar yig\'indisi', text: `Ikki sonni qo'shing.\n\nsum(3, 5) → 8`, template: `public class Main {\n    public static int sum(int a, int b) {\n        // Kodingizni yozing\n        return 0;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(sum(3, 5));\n    }\n}` }
  ]
}

const SUPPORTED_LANGS = Object.keys(PROBLEMS)

const getRandomProblem = (lang = 'python') => {
  const list = PROBLEMS[lang] || PROBLEMS.python
  return list[Math.floor(Math.random() * list.length)]
}

// AI orqali masala yaratish — agar AI muvaffaqiyatsiz bo'lsa, fallback berila beradi
const generateAIProblem = async (language, mode = 'multiplayer') => {
  const langName = {
    python: 'Python', javascript: 'JavaScript', cpp: 'C++', java: 'Java'
  }[language] || 'Python'

  const difficulty = mode === 'solo' ? 'oson-o\'rta' : 'o\'rta darajada'

  const prompt = `Sen kod battle uchun masala yaratuvchi AI san. ${langName} dasturlash tilida YANGI va QIZIQARLI masala yarat.

DARAJA: ${difficulty} (5 daqiqada yechilishi mumkin)
DASTURLASH TILI: ${langName}

QOIDALAR:
1. Masala bitta funksiyani yozish bilan yechilsin (qisqa va aniq)
2. 2-3 ta input/output misol bilan
3. O'zbek tilida (lotin yozuvi)
4. Funksiya nomini ingliz tilida yoz (kichik harf, snake_case yoki camelCase)
5. Template'da funksiya tananasi BOSH (placeholder) bo'lsin
6. Algoritmik masala bo'lsin (string, array, son, mantiq)

JAVOB FAQAT JSON formatda (boshqa hech narsa yozma):
{
  "title": "Masala nomi (3-5 so'z, o'zbekcha)",
  "text": "Masala matni va misollar (3-6 qator)\\nMisol:\\nfuncName(arg) → result",
  "template": "${langName === 'C++' || langName === 'Java' ? 'Asl kod (asosiy funksiya bilan)' : 'Funksiya shabloni'}"
}`

  try {
    const groqRes = await groqFetch({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 700
    }, 20000)

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null

    const parsed = JSON.parse(match[0])
    const title = String(parsed.title || '').trim().slice(0, 100)
    const probText = String(parsed.text || '').trim().slice(0, 2000)
    const template = String(parsed.template || '').trim().slice(0, 4000)

    if (!title || !probText || !template) return null

    return {
      id: `ai-${language}-${Date.now()}`,
      title,
      text: probText,
      template
    }
  } catch (err) {
    console.error('AI problem gen error:', err.message)
    return null
  }
}

// Yagona kirish — AI urinish, muvaffaqiyatsiz bo'lsa fallback
const getProblemForBattle = async (language, mode = 'multiplayer') => {
  const aiProb = await generateAIProblem(language, mode)
  if (aiProb) return aiProb
  return getRandomProblem(language)
}

const generateId = () => Math.random().toString(36).substring(2, 8).toUpperCase()

const ensureRating = async (userId) => {
  await pool.query(
    'INSERT INTO ratings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  )
}

const evaluateCode = async (code, problem, language) => {
  if (!code?.trim() || code.trim().length < 30) {
    return { score: 0, feedback: 'Kod yozilmagan yoki juda qisqa' }
  }

  if (problem.template && code.trim() === problem.template.trim()) {
    return { score: 0, feedback: 'Asl shablon o\'zgartirilmagan' }
  }

  if (problem.template) {
    const cleanCode = code.replace(/\s+/g, '')
    const cleanTemplate = problem.template.replace(/\s+/g, '')
    const diff = Math.abs(cleanCode.length - cleanTemplate.length)
    if (diff < 10) {
      return { score: 0, feedback: 'Yechim yozilmagan, faqat shablon o\'zgartirilgan' }
    }
  }

  try {
    const prompt = `Sen QATTIQ kod baholovchi AI san. Aldama, faqat haqiqatan ham to'g'ri yechimga yuqori ball ber.

MASALA: ${problem.title}
${problem.text}

DASTURLASH TILI: ${language}

YUBORILGAN KOD:
\`\`\`${language}
${code}
\`\`\`

QATTIQ TEKSHIRUV:
1. Funksiya ichida HAQIQATAN ALGORITM YOZILGANMI? (Agar yo'q — 0 ball)
2. "pass", "return 0", "// kod", "TODO" kabi placeholder lar bormi? (Agar bor — 0 ball)
3. Funksiya tananasi BO'SHMI yoki BIR QATORDAN IBORATMI? (Agar shunday — 0-15 ball)
4. Kod MASALANI HAQIQATAN YECHADIMI? (Test qiling fikran)
5. Sintaktik xatolar bormi?

JAVOB FAQAT JSON formatda:
{"score": 0-100 oraliqdagi son, "feedback": "qisqa o'zbek tahlil"}`

    const groqRes = await groqFetch({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 400
    })

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content || ''
    const match = text.match(/\{[\s\S]*?\}/)

    if (match) {
      const parsed = JSON.parse(match[0])
      let score = Math.min(100, Math.max(0, parseInt(parsed.score) || 0))

      const codeNorm = code.toLowerCase()
      const hasPlaceholder = (
        codeNorm.includes('pass\n') ||
        codeNorm.endsWith('pass') ||
        codeNorm.match(/^\s*return 0;?\s*$/m) ||
        codeNorm.includes('todo') ||
        codeNorm.includes('# kodingizni') ||
        codeNorm.includes('// kodingizni')
      )

      if (hasPlaceholder && score > 20) {
        return { score: 0, feedback: 'Kod yozilmagan — placeholder topildi' }
      }

      return { score, feedback: String(parsed.feedback || 'Tahlil qilindi').slice(0, 1000) }
    }

    return { score: 30, feedback: 'AI tahlil qila olmadi' }
  } catch (err) {
    console.error('AI eval error:', err)
    return { score: 0, feedback: 'AI xatosi' }
  }
}

// Atomic finish: lock battle row first, only finish once.
const finishBattle = async (battleId) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const battleRes = await client.query('SELECT * FROM battles WHERE id = $1 FOR UPDATE', [battleId])
    if (battleRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return
    }
    const battle = battleRes.rows[0]
    if (battle.status === 'finished') {
      await client.query('ROLLBACK')
      return
    }

    const subs = await client.query('SELECT * FROM battle_submissions WHERE battle_id = $1', [battleId])

    if (battle.mode === 'solo') {
      if (subs.rows.length >= 1) {
        const sub = subs.rows[0]
        let pointsChange = 0
        if (sub.score >= 80) pointsChange = 15
        else if (sub.score >= 60) pointsChange = 10
        else if (sub.score >= 40) pointsChange = 5
        else pointsChange = -5

        await client.query(`
          UPDATE ratings
          SET points = GREATEST(0, points + $1),
              wins = wins + CASE WHEN $2 >= 60 THEN 1 ELSE 0 END,
              total_battles = total_battles + 1,
              updated_at = NOW()
          WHERE user_id = $3
        `, [pointsChange, sub.score, sub.user_id])

        await client.query(`
          UPDATE battles SET status = 'finished', finished_at = NOW(), winner_id = $1
          WHERE id = $2
        `, [sub.score >= 60 ? sub.user_id : null, battleId])
      }
      await client.query('COMMIT')
      return
    }

    const players = await client.query('SELECT user_id FROM battle_players WHERE battle_id = $1', [battleId])
    if (subs.rows.length < players.rows.length) {
      await client.query('ROLLBACK')
      return
    }

    const sortedSubs = [...subs.rows].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (a.time_taken || 0) - (b.time_taken || 0)
    })

    const winnerId = sortedSubs[0]?.score > 0 ? sortedSubs[0].user_id : null

    for (const sub of subs.rows) {
      if (sub.user_id === winnerId) {
        await client.query(`
          UPDATE ratings
          SET points = points + 25, wins = wins + 1, total_battles = total_battles + 1, updated_at = NOW()
          WHERE user_id = $1
        `, [sub.user_id])
      } else if (winnerId) {
        await client.query(`
          UPDATE ratings
          SET points = GREATEST(0, points - 15), losses = losses + 1, total_battles = total_battles + 1, updated_at = NOW()
          WHERE user_id = $1
        `, [sub.user_id])
      } else {
        await client.query(`
          UPDATE ratings
          SET draws = draws + 1, total_battles = total_battles + 1, updated_at = NOW()
          WHERE user_id = $1
        `, [sub.user_id])
      }
    }

    await client.query(`
      UPDATE battles SET status = 'finished', finished_at = NOW(), winner_id = $1
      WHERE id = $2
    `, [winnerId, battleId])

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Finish battle error:', err)
  } finally {
    client.release()
  }
}

router.post('/create', auth, async (req, res) => {
  try {
    const { language = 'python', maxPlayers = 2 } = req.body
    if (!SUPPORTED_LANGS.includes(language)) return res.status(400).json({ message: 'Til qo\'llanmaydi' })
    const max = Math.min(10, Math.max(2, parseInt(maxPlayers) || 2))

    await ensureRating(req.user.id)
    const problem = await getProblemForBattle(language, 'multiplayer')
    const battleId = generateId()

    await pool.query(`
      INSERT INTO battles (id, host_id, mode, max_players, problem_id, problem_title, problem_text, language, template, status)
      VALUES ($1, $2, 'multiplayer', $3, $4, $5, $6, $7, $8, 'waiting')
    `, [battleId, req.user.id, max, problem.id, problem.title, problem.text, language, problem.template])

    await pool.query(`
      INSERT INTO battle_players (battle_id, user_id) VALUES ($1, $2)
    `, [battleId, req.user.id])

    res.json({ id: battleId, language, maxPlayers: max, status: 'waiting' })
  } catch (err) {
    console.error('Create error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/join', auth, async (req, res) => {
  const { battleId } = req.body
  if (!battleId || typeof battleId !== 'string') return res.status(400).json({ message: 'ID yo\'q' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query('SELECT * FROM battles WHERE id = $1 FOR UPDATE', [battleId.toUpperCase()])
    if (result.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Xona topilmadi' })
    }

    const battle = result.rows[0]
    if (battle.status !== 'waiting') {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Xona band yoki tugagan' })
    }

    const existing = await client.query(
      'SELECT 1 FROM battle_players WHERE battle_id = $1 AND user_id = $2',
      [battle.id, req.user.id]
    )
    if (existing.rows.length === 0) {
      const players = await client.query('SELECT COUNT(*) FROM battle_players WHERE battle_id = $1', [battle.id])
      if (parseInt(players.rows[0].count) >= battle.max_players) {
        await client.query('ROLLBACK')
        return res.status(400).json({ message: 'Xona to\'la' })
      }

      await client.query(
        'INSERT INTO ratings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
        [req.user.id]
      )
      await client.query('INSERT INTO battle_players (battle_id, user_id) VALUES ($1, $2)', [battle.id, req.user.id])
    }

    await client.query('COMMIT')
    res.json({ id: battle.id, status: battle.status })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Join error:', err)
    res.status(500).json({ message: 'Xatolik' })
  } finally {
    client.release()
  }
})

router.post('/start/:id', auth, async (req, res) => {
  try {
    const battleRes = await pool.query('SELECT * FROM battles WHERE id = $1', [req.params.id])
    if (battleRes.rows.length === 0) return res.status(404).json({ message: 'Topilmadi' })

    const battle = battleRes.rows[0]
    if (battle.host_id !== req.user.id) return res.status(403).json({ message: 'Faqat host boshlay oladi' })
    if (battle.status !== 'waiting') return res.status(400).json({ message: 'Battle holati noto\'g\'ri' })

    const players = await pool.query('SELECT COUNT(*) FROM battle_players WHERE battle_id = $1', [battle.id])
    if (parseInt(players.rows[0].count) < 2) return res.status(400).json({ message: 'Kamida 2 o\'yinchi kerak' })

    await pool.query(`UPDATE battles SET status = 'playing', started_at = NOW() WHERE id = $1`, [battle.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/solo', auth, async (req, res) => {
  try {
    const { language = 'python' } = req.body
    if (!SUPPORTED_LANGS.includes(language)) return res.status(400).json({ message: 'Til qo\'llanmaydi' })

    await ensureRating(req.user.id)
    const problem = await getProblemForBattle(language, 'solo')
    const battleId = 'S' + generateId()

    await pool.query(`
      INSERT INTO battles (id, host_id, mode, max_players, problem_id, problem_title, problem_text, language, template, status, started_at)
      VALUES ($1, $2, 'solo', 1, $3, $4, $5, $6, $7, 'playing', NOW())
    `, [battleId, req.user.id, problem.id, problem.title, problem.text, language, problem.template])

    await pool.query('INSERT INTO battle_players (battle_id, user_id) VALUES ($1, $2)', [battleId, req.user.id])

    res.json({ id: battleId, status: 'playing' })
  } catch (err) {
    console.error('Solo error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/random', auth, async (req, res) => {
  const { language = 'python' } = req.body
  if (!SUPPORTED_LANGS.includes(language)) return res.status(400).json({ message: 'Til qo\'llanmaydi' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'INSERT INTO ratings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [req.user.id]
    )

    const waiting = await client.query(`
      SELECT b.* FROM battles b
      WHERE b.status = 'waiting'
        AND b.mode = 'multiplayer'
        AND b.language = $1
        AND b.host_id != $2
        AND b.created_at > NOW() - INTERVAL '5 minutes'
        AND (SELECT COUNT(*) FROM battle_players WHERE battle_id = b.id) < b.max_players
      ORDER BY b.created_at ASC
      LIMIT 1
      FOR UPDATE OF b SKIP LOCKED
    `, [language, req.user.id])

    if (waiting.rows.length > 0) {
      const battle = waiting.rows[0]
      const exists = await client.query(
        'SELECT 1 FROM battle_players WHERE battle_id = $1 AND user_id = $2',
        [battle.id, req.user.id]
      )
      if (exists.rows.length === 0) {
        await client.query('INSERT INTO battle_players (battle_id, user_id) VALUES ($1, $2)', [battle.id, req.user.id])
      }
      await client.query('COMMIT')
      return res.json({ id: battle.id, status: battle.status })
    }

    const problem = await getProblemForBattle(language, 'multiplayer')
    const battleId = generateId()
    await client.query(`
      INSERT INTO battles (id, host_id, mode, max_players, problem_id, problem_title, problem_text, language, template, status)
      VALUES ($1, $2, 'multiplayer', 2, $3, $4, $5, $6, $7, 'waiting')
    `, [battleId, req.user.id, problem.id, problem.title, problem.text, language, problem.template])

    await client.query('INSERT INTO battle_players (battle_id, user_id) VALUES ($1, $2)', [battleId, req.user.id])
    await client.query('COMMIT')

    res.json({ id: battleId, status: 'waiting' })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Random error:', err)
    res.status(500).json({ message: 'Xatolik' })
  } finally {
    client.release()
  }
})

router.get('/status/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM battles WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: 'Topilmadi' })

    const battle = result.rows[0]
    const players = await pool.query(`
      SELECT bp.user_id, u.name,
        EXISTS(SELECT 1 FROM battle_submissions WHERE battle_id = $1 AND user_id = bp.user_id) as submitted
      FROM battle_players bp
      JOIN users u ON bp.user_id = u.id
      WHERE bp.battle_id = $1
      ORDER BY bp.joined_at ASC
    `, [battle.id])

    let submissions = []
    if (battle.status === 'finished') {
      const subs = await pool.query(`
        SELECT bs.*, u.name as user_name
        FROM battle_submissions bs
        JOIN users u ON bs.user_id = u.id
        WHERE bs.battle_id = $1
        ORDER BY bs.score DESC, bs.time_taken ASC
      `, [battle.id])
      submissions = subs.rows
    }

    res.json({
      id: battle.id,
      host_id: battle.host_id,
      mode: battle.mode,
      max_players: battle.max_players,
      problem_id: battle.problem_id,
      problem_title: battle.problem_title,
      problem: battle.problem_text,
      template: battle.template,
      language: battle.language,
      status: battle.status,
      winner_id: battle.winner_id,
      players: players.rows,
      submissions
    })
  } catch (err) {
    console.error('Status error:', err)
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.post('/submit/:id', auth, async (req, res) => {
  const { code, time_taken } = req.body
  const battleId = req.params.id

  if (typeof code !== 'string') return res.status(400).json({ message: 'Kod kerak' })
  if (code.length > MAX_CODE_LEN) return res.status(400).json({ message: 'Kod juda uzun' })
  const timeTaken = Math.max(0, Math.min(86400, parseInt(time_taken, 10) || 0))

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const battleRes = await client.query('SELECT * FROM battles WHERE id = $1 FOR UPDATE', [battleId])
    if (battleRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Topilmadi' })
    }
    const battle = battleRes.rows[0]
    if (battle.status === 'finished') {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Battle tugagan' })
    }

    const playerCheck = await client.query(
      'SELECT 1 FROM battle_players WHERE battle_id = $1 AND user_id = $2',
      [battleId, req.user.id]
    )
    if (playerCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(403).json({ message: 'Siz ishtirokchi emassiz' })
    }

    const existing = await client.query(
      'SELECT 1 FROM battle_submissions WHERE battle_id = $1 AND user_id = $2',
      [battleId, req.user.id]
    )
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Allaqachon yuborgansiz' })
    }

    const { score, feedback } = await evaluateCode(
      code,
      { title: battle.problem_title, text: battle.problem_text, template: battle.template },
      battle.language
    )

    await client.query(`
      INSERT INTO battle_submissions (battle_id, user_id, code, language, score, time_taken, feedback)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [battleId, req.user.id, code, battle.language, score, timeTaken, feedback])

    await client.query('COMMIT')

    await finishBattle(battleId)
    res.json({ score, feedback })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Submit error:', err)
    res.status(500).json({ message: 'Xatolik' })
  } finally {
    client.release()
  }
})

router.post('/cancel/:id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM battles WHERE id = $1 AND host_id = $2 AND status = $3',
      [req.params.id, req.user.id, 'waiting']
    )
    if (r.rowCount === 0) return res.status(404).json({ message: 'Topilmadi yoki ruxsat yo\'q' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

router.get('/leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, r.points, r.wins, r.losses, r.draws, r.total_battles
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE u.role != 'admin'
      ORDER BY r.points DESC
      LIMIT 20
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ message: 'Xatolik' })
  }
})

module.exports = router
