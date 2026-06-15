#!/usr/bin/env node
// Eduzy — ko'p agentli AI Orchestrator. CLI kirish nuqtasi.
// Ishlatish: node src/index.js [--dry|--live] [--quiet] [--json] "vazifa matni"

const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const { config } = require('./config')
const { Logger, paint } = require('./observability/logger')
const { Memory } = require('./memory/memory')
const { orchestrate } = require('./core/orchestrator')

function parseArgs(argv) {
  const flags = new Set()
  const rest = []
  for (const a of argv) {
    if (['--dry', '--live', '--quiet', '--json'].includes(a)) flags.add(a)
    else rest.push(a)
  }
  return { flags, task: rest.join(' ').trim() }
}

function banner() {
  return paint([
    '',
    '  ╔══════════════════════════════════════════════╗',
    '  ║         🤖  AI AGENT ORCHESTRATOR             ║',
    '  ║      Eduzy — autonom muhandislik jamoasi      ║',
    '  ╚══════════════════════════════════════════════╝'
  ].join('\n'), 'magenta')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.flags.has('--live')) config.dryRun = false
  if (args.flags.has('--dry')) config.dryRun = true

  const task = args.task || "Eduzy backendiga login uchun rate-limiting qo'sh"
  const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(2).toString('hex')
  const runDir = path.join(config.runsDir, runId)

  console.log(banner())
  console.log(paint('  Vazifa: ', 'bold') + task)
  console.log(paint('  Rejim:  ', 'bold') + (config.dryRun
    ? paint('DRY (mock — API kaliti shart emas)', 'yellow')
    : paint('LIVE (Groq ' + config.model + ')', 'green')))
  console.log(paint(`  Run ID: ${runId}`, 'gray'))

  const logger = new Logger(runId, runDir, { quiet: args.flags.has('--quiet') })
  const memory = new Memory(path.join(config.runsDir, 'memory.json'))

  const ctx = await orchestrate(task, { runId, logger, memory })
  const summary = logger.finish({ intent: ctx.intake.intent, agents: ctx.plan.agents, iterations: ctx.iterations })

  console.log('\n' + paint('  ━━━ YAKUNIY HISOBOT ━━━', 'green'))
  console.log('\n' + (ctx.finalReport || "(hisobot yo'q)") + '\n')

  console.log(paint('  ━━━ KUZATUV (metrikalar) ━━━', 'cyan'))
  console.log(paint(`  Davomiylik: ${summary.durationMs}ms · Agent: ${summary.agentRuns} · Tokenlar: ${summary.tokens} · Ogohlantirish: ${summary.warnings} · Alert: ${summary.alerts}`, 'gray'))
  console.log(paint(`  Bosqichlar: ${summary.phases} · Fix iteratsiya: ${ctx.iterations} · Intent: ${ctx.intake.intent}`, 'gray'))

  try {
    fs.writeFileSync(path.join(runDir, 'report.md'), ctx.finalReport || '')
    fs.writeFileSync(path.join(runDir, 'context.json'), JSON.stringify(ctx, null, 2))
  } catch {}
  console.log(paint(`\n  📁 To'liq natija: ${path.relative(config.root, runDir)}/`, 'gray'))

  if (args.flags.has('--json')) console.log(JSON.stringify(ctx, null, 2))
}

main().catch(err => {
  console.error('\n  🚨 Orchestrator xatosi:', err.message)
  process.exit(1)
})
