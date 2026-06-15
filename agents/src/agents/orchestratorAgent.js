// Orchestrator Agent — jarayonni boshqaruvchi "miya".
// 1-bosqich (Vazifa tahlili) va 2-bosqich (Rejalashtirish) shu yerda.

const { config } = require('../config')
const { groqChat } = require('../llm/groq')
const { extractAndParseJson } = require('../llm/jsonParse')

// Qaysi intent qaysi agentlar zanjirini talab qiladi
const WORKFLOWS = {
  question: ['techwriter'],
  docs: ['techwriter'],
  security: ['developer', 'security', 'qa', 'techwriter'],
  bugfix: ['planner', 'developer', 'qa', 'techwriter'],
  feature: ['architect', 'planner', 'developer', 'security', 'qa', 'sre', 'techwriter']
}

// 1-bosqich: vazifani tushunish va kichik vazifalarga bo'lish
async function analyze(ctx) {
  if (config.dryRun) {
    return {
      understanding: `Foydalanuvchi "${ctx.task}" vazifasini bajarishni so'rayapti (${ctx.intake.intent}).`,
      subtasks: ['Tahlil', 'Yechim arxitekturasi', 'Amalga oshirish', 'Tekshiruv', 'Hujjatlash']
    }
  }
  try {
    const { text } = await groqChat([
      { role: 'system', content: "Sen bosh muhandissan. Vazifani tahlil qil va kichik vazifalarga bo'l. FAQAT JSON: {\"understanding\":\"...\",\"subtasks\":[\"...\"]}" },
      { role: 'user', content: ctx.task }
    ], { json: true })
    const j = extractAndParseJson(text) || {}
    return { understanding: j.understanding || ctx.task, subtasks: Array.isArray(j.subtasks) ? j.subtasks : [] }
  } catch {
    return { understanding: ctx.task, subtasks: [] }
  }
}

// 2-bosqich: intent bo'yicha agentlar zanjirini tanlash
function planWorkflow(ctx) {
  const intent = ctx.intake.intent
  const agents = WORKFLOWS[intent] || WORKFLOWS.feature
  return { agents, rationale: `Intent "${intent}" → ${agents.length} agent: ${agents.join(' → ')}.` }
}

module.exports = { analyze, planWorkflow, WORKFLOWS }
