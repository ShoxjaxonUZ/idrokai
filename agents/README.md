# Eduzy Agents — ko'p agentli AI Orchestrator ✅

`agent.jpg` diagrammasidagi **avtonom muhandislik jamoasi** — kod sifatida.
Bitta vazifa berasiz, Orchestrator uni 9 ta ixtisoslashgan agentga taqsimlab,
5 bosqichda yakuniy hisobotgacha olib boradi.

> **Tashqi paket YO'Q** — faqat Node.js 20+. **API kalitsiz ham ishlaydi** (DRY mock rejim).
> LIVE rejim: **Claude (Anthropic)** — `ANTHROPIC_API_KEY` qo'ying. **Har agent o'z modeliga ega**
> (default `claude-opus-4-8`; `.env`'da har biriga alohida model berish mumkin).

---

## Tez ishga tushirish

```bash
# Mock rejim — API kaliti shart emas, butun quvurni ko'rsatadi
node src/index.js --dry "Eduzy backendiga login uchun rate-limiting qo'sh"

# yoki
npm run demo

# Real Claude bilan (agents/.env da ANTHROPIC_API_KEY bo'lsa)
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

## AI provayder va modellar

LIVE rejim **Claude (Anthropic) native Messages API** orqali ishlaydi (nol bog'liqlik
saqlanishi uchun to'g'ridan-to'g'ri, SDK'siz — OpenAI-shim emas). **Har agent o'z modelini oladi:**

```
AGENT_PROVIDER=anthropic            # yoki groq
ANTHROPIC_API_KEY=...               # LIVE uchun (bo'sh — DRY mock)
AGENT_MODEL=claude-opus-4-8         # barcha agentlar uchun default

# Har agentga alohida model (default — hammasi AGENT_MODEL):
AGENT_MODEL_DEVELOPER=claude-opus-4-8
AGENT_MODEL_PLANNER=claude-sonnet-4-6
AGENT_MODEL_QA=claude-haiku-4-5
AGENT_MODEL_SRE=claude-haiku-4-5
# KEY'lar: INTAKE ORCHESTRATOR ARCHITECT PLANNER DEVELOPER SECURITY QA SRE FIX TECHWRITER

AGENT_EFFORT=high                   # low|medium|high|max (Opus/Sonnet; Haiku'da e'tiborsiz)
AGENT_MAX_TOKENS=8192
```

Default — har agent `claude-opus-4-8`. Model tanlovi sizning qaroringiz; adaptiv
fikrlash + effort faqat qo'llab-quvvatlovchi modellarga yuboriladi (Opus 4.5+/Sonnet 4.6/Fable —
Haiku 4.5'ga emas, aks holda API 400 qaytaradi).

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
