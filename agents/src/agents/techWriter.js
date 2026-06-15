const { BaseAgent } = require('./baseAgent')

class TechWriterAgent extends BaseAgent {
  constructor() {
    super({
      key: 'techwriter', name: 'Tech Writer Agent', role: 'Hujjatlarni yozadi', icon: '📝',
      systemPrompt: "Sen texnik yozuvchisan. Bajarilgan ishni qisqa, tushunarli yakuniy hisobot qilib yoz (o'zbek tilida, markdown): nima qilindi, qanday, qanday sinaladi, keyingi qadam."
    })
  }
  buildPrompt(ctx) {
    return `Vazifa: ${ctx.task}\n\nNatijalar (JSON):\n${JSON.stringify(ctx.artifacts, null, 2).slice(0, 6000)}\n\nShu asosda yakuniy hisobot yoz.`
  }
  parse(text) { return { report: text } }
  mock(ctx) {
    const a = ctx.artifacts || {}
    const lines = []
    lines.push(`## "${ctx.task}" — yakuniy hisobot\n`)
    if (a.architect) lines.push(`**Arxitektura:** ${String(a.architect.decisions).split('\n')[0]}`)
    if (a.planner) lines.push(`**Reja:** ${(a.planner.steps || []).length} qadam.`)
    if (a.developer) {
      const scan = a.developer.scan || []
      lines.push(`**Kod:** tayyor (Developer Agent), skaner: ${scan.length ? scan.map(f => f.message).join(', ') : 'toza'}.`)
    }
    if (a.fix) lines.push("**Tuzatish:** reviewer izohi bo'yicha rate-limit qo'shildi.")
    if (a.qa) lines.push(`**QA:** ${(a.qa.tests || []).length} ta test holati taklif qilindi.`)
    if (a.sre) lines.push("**SRE:** deploy checklist tayyor.")
    lines.push("\n**Keyingi qadam:** kodni loyihaga ko'chirib, testlarni ishga tushiring va PR oching.")
    return { report: lines.join('\n') }
  }
}

module.exports = { TechWriterAgent }
