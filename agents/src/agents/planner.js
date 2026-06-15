const { BaseAgent } = require('./baseAgent')

class PlannerAgent extends BaseAgent {
  constructor() {
    super({
      key: 'planner', name: 'Planner Agent', role: 'Reja tuzadi', icon: '📋',
      systemPrompt: "Sen texnik loyiha rejalashtiruvchisisan. Arxitektura asosida konkret, bajariladigan qadamlar ro'yxatini tuz. Har bir qadam — bitta aniq ish. Tartib muhim. Javob o'zbek tilida, raqamlangan ro'yxat."
    })
  }
  buildPrompt(ctx) {
    const arch = ctx.artifacts && ctx.artifacts.architect && ctx.artifacts.architect.decisions || '-'
    return `Vazifa: ${ctx.task}\nArxitektura: ${arch}\n\nAmalga oshirish qadamlarini raqamlangan ro'yxat qilib ber.`
  }
  parse(text) {
    const steps = text.split(/\n+/).filter(l => /^\s*\d+[.)]/.test(l)).map(l => l.replace(/^\s*\d+[.)]\s*/, ''))
    return { steps: steps.length ? steps : [text], raw: text }
  }
  mock() {
    return { steps: [
      "Migration yozish (kerak bo'lsa) — yangi jadval/ustun.",
      "lib/ ichida yadro mantiqni yozish (sof funksiyalar).",
      "Route/middleware'ga ulash.",
      "Frontend'da kerakli UI/holatni qo'shish.",
      "Testlar va hujjatlarni yangilash."
    ], raw: '' }
  }
}

module.exports = { PlannerAgent }
