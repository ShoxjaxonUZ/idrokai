// BaseAgent — barcha agentlar uchun umumiy yadro.
// LIVE rejim: Groq chaqiruvi (system + user prompt). DRY rejim: mock() natijasi.
// Har agent buildPrompt(), parse() va mock() ni o'zicha aniqlaydi.

const { groqChat } = require('../llm/groq')
const { config } = require('../config')

class BaseAgent {
  constructor({ key, name, role, icon, systemPrompt, json = false }) {
    this.key = key
    this.name = name
    this.role = role
    this.icon = icon
    this.systemPrompt = systemPrompt
    this.json = json
  }

  buildPrompt(context) { return String(context.task || '') }
  parse(text) { return { text } }
  mock(context) { return { text: `[mock] ${this.name}` } }

  async run(context, { logger }) {
    const t0 = Date.now()
    logger.info(this.key, `${this.icon} ${this.name} — ${this.role}…`)
    let result
    if (config.dryRun) {
      result = this.mock(context)
      result._mock = true
    } else {
      try {
        const { text, usage } = await groqChat([
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: this.buildPrompt(context) }
        ], { json: this.json })
        result = this.parse(text, context) || { text }
        if (usage && usage.total_tokens) logger.metric('tokens', usage.total_tokens)
      } catch (err) {
        logger.alert(this.key, `Groq xatosi: ${err.message}`)
        result = { text: `(xato) ${err.message}`, error: true }
      }
    }
    logger.metric('agentRuns', 1)
    logger.trace('agent', { key: this.key, ms: Date.now() - t0 })
    return result
  }
}

module.exports = { BaseAgent }
