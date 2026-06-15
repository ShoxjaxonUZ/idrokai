// Markaziy konfiguratsiya. Tashqi paketsiz minimal .env yuklovchi bilan.
// Provayder: anthropic (default, Claude) yoki groq. Kalit bo'lmasa — DRY (mock) rejim.
// HAR AGENT o'z modeliga ega: AGENT_MODEL_<KEY> bilan alohida belgilanadi.

const fs = require('fs')
const path = require('path')

// ── Minimal .env yuklovchi (dotenv paketisiz) ────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return
  try {
    const text = fs.readFileSync(envPath, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m || line.trim().startsWith('#')) continue
      const key = m[1]
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = val
    }
  } catch { /* .env buzilgan bo'lsa — e'tiborsiz qoldiramiz */ }
}
loadEnv()

const ROOT = path.join(__dirname, '..')

const provider = (process.env.AGENT_PROVIDER || 'anthropic').toLowerCase()
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || ''
const groqApiKey = process.env.GROQ_API_KEY || ''
const activeKey = provider === 'groq' ? groqApiKey : anthropicApiKey

// Default model (provayderga qarab). Skill: Claude default — claude-opus-4-8.
const defaultModel = process.env.AGENT_MODEL ||
  (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'claude-opus-4-8')

// Har agent o'z modeli — AGENT_MODEL_<KEY> bilan alohida, aks holda defaultModel.
const AGENT_KEYS = ['intake', 'orchestrator', 'architect', 'planner', 'developer',
  'security', 'qa', 'sre', 'fix', 'techwriter']
const agentModels = {}
for (const k of AGENT_KEYS) {
  agentModels[k] = process.env['AGENT_MODEL_' + k.toUpperCase()] || defaultModel
}

const config = {
  root: ROOT,
  provider,
  anthropicApiKey,
  groqApiKey,
  defaultModel,
  agentModels,
  effort: process.env.AGENT_EFFORT || 'high',   // low | medium | high | max (Opus/Sonnet)
  // Groq orqaga-moslik uchun (llm/groq.js shularni o'qiydi):
  model: defaultModel,
  apiKey: groqApiKey,
  temperature: Number(process.env.AGENT_TEMPERATURE || 0.4),
  maxTokens: Number(process.env.AGENT_MAX_TOKENS || 8192),
  maxFixIterations: Number(process.env.AGENT_MAX_FIX_ITER || 1),
  // Faol provayder kaliti bo'lmasa — mock rejim. index.js --live/--dry bilan bekor qiladi.
  dryRun: !activeKey,
  workspaceDir: path.join(ROOT, 'workspace'),
  runsDir: path.join(ROOT, '.runs')
}

module.exports = { config }
