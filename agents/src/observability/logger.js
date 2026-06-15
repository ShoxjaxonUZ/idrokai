// Kuzatuv & Kuzatiluvchanlik — loglar, metrikalar, tracing.
// Har run uchun .runs/<runId>/trace.jsonl + summary.json. Konsolda rangli chiqish.

const fs = require('fs')
const path = require('path')

const COLORS = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  gray: '\x1b[90m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m'
}
const paint = (s, c) => `${COLORS[c] || ''}${s}${COLORS.reset}`

class Logger {
  constructor(runId, runDir, { quiet = false } = {}) {
    this.runId = runId
    this.runDir = runDir
    this.quiet = quiet
    this.startedAt = Date.now()
    this.metrics = { agentRuns: 0, tokens: 0, warnings: 0, alerts: 0, phases: 0 }
    this.events = []
    try { fs.mkdirSync(runDir, { recursive: true }) } catch {}
    this.traceFile = path.join(runDir, 'trace.jsonl')
  }

  _write(event) {
    const rec = { t: new Date().toISOString(), ...event }
    this.events.push(rec)
    try { fs.appendFileSync(this.traceFile, JSON.stringify(rec) + '\n') } catch {}
  }

  phase(num, title) {
    this.metrics.phases++
    this._write({ type: 'phase', num, title })
    if (!this.quiet) console.log('\n' + paint(`  ┏━ ${num}-bosqich · ${title}`, 'cyan'))
  }

  info(agent, msg) {
    this._write({ type: 'info', agent, msg })
    if (!this.quiet) console.log(paint('  ┃ ', 'cyan') + paint(`[${agent}] `, 'gray') + msg)
  }

  warn(agent, msg) {
    this.metrics.warnings++
    this._write({ type: 'warn', agent, msg })
    if (!this.quiet) console.log(paint(`  ┃ ⚠ [${agent}] ${msg}`, 'yellow'))
  }

  alert(agent, msg) {
    this.metrics.alerts++
    this._write({ type: 'alert', agent, msg })
    console.log(paint(`  ┃ 🚨 [${agent}] ${msg}`, 'red'))
  }

  metric(name, value = 1) { this.metrics[name] = (this.metrics[name] || 0) + value }
  trace(name, data) { this._write({ type: 'trace', name, data }) }

  finish(extra = {}) {
    const sum = { runId: this.runId, durationMs: Date.now() - this.startedAt, ...this.metrics, ...extra }
    try { fs.writeFileSync(path.join(this.runDir, 'summary.json'), JSON.stringify(sum, null, 2)) } catch {}
    return sum
  }
}

module.exports = { Logger, paint, COLORS }
