const { BaseAgent } = require('./baseAgent')

class FixDeveloperAgent extends BaseAgent {
  constructor() {
    super({
      key: 'fix', name: 'Fix Developer Agent', role: 'Muammolarni tuzatadi', icon: '🔧',
      systemPrompt: "Sen muammolarni tuzatuvchi dasturchisan. Reviewer'lar topgan kamchiliklarni aniq tuzat. Faqat kerakli o'zgarishni ko'rsat, ortiqcha qayta yozma. O'zbek tilida."
    })
  }
  buildPrompt(ctx) {
    const code = ctx.artifacts && ctx.artifacts.developer && ctx.artifacts.developer.code || '-'
    const blockers = (ctx.blockers || []).map(b => `- [${b.agent}] ${b.message}`).join('\n')
    return `Vazifa: ${ctx.task}\nMavjud kod:\n${code}\n\nTuzatish kerak bo'lgan muammolar:\n${blockers}\n\nTuzatilgan kod va izohni ber.`
  }
  parse(text) { return { fix: text } }
  mock(ctx) {
    const blockers = (ctx.blockers || []).map(b => b.message).join('; ')
    return { fix: `Muammo(lar) bartaraf etildi: ${blockers || '—'}.\n\`\`\`js\n// login route'ga rate-limit ulandi (5 urinish / 1 daqiqa, IP bo'yicha)\nrouter.post('/login', rateLimit({ windowMs: 60000, max: 5 }), loginHandler)\n\`\`\`` }
  }
}

module.exports = { FixDeveloperAgent }
