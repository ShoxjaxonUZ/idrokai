// Markaziy konfiguratsiya. Tashqi paketsiz minimal .env yuklovchi bilan.
// GROQ_API_KEY bo'lmasa — dryRun (mock) rejim avtomatik yoqiladi.

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

const config = {
  root: ROOT,
  model: process.env.AGENT_MODEL || 'llama-3.3-70b-versatile',
  apiKey: process.env.GROQ_API_KEY || '',
  // Kalit bo'lmasa mock rejim. index.js buni --live/--dry flag bilan bekor qila oladi.
  dryRun: !process.env.GROQ_API_KEY,
  temperature: Number(process.env.AGENT_TEMPERATURE || 0.4),
  maxTokens: Number(process.env.AGENT_MAX_TOKENS || 2000),
  maxFixIterations: Number(process.env.AGENT_MAX_FIX_ITER || 1),
  workspaceDir: path.join(ROOT, 'workspace'),
  runsDir: path.join(ROOT, '.runs')
}

module.exports = { config }
