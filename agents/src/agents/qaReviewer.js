const { BaseAgent } = require('./baseAgent')
const { extractAndParseJson } = require('../llm/jsonParse')

class QAReviewerAgent extends BaseAgent {
  constructor() {
    super({
      key: 'qa', name: 'QA Reviewer Agent', role: 'Testlarni tekshiradi', icon: '🔍', json: true,
      systemPrompt: "Sen QA muhandisisan. Kod uchun test rejasi tuz va sifatni bahola. FAQAT JSON: {\"verdict\":\"pass\"|\"block\",\"tests\":[\"...\"],\"findings\":[{\"severity\":\"...\",\"message\":\"...\"}]}"
    })
  }
  buildPrompt(ctx) {
    const code = ctx.artifacts && ctx.artifacts.developer && ctx.artifacts.developer.code || '-'
    return `Vazifa: ${ctx.task}\nKod:\n${code}\n\nTest rejasi va sifat bahosini JSON qaytar.`
  }
  parse(text) {
    const j = extractAndParseJson(text) || {}
    return { verdict: j.verdict === 'block' ? 'block' : 'pass', tests: j.tests || [], findings: j.findings || [] }
  }
  mock() {
    return { verdict: 'pass', tests: [
      "Limit ichida (max gacha) — 200 qaytadi.",
      "Limitdan oshganda — 429 qaytadi.",
      "Oyna (window) tugagach hisob nollanadi."
    ], findings: [] }
  }
}

module.exports = { QAReviewerAgent }
