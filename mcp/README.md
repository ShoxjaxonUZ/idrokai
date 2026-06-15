# Eduzy Market MCP

EdTech va yoshlar bozori tahlili uchun **MCP (Model Context Protocol) server**.
Claude Desktop, Claude Code yoki istalgan MCP klientga ulanadi.

> **Tashqi paket YO'Q** — faqat Node.js 20+. `node server.js` bilan darhol ishlaydi.

---

## Nima qiladi

Mening tadqiqotim asosida (har bir fakt **manbasi bilan**) yoshlar/EdTech bozori bo'yicha
5 ta tool beradi. Eng muhimi — `analyze_project`: loyiha g'oyasini bozor signallariga
solishtirib **yakuniy xulosa + tavsiyalar** chiqaradi.

| Tool | Vazifa |
|---|---|
| `market_snapshot` | O'zbekiston demografiyasi, internet qamrovi, davlat IT strategiyasi |
| `youth_preferences` | Yoshlar (Gen Z) qanday o'qish tizimini hohlaydi |
| `completion_problem` | Kurs tugatmaslik dardi (5–15%) va 70%+ ga ko'taradigan yechim |
| `competitor_analysis` | Mahalliy raqobat (Mohirdev, Najot, PDP, davlat bepul AI) |
| `analyze_project` | Loyiha g'oyasini bozorga solishtirib baholash (savolga javob) |

---

## Tez ishga tushirish

```bash
node test-client.js     # smoke-test (yoki: npm test)
node server.js          # stdio MCP server
```

`test-client.js` serverni ishga tushirib, `initialize → tools/list → analyze_project`
zanjirini tekshiradi va natijani chop etadi.

---

## Claude Desktop'ga ulash

`claude_desktop_config.json` faylga qo'shing
(Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "eduzy-market": {
      "command": "node",
      "args": ["D:\\Desktop\\eduuz1\\mcp\\server.js"]
    }
  }
}
```

So'ng Claude Desktop'ni qayta ishga tushiring — tool'lar 🔌 belgisida ko'rinadi.

## Claude Code'ga ulash

```bash
claude mcp add eduzy-market -- node D:\Desktop\eduuz1\mcp\server.js
```

Tekshirish: `claude mcp list` → `eduzy-market` ko'rinishi kerak.

---

## Misol (Claude bilan)

> "eduzy-market MCP orqali loyihamni baholab ber"
> "youth_preferences tool'ini chaqirib, yoshlar nima hohlashini ko'rsat"
> "analyze_project: idea = 'matematika repetitor platformasi', audience = 'maktab o'quvchilari'"

---

## Ma'lumot va manbalar

Bilim bazasi `src/data.js` da (holat: **2026-06**), har bir fakt manbasi bilan
(DataReportal, IT Park, WGU, TCS, Mohirdev, Najot Ta'lim, Coursera va b.).
Raqamlarni yangilash uchun shu faylni tahrirlang — qolgan kod o'zgarmaydi.

## Tuzilma

```
mcp/
├── server.js        # MCP stdio JSON-RPC server (initialize/tools.list/tools.call)
├── test-client.js   # smoke-test klient
└── src/
    ├── data.js      # kuratsiya qilingan bilim bazasi (manbalari bilan)
    └── tools.js     # 5 tool: ta'rif (inputSchema) + handler
```
