const { BaseAgent } = require('./baseAgent')
const { scanCode } = require('../tools')

class DeveloperAgent extends BaseAgent {
  constructor() {
    super({
      key: 'developer', name: 'Developer Agent', role: 'Kodlarni yozadi', icon: '⌨️',
      systemPrompt: "Sen tajribali full-stack dasturchisisan (Node.js/Express, React, PostgreSQL). Rejaga amal qilib toza, xavfsiz kod yoz. Kodni kod bloklari ichida ber, qisqa izoh bilan. Maxfiy kalitlarni hech qachon kod ichiga yozma. Javob o'zbek tilida."
    })
  }
  buildPrompt(ctx) {
    const steps = ((ctx.artifacts && ctx.artifacts.planner && ctx.artifacts.planner.steps) || []).map((s, i) => `${i + 1}. ${s}`).join('\n')
    return `Vazifa: ${ctx.task}\nReja:\n${steps}\n\nShu rejaga ko'ra kodni yoz.`
  }
  parse(text) { return { code: text, scan: scanCode(text) } }
  mock() {
    const code = [
      '```js',
      '// middleware/rateLimit.js — sodda xotira asosidagi rate-limiter',
      'const hits = new Map()',
      'function rateLimit({ windowMs = 60000, max = 5 } = {}) {',
      '  return (req, res, next) => {',
      '    const key = req.ip + ":" + req.path',
      '    const now = Date.now()',
      '    const rec = hits.get(key) || { count: 0, reset: now + windowMs }',
      '    if (now > rec.reset) { rec.count = 0; rec.reset = now + windowMs }',
      '    rec.count++; hits.set(key, rec)',
      '    if (rec.count > max) return res.status(429).json({ error: "Juda ko\'p urinish" })',
      '    next()',
      '  }',
      '}',
      'module.exports = { rateLimit }',
      '```'
    ].join('\n')
    return { code, scan: scanCode(code) }
  }
}

module.exports = { DeveloperAgent }
