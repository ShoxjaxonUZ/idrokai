// Test savollarini AI (Groq) orqali generatsiya qilish — umumiy yadro.
// Avval ai.js (/generate-quiz) va moduleTest.js (/generate) da takrorlangan edi:
// Groq chaqiruvi + JSON parse + savol validatsiyasi. Endi bitta joyda.

const { groqFetch } = require('./groq')
const { extractAndParseJson } = require('./jsonParse')

const TEXT_MODEL = 'llama-3.3-70b-versatile'

// Bitta savol to'g'ri tuzilganmi: matn + 4 ta variant + 0-3 oralig'ida correct
const validQuestion = (q) => !!(
  q && typeof q.question === 'string' &&
  Array.isArray(q.options) && q.options.length === 4 &&
  Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3
)

// Promptdan savollar generatsiya qiladi.
// Muvaffaqiyat: { questions: [...] } (validatsiyadan o'tganlari)
// Xato:        { error: { status, message } } — route shuni res bilan qaytaradi
async function generateQuestions(prompt, { maxTokens = 4000, temperature = 0.7 } = {}) {
  let res
  try {
    res = await groqFetch({
      model: TEXT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature
    })
  } catch {
    return { error: { status: 504, message: 'AI javob bermadi' } }
  }

  const data = await res.json()
  if (!res.ok) {
    console.error('Groq xatosi:', data)
    return { error: { status: 502, message: 'AI xizmatida xatolik' } }
  }

  const text = data.choices?.[0]?.message?.content
  if (typeof text !== 'string') {
    console.error('Groq javobida content yo\'q:', data)
    return { error: { status: 502, message: 'AI noto\'g\'ri javob qaytardi' } }
  }

  const parsed = extractAndParseJson(text)
  if (!parsed) {
    return { error: { status: 500, message: 'AI noto\'g\'ri JSON qaytardi' } }
  }

  const all = Array.isArray(parsed.questions) ? parsed.questions : []
  return { questions: all.filter(validQuestion) }
}

module.exports = { generateQuestions, validQuestion, TEXT_MODEL }
