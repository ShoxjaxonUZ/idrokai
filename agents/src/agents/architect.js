const { BaseAgent } = require('./baseAgent')

class ArchitectAgent extends BaseAgent {
  constructor() {
    super({
      key: 'architect', name: 'Architect Agent', role: 'Arxitektura qarorlarini yozadi', icon: '🏛️',
      systemPrompt: "Sen tajribali dasturiy ta'minot arxitektorisan. Vazifa uchun eng sodda, mavjud stack'ka mos yechimni taklif qil. Texnologiya tanlovi, modul tuzilmasi va asosiy trade-off'larni qisqa bandlarda yoz. Ortiqcha murakkablashtirma (YAGNI). Javob o'zbek tilida."
    })
  }
  buildPrompt(ctx) {
    return `Vazifa: ${ctx.task}\nTahlil: ${ctx.analysis && ctx.analysis.understanding || '-'}\n\nArxitektura qarorini ber: 1) texnologiyalar 2) modul/fayl tuzilmasi 3) asosiy qarorlar va trade-off'lar.`
  }
  parse(text) { return { decisions: text } }
  mock(ctx) {
    const subj = (ctx.intake && ctx.intake.summary) || ctx.task
    return { decisions: `Mavjud stack saqlanadi (Node/Express + Postgres). "${subj}" uchun: yangi mantiq alohida modulga (lib/ yoki middleware/) ajratiladi — route ozg'in qoladi; holat DB'da (migration bilan); konfiguratsiya .env'da. Trade-off: tashqi paket o'rniga ichki yechim — kamroq bog'liqlik, biroz ko'proq kod.` }
  }
}

module.exports = { ArchitectAgent }
