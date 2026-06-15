// Vositalar & Integratsiyalar — fayl tizimi (sandbox), Git (faqat o'qish), kod skaneri.
// Fayl operatsiyalari policy orqali agents/workspace ichida cheklangan.

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { config } = require('../config')
const { policy } = require('../policy/policy')

function ensureWorkspace() { fs.mkdirSync(config.workspaceDir, { recursive: true }) }

function writeFile(rel, content) {
  const chk = policy.checkAction({ type: 'write', path: rel }, config)
  if (!chk.allowed) throw new Error(`policy: ${chk.reason}`)
  ensureWorkspace()
  const abs = path.resolve(config.workspaceDir, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
  return abs
}

function readFile(rel) {
  const chk = policy.checkAction({ type: 'read', path: rel }, config)
  if (!chk.allowed) throw new Error(`policy: ${chk.reason}`)
  const abs = path.resolve(config.workspaceDir, rel)
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null
}

// Git holati (faqat o'qish — status/short)
function gitStatus() {
  try {
    return execFileSync('git', ['status', '--short'], { cwd: config.root, encoding: 'utf8' }).trim()
  } catch { return '' }
}

// Kod skaneri — oddiy xavfsizlik/sifat tekshiruvi
const SCAN_RULES = [
  { re: /eval\s*\(/g, sev: 'high', msg: 'eval() ishlatilgan' },
  { re: /child_process|exec\s*\(/g, sev: 'medium', msg: "shell buyrug'i bajarilishi mumkin" },
  { re: /gsk_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}/g, sev: 'critical', msg: 'kod ichida API kalit' },
  { re: /password\s*=\s*["'][^"']+["']/gi, sev: 'high', msg: 'qattiq kodlangan parol' }
]

function scanCode(text) {
  const findings = []
  if (typeof text !== 'string') return findings
  for (const rule of SCAN_RULES) {
    rule.re.lastIndex = 0
    if (rule.re.test(text)) findings.push({ severity: rule.sev, message: rule.msg })
  }
  return findings
}

module.exports = { writeFile, readFile, gitStatus, scanCode, ensureWorkspace }
