# Eduzy Agents — ko'p agentli AI Orchestrator ✅

`agent.jpg` diagrammasidagi **avtonom muhandislik jamoasi** — kod sifatida.
Bitta vazifa berasiz, Orchestrator uni 9 ta ixtisoslashgan agentga taqsimlab,
5 bosqichda yakuniy hisobotgacha olib boradi.

> **Tashqi paket YO'Q** — faqat Node.js 20+. **API kalitsiz ham ishlaydi** (DRY mock rejim);
> `GROQ_API_KEY` qo'yilsa — real Groq (`llama-3.3-70b-versatile`) bilan.

---

## Tez ishga tushirish

```bash
# Mock rejim — API kaliti shart emas, butun quvurni ko'rsatadi
node src/index.js --dry "Eduzy backendiga login uchun rate-limiting qo'sh"

# yoki
npm run demo

# Real Groq bilan (agents/.env da GROQ_API_KEY bo'lsa)
node src/index.js --live "..."
```

Flaglar: `--dry` (mock), `--live` (Groq), `--quiet` (kam log), `--json` (to'liq kontekst).

## Quvur (5 bosqich + intake)

```
So'rov ─▶ [0] Intake (NLP/Intent)
         [1] Vazifa tahlili      ┐  Orchestrator Agent (miya)
         [2] Rejalashtirish      ┘  intent → agentlar zanjiri
         [3] Muvofiqlashtirish   →  Architect → Planner → Developer
         [4] Sifat & Xavfsizlik  →  Security/QA/SRE review + Fix loop
         [5] Natija birlashtirish→  Tech Writer → yakuniy hisobot
```

**Fix loop:** reviewer `block` qaytarsa, Fix Developer tuzatadi va faqat bloklagan
reviewer qayta ishga tushadi (`AGENT_MAX_FIX_ITER` marta).

**Intent → workflow:**
| Intent | Agentlar zanjiri |
|---|---|
| `feature` | architect → planner → developer → security → qa → sre → techwriter |
| `bugfix` | planner → developer → qa → techwriter |
| `security` | developer → security → qa → techwriter |
| `docs` / `question` | techwriter |

## 9 agent

Orchestrator · Architect · Planner · Developer · Security Reviewer ·
QA Reviewer · SRE Reviewer · Fix Developer · Tech Writer

## Qo'llab-quvvatlash qatlamlari

- **Xotira** (`memory/`) — run'lar orasida saqlanadigan fayl-xotira (o'xshash o'tmish vazifalar).
- **Kuzatuv** (`observability/`) — rangli log + `.runs/<runId>/trace.jsonl` + `summary.json`, metrikalar.
- **Qoidalar** (`policy/`) — maxfiy kalitlarni redakt qilish, sandbox tekshiruvi, compliance.
- **Vositalar** (`tools/`) — fayl (workspace sandbox), Git (o'qish), kod skaneri.

## Sozlamalar (`.env`, ixtiyoriy)

```
GROQ_API_KEY=          # bo'sh bo'lsa — DRY mock rejim
AGENT_MODEL=llama-3.3-70b-versatile
AGENT_TEMPERATURE=0.4
AGENT_MAX_TOKENS=2000
AGENT_MAX_FIX_ITER=1
```

## Tuzilma

```
agents/src/
├── index.js              # CLI kirish nuqtasi
├── config.js             # konfiguratsiya + .env yuklovchi
├── llm/                  # groq.js (klient), jsonParse.js (chidamli JSON)
├── core/                 # orchestrator.js, intake.js, registry.js
├── agents/               # baseAgent.js + 9 agent + orchestratorAgent.js
├── memory/               # memory.js
├── observability/        # logger.js
├── policy/               # policy.js
└── tools/                # index.js (fayl/git/skaner)
```

## Natija

Har run `agents/.runs/<runId>/` ichida saqlanadi: `report.md`, `context.json`,
`trace.jsonl`, `summary.json`. (`.runs/` va `workspace/` git'ga kirmaydi.)

> Qardosh papka: **`../mcp`** — bozor-tahlil MCP server (Claude'ga ulanadi).
