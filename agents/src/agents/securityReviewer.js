const { BaseAgent } = require('./baseAgent')
const { extractAndParseJson } = require('../llm/jsonParse')

class SecurityReviewerAgent extends BaseAgent {
  constructor() {
    super({
      key: 'security', name: 'Security Reviewer Agent', role: 'Xavfsizlikni tekshiradi', icon: '🛡️', json: true,
      systemPrompt: "Sen xavfsizlik auditorisan. Kodni OWASP nuqtai nazaridan tekshir: injection, auth/brute-force, maxfiy kalitlar, ruxsatlar. FAQAT JSON qaytar: {\"verdict\":\"pass\"|\"block\",\"findings\":[{\"severity\":\"low|medium|high|critical\",\"message\":\"...\"}]}"
    })
  }
  buildPrompt(ctx) {
    const code = ctx.artifacts && ctx.artifacts.developer && ctx.artifacts.developer.code || '-'
    return `Vazifa: ${ctx.task}\nKod:\n${code}\n\nXavfsizlik auditini JSON qaytar.`
  }
  parse(text) {
    const j = extractAndParseJson(text) || {}
    return { verdict: j.verdict === 'block' ? 'block' : 'pass', findings: Array.isArray(j.findings) ? j.findings : [] }
  }
  mock(ctx) {
    const scan = (ctx.artifacts && ctx.artifacts.developer && ctx.artifacts.developer.scan) || []
    const critical = scan.filter(f => f.severity === 'critical' || f.severity === 'high')
    const authTask = /login|auth|parol|password|token|brute/i.test(ctx.task)
    // Birinchi iteratsiyada auth vazifasi bloklanadi → fix loop'ni namoyish etadi
    if (critical.length || (authTask && (ctx.iterations || 0) === 0)) {
      const findings = critical.length
        ? critical.map(f => ({ severity: f.severity, message: f.message }))
        : [{ severity: 'high', message: "Brute-force himoyasi yetarli emas: urinishlar cheklanishi va 429 qaytishi kerak." }]
      return { verdict: 'block', findings }
    }
    return { verdict: 'pass', findings: [{ severity: 'low', message: "Jiddiy xavfsizlik muammosi topilmadi." }] }
  }
}

module.exports = { SecurityReviewerAgent }
