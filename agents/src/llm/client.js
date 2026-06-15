// Yagona LLM interfeysi — provayderga (anthropic|groq) qarab yo'naltiradi.
// Chaqiruvchilar (baseAgent, intake, orchestratorAgent) faqat shu chat()'ni ishlatadi.
// Provayder modullari LAZY require qilinadi — DRY rejimda bu yerga umuman kelinmaydi.

const { config } = require('../config')

// { system, user, model, json, maxTokens, effort } -> { text, usage }
async function chat({ system, user, model, json = false, maxTokens, effort }) {
  if (config.provider === 'groq') {
    const { groqChat } = require('./groq')
    const messages = []
    if (system) messages.push({ role: 'system', content: system })
    messages.push({ role: 'user', content: user })
    return groqChat(messages, { model, json, maxTokens })
  }
  // default: anthropic (Claude) — json Anthropic'da prompt + chidamli parser orqali
  const { anthropicChat } = require('./anthropic')
  return anthropicChat({ system, user, model, maxTokens, effort })
}

module.exports = { chat }
