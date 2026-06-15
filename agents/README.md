# Eduzy Agents — ko'p agentli AI Orchestrator (WIP ⏸️)

> **Holat: PAUZADA / WIP.** Bu papka `agent.jpg` diagrammasidagi avtonom muhandislik
> jamoasini (AI Agent Orchestrator) kod sifatida qurish uchun boshlangan. Hozircha
> faqat **poydevor** tayyor — to'liq quvur hali ulanmagan.

## Hozir bor (poydevor)
- `src/config.js` — markaziy konfiguratsiya + minimal `.env` yuklovchi (paketsiz).
- `src/llm/groq.js` — Groq klienti (loyiha backend'i uslubida, 1 retry).
- `src/llm/jsonParse.js` — LLM JSON javoblari uchun chidamli parser.

## Rejada (diagramma bo'yicha)
- `src/core/orchestrator.js` — 5 bosqichli quvur (tahlil → reja → muvofiqlashtirish → sifat/xavfsizlik → birlashtirish).
- `src/core/intake.js` — NLP/Intent aniqlash.
- `src/agents/` — 9 agent: Orchestrator, Architect, Planner, Developer, Security/QA/SRE Reviewer, Fix Developer, Tech Writer.
- `src/memory/`, `src/observability/`, `src/policy/`, `src/tools/` — Xotira, Kuzatuv, Qoidalar, Vositalar qatlamlari.
- `src/index.js` — CLI (DRY mock + LIVE Groq rejim).

## Ishlatish (tugagach)
```bash
node src/index.js --dry "Eduzy backendiga rate-limiting qo'sh"   # mock — API kalitsiz
node src/index.js --live "..."                                   # GROQ_API_KEY bilan
```

> Eslatma: `package.json` dagi `start`/`demo` skriptlari `src/index.js` ga ishora qiladi —
> u hali yozilmagan, shuning uchun WIP tugaguncha ishlamaydi.
>
> Ishlaydigan, tugallangan tahlil tool'i uchun qardosh papkaga qarang: **`../mcp`**.
