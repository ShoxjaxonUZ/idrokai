// BaseAgent — barcha agentlar uchun umumiy yadro.
// LIVE rejim: Groq chaqiruvi (system + user prompt). DRY rejim: mock() natijasi.
// Har agent buildPrompt(), parse() va mock() ni o'zicha aniqlaydi.

const { chat } = require('../llm/client')
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
    const model = config.agentModels[this.key] || config.defaultModel
    logger.info(this.key, `${this.icon} ${this.name} — ${this.role} [${model}]…`)
    let result
    if (config.dryRun) {
      result = this.mock(context)
      result._mock = true
    } else {
      try {
        const { text, usage } = await chat({
          system: this.systemPrompt,
          user: this.buildPrompt(context),
          model,
          json: this.json
        })
        result = this.parse(text, context) || { text }
        if (usage && usage.total_tokens) logger.metric('tokens', usage.total_tokens)
      } catch (err) {
        logger.alert(this.key, `LLM xatosi: ${err.message}`)
        result = { text: `(xato) ${err.message}`, error: true }
      }
    }
    result._model = model
    logger.metric('agentRuns', 1)
    logger.trace('agent', { key: this.key, model, ms: Date.now() - t0 })
    return result
  }
}

module.exports = { BaseAgent }
