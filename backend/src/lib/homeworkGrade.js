// Uyga vazifa javobini AI (Groq) orqali baholash.
// battle.js dagi evaluateCode naqshiga o'xshash: qattiq prompt → {score, feedback}.
// Vazifa erkin (matn yoki kod) bo'lishi mumkin — shuning uchun universal baholovchi.

const { groqFetch } = require('./groq')
const { extractAndParseJson } = require('./jsonParse')

// Javob juda qisqa bo'lsa AI'ga bormaymiz (token tejash + aniq 0)
const MIN_ANSWER_LEN = 15

/**
 * @param {Object} p
 * @param {string} p.courseTitle  Kurs nomi (kontekst)
 * @param {string} p.lessonTitle  Dars nomi (kontekst)
 * @param {string} p.task         O'qituvchi bergan vazifa matni
 * @param {string} p.answer       Talaba javobi
 * @returns {Promise<{score:number, feedback:string}>}
 */
async function gradeHomework({ courseTitle, lessonTitle, task, answer }) {
  const ans = (answer || '').trim()
  if (ans.length < MIN_ANSWER_LEN) {
    return { score: 0, feedback: 'Javob juda qisqa yoki bo\'sh. Vazifani to\'liq bajaring.' }
  }

  const prompt = `Sen ADOLATLI, lekin QATTIQ uy vazifasi baholovchi o'qituvchi AI san.
Faqat haqiqatan ham vazifani bajargan javobga yuqori ball ber. Aldama.

KURS: ${courseTitle || '—'}
DARS: ${lessonTitle || '—'}

VAZIFA (o'qituvchi bergan):
${task || '—'}

TALABA JAVOBI:
"""
${ans.slice(0, 4000)}
"""

BAHOLASH MEZONLARI:
1. Javob VAZIFAGA mosmi yoki mavzudan chetdami? (Chetda — past ball)
2. "bilmadim", "...", "test", bir-ikki so'z yoki placeholder bormi? (Agar shunday — 0-15 ball)
3. Javob to'liq va tushunarli yoritilganmi? Misol/dalil bormi?
4. Agar kod bo'lsa: ishlaydimi, vazifani yechadimi, sintaksis to'g'rimi?
5. Mantiqiy xatolar bormi?

Feedback'da: nima yaxshi, nimani yaxshilash kerakligini 1-3 jumlada o'zbek tilida yoz. Rag'batlantiruvchi ohangda.

JAVOB FAQAT JSON formatda, boshqa matnsiz:
{"score": 0-100 oraliqdagi son, "feedback": "qisqa o'zbekcha izoh"}`

  try {
    const groqRes = await groqFetch({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 400
    })

    if (!groqRes.ok) {
      console.error('[homeworkGrade] groq status:', groqRes.status)
      return { score: null, feedback: 'AI baholovchi hozir band — birozdan keyin qayta urinib ko\'ring.' }
    }

    const data = await groqRes.json()
    const text = data.choices?.[0]?.message?.content || ''
    const parsed = extractAndParseJson(text)

    if (!parsed || typeof parsed.score === 'undefined') {
      return { score: null, feedback: 'Baholashda xatolik — qayta urinib ko\'ring.' }
    }

    const score = Math.min(100, Math.max(0, parseInt(parsed.score) || 0))
    const feedback = String(parsed.feedback || '').slice(0, 600) || 'Izoh yo\'q.'
    return { score, feedback }
  } catch (err) {
    console.error('[homeworkGrade] error:', err.message)
    return { score: null, feedback: 'AI bilan bog\'lanib bo\'lmadi — qayta urinib ko\'ring.' }
  }
}

module.exports = { gradeHomework }
