// So'rovni qabul qilish — NLP / Intent aniqlash.
// LIVE: tezkor LLM tasnifi. DRY: kalit-so'z evristikasi.

const { config } = require('../config')
const { chat } = require('../llm/client')
const { extractAndParseJson } = require('../llm/jsonParse')

function guessAreas(task) {
  const t = task.toLowerCase()
  const a = []
  if (/backend|api|route|server|express/.test(t)) a.push('backend')
  if (/frontend|ui|react|sahifa|page|dizayn/.test(t)) a.push('frontend')
  if (/db|database|jadval|migration|postgres|sql/.test(t)) a.push('db')
  return a.length ? a : ['backend']
}

function heuristicIntent(task) {
  const t = task.toLowerCase()
  if (/xavfsizlik|security|injection|xss|csrf|brute|himoya/.test(t)) return 'security'
  if (/tuzat|fix|bug|xato|ishlamayapti|buzilgan/.test(t)) return 'bugfix'
  if (/hujjat|docs|readme|izoh/.test(t)) return 'docs'
  if (/\?|nima|qanday|nega|qachon|tushuntir/.test(t) && !/qo'sh|yoz|tuzat|yarat|qil/.test(t)) return 'question'
  return 'feature'
}

async function intake(task) {
  if (config.dryRun) {
    return { intent: heuristicIntent(task), complexity: task.length > 80 ? 'high' : 'medium', areas: guessAreas(task), summary: task.slice(0, 120) }
  }
  try {
    const { text } = await chat({
      system: "So'rovni tasnifla. FAQAT JSON: {\"intent\":\"feature|bugfix|security|docs|question\",\"complexity\":\"low|medium|high\",\"areas\":[\"backend|frontend|db\"],\"summary\":\"...\"}",
      user: task,
      model: config.agentModels.intake,
      json: true
    })
    const j = extractAndParseJson(text) || {}
    return {
      intent: ['feature', 'bugfix', 'security', 'docs', 'question'].includes(j.intent) ? j.intent : heuristicIntent(task),
      complexity: j.complexity || 'medium',
      areas: Array.isArray(j.areas) ? j.areas : guessAreas(task),
      summary: j.summary || task.slice(0, 120)
    }
  } catch {
    return { intent: heuristicIntent(task), complexity: 'medium', areas: guessAreas(task), summary: task.slice(0, 120) }
  }
}

module.exports = { intake }
