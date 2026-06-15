const { BaseAgent } = require('./baseAgent')
const { extractAndParseJson } = require('../llm/jsonParse')
const { gitStatus } = require('../tools')

class SREReviewerAgent extends BaseAgent {
  constructor() {
    super({
      key: 'sre', name: 'SRE Reviewer Agent', role: 'Deploy tayyorligini tekshiradi', icon: '🚀', json: true,
      systemPrompt: "Sen SRE/DevOps muhandisisan. O'zgarish deploy uchun tayyormi: env, migration, monitoring, rollback. FAQAT JSON: {\"verdict\":\"pass\"|\"block\",\"checklist\":[\"...\"],\"findings\":[]}"
    })
  }
  buildPrompt(ctx) {
    const arch = ctx.artifacts && ctx.artifacts.architect && ctx.artifacts.architect.decisions || '-'
    return `Vazifa: ${ctx.task}\nArxitektura: ${arch}\n\nDeploy tayyorligini JSON qaytar.`
  }
  parse(text) {
    const j = extractAndParseJson(text) || {}
    return { verdict: j.verdict === 'block' ? 'block' : 'pass', checklist: j.checklist || [], findings: j.findings || [] }
  }
  mock() {
    return { verdict: 'pass', checklist: [
      "Yangi env o'zgaruvchilari .env.example'ga qo'shilgan.",
      "Migration startup'da avtomatik ishlaydi.",
      "Xato holatida to'g'ri status (429/5xx) qaytadi — monitoring uchun."
    ], gitDirty: !!gitStatus(), findings: [] }
  }
}

module.exports = { SREReviewerAgent }
