// 8 ta ishchi agent ro'yxati — diagrammaning pastki qatori.
// (Orchestrator Agent — alohida: agents/orchestratorAgent.js, miya sifatida.)

const { ArchitectAgent } = require('../agents/architect')
const { PlannerAgent } = require('../agents/planner')
const { DeveloperAgent } = require('../agents/developer')
const { SecurityReviewerAgent } = require('../agents/securityReviewer')
const { QAReviewerAgent } = require('../agents/qaReviewer')
const { SREReviewerAgent } = require('../agents/sreReviewer')
const { FixDeveloperAgent } = require('../agents/fixDeveloper')
const { TechWriterAgent } = require('../agents/techWriter')

const registry = {
  architect: new ArchitectAgent(),
  planner: new PlannerAgent(),
  developer: new DeveloperAgent(),
  security: new SecurityReviewerAgent(),
  qa: new QAReviewerAgent(),
  sre: new SREReviewerAgent(),
  fix: new FixDeveloperAgent(),
  techwriter: new TechWriterAgent()
}

function getAgent(key) { return registry[key] }

module.exports = { registry, getAgent }
