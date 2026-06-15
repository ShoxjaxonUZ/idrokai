// AI AGENT ORCHESTRATOR — 5 bosqichli quvur (diagrammaning markazi).
// Intake → Tahlil → Reja → Muvofiqlashtirish (delegatsiya + review gate + fix loop) → Birlashtirish.

const { config } = require('../config')
const { intake } = require('./intake')
const orchestratorAgent = require('../agents/orchestratorAgent')
const { getAgent } = require('./registry')
const { policy } = require('../policy/policy')

const REVIEW_AGENTS = ['security', 'qa', 'sre']

async function runReviews(ctx, reviewers, deps) {
  for (const key of reviewers) {
    const r = await getAgent(key).run(ctx, deps)
    ctx.artifacts[key] = r
    ctx.reviews[key] = r.verdict
    if (r.verdict === 'block') {
      const high = (r.findings || []).filter(f => f.severity === 'high' || f.severity === 'critical')
      const msgs = (high.length ? high : (r.findings || [])).map(f => ({ agent: key, severity: f.severity, message: f.message }))
      ctx.blockers.push(...msgs)
      deps.logger.warn(key, `BLOCK: ${msgs.map(m => m.message).join('; ')}`)
    } else {
      deps.logger.info(key, 'verdict=pass')
    }
  }
}

async function orchestrate(task, deps) {
  const { logger, memory } = deps
  const ctx = { runId: deps.runId, task, intake: null, analysis: null, plan: null, artifacts: {}, reviews: {}, blockers: [], iterations: 0 }

  // ── So'rovni qabul qilish ──
  logger.phase(0, "So'rovni qabul qilish (NLP / Intent)")
  ctx.intake = await intake(task)
  logger.info('intake', `intent=${ctx.intake.intent}, murakkablik=${ctx.intake.complexity}, hudud=${ctx.intake.areas.join(',')}`)
  const past = memory.recall(task)
  if (past.length) logger.info('memory', `o'xshash ${past.length} o'tmish vazifa eslandi`)

  // ── 1: Vazifa tahlili ──
  logger.phase(1, 'Vazifa tahlili')
  ctx.analysis = await orchestratorAgent.analyze(ctx)
  logger.info('orchestrator', ctx.analysis.understanding)

  // ── 2: Rejalashtirish ──
  logger.phase(2, 'Rejalashtirish')
  ctx.plan = orchestratorAgent.planWorkflow(ctx)
  logger.info('orchestrator', ctx.plan.rationale)

  // ── 3: Muvofiqlashtirish (build agentlari) ──
  logger.phase(3, 'Muvofiqlashtirish (delegatsiya)')
  const buildAgents = ctx.plan.agents.filter(k => !REVIEW_AGENTS.includes(k) && k !== 'techwriter')
  for (const key of buildAgents) {
    ctx.artifacts[key] = await getAgent(key).run(ctx, deps)
  }

  // ── 4: Sifat & Xavfsizlik (review gate + fix loop) ──
  const reviewers = ctx.plan.agents.filter(k => REVIEW_AGENTS.includes(k))
  if (reviewers.length) {
    logger.phase(4, 'Sifat & Xavfsizlik')
    await runReviews(ctx, reviewers, deps)
    while (ctx.blockers.length && ctx.iterations < config.maxFixIterations) {
      ctx.iterations++
      logger.warn('orchestrator', `${ctx.blockers.length} ta bloklovchi muammo → Fix Developer (iteratsiya ${ctx.iterations})`)
      ctx.artifacts.fix = await getAgent('fix').run(ctx, deps)
      const blocked = [...new Set(ctx.blockers.map(b => b.agent))]
      ctx.blockers = []
      await runReviews(ctx, blocked, deps)
    }
    if (ctx.blockers.length) logger.alert('orchestrator', `Hal qilinmagan ${ctx.blockers.length} muammo qoldi (limit)`)
  }

  // ── 5: Natija birlashtirish ──
  logger.phase(5, 'Natija birlashtirish')
  const issues = policy.compliance(ctx)
  issues.forEach(i => logger.warn('policy', i))
  ctx.artifacts.techwriter = await getAgent('techwriter').run(ctx, deps)
  ctx.finalReport = policy.redact(ctx.artifacts.techwriter.report || '')

  memory.remember({ task, intent: ctx.intake.intent, agents: ctx.plan.agents, iterations: ctx.iterations })
  return ctx
}

module.exports = { orchestrate }
