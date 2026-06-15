// MCP tool ta'riflari (inputSchema) + handlerlar.
// Hammasi data.js dagi kuratsiya qilingan bilim bazasiga tayanadi.

const D = require("./data")

const srcLine = (keys) =>
  (keys && keys.length)
    ? "  Manba: " + keys.map(k => D.sources[k]).filter(Boolean).join(", ")
    : ""

// ── market_snapshot ──────────────────────────────────────────────────────
function marketSnapshot(args) {
  const topic = String(args.topic || "all").toLowerCase()
  const out = []
  if (["all", "demografiya", "internet"].includes(topic)) {
    out.push("# Demografiya va raqamli qamrov (O'zbekiston)")
    for (const d of D.demographics) out.push("• " + d.fact + "\n" + srcLine(d.src))
  }
  if (["all", "davlat"].includes(topic)) {
    out.push("\n# Davlat strategiyasi")
    for (const s of D.state) out.push("• " + s.fact + "\n" + srcLine(s.src))
  }
  out.push("\n→ Bozor yosh, ulangan va davlat shamoli ortda — talab katta.")
  return out.join("\n")
}

// ── youth_preferences ────────────────────────────────────────────────────
function youthPreferences() {
  const out = ["# Yoshlar (Gen Z) qanday o'qish tizimini hohlaydi\n"]
  for (const y of D.youth) out.push("• " + y.want + " — " + y.detail + "\n" + srcLine(y.src))
  return out.join("\n")
}

// ── completion_problem ───────────────────────────────────────────────────
function completionProblem() {
  const out = ["# Asosiy dard: odamlar kursni tugatmaydi\n"]
  for (const c of D.completion) out.push("• " + c.fact + "\n" + srcLine(c.src))
  out.push("\n→ Yechim: AI ustoz (qotib qolganda) + gamifikatsiya (battle/streak/reyting) + jamoa = \"tashlab ketmaslik dvigateli\".")
  return out.join("\n")
}

// ── competitor_analysis ──────────────────────────────────────────────────
function competitorAnalysis(args) {
  const name = String(args.name || "").toLowerCase()
  const list = name ? D.competitors.filter(c => c.name.toLowerCase().includes(name)) : D.competitors
  if (!list.length) {
    return "Bunday raqobatchi bazada yo'q. Mavjud: " + D.competitors.map(c => c.name).join(", ")
  }
  const out = ["# Raqobat tahlili (mahalliy)\n"]
  for (const c of list) out.push("• " + c.name + " — " + c.note + "\n" + srcLine(c.src))
  return out.join("\n")
}

// ── analyze_project — savolni bozorga solishtirib baholash ───────────────
function analyzeProject(args) {
  const idea = String(args.idea || "").trim()
  // Bo'sh bo'lsa — Eduzy bo'yicha namuna
  if (!idea) {
    return analyzeProject({
      idea: "Eduzy — o'zbek tilida online ta'lim platformasi: bepul AI Teacher, Code Battle, kunlik masala, reyting/daraja tizimi; pullik video kurslar va QR sertifikat; mobil ilova yo'lda.",
      audience: "O'zbekistondagi yoshlar (16–30)",
      monetization: "pay-per-course + obuna"
    })
  }
  const t = idea.toLowerCase()

  const wants = [
    { re: /mobil|mobile|telefon|ilova|app/, label: "Mobil-first" },
    { re: /\bai\b|sun'iy|tutor|ustoz|yordamchi/, label: "AI ustoz" },
    { re: /gamif|o'yin|battle|musobaqa|reyting|streak|ball|daraja/, label: "Gamifikatsiya" },
    { re: /mikro|qisqa|bite|short/, label: "Mikro-darslar" },
    { re: /ijtimoiy|jamoa|do'st|social|community/, label: "Ijtimoiy o'rganish" },
    { re: /ish|daromad|natija|portfel|career|frilans|sertifikat/, label: "Natija (ish/daromad)" }
  ]
  const hit = wants.filter(w => w.re.test(t))
  const miss = wants.filter(w => !w.re.test(t))
  const engine = /battle|streak|reyting|daraja|ustoz|tutor|qotib|tashla|tugat/.test(t)
  const cheapTrap = /arzon|cheap|baravar|chegirma/.test(t)

  const L = []
  L.push("# Loyiha bozor tahlili\n")
  L.push("Loyiha: " + idea)
  if (args.audience) L.push("Auditoriya: " + args.audience)
  if (args.monetization) L.push("Monetizatsiya: " + args.monetization)

  L.push("\n## 1) Talab bormi? — HA (kuchli)")
  for (const d of D.demographics) L.push("• " + d.fact)
  L.push("• Davlat turtki: " + D.state.map(s => s.fact).join("; "))

  L.push("\n## 2) Yoshlar istaklariga moslik")
  L.push("Qoplangan: " + (hit.length ? hit.map(h => h.label).join(", ") : "—"))
  L.push("Yetishmayotgan: " + (miss.length ? miss.map(m => m.label).join(", ") : "—"))

  L.push("\n## 3) Eng katta dard: tugatmaslik")
  for (const c of D.completion) L.push("• " + c.fact)
  L.push(engine
    ? "✓ Loyihada \"tashlab ketmaslik dvigateli\" bor (ustoz/battle/streak/reyting) — eng to'g'ri yaraga malham."
    : "⚠ Tugatishni oshiradigan dvigatel (AI ustoz + gamifikatsiya) aniq ko'rinmaydi — qo'shing.")

  L.push("\n## 4) Raqobat (mahalliy)")
  for (const c of D.competitors) L.push("• " + c.name + " — " + c.note)

  L.push("\n## 5) Monetizatsiya haqiqati")
  L.push("• Yoshlar kurs emas, NATIJA sotib oladi (ish/daromad/ko'nikma). 96% ish beruvchi micro-credential'ni qadrlaydi.")
  if (cheapTrap) {
    L.push("⚠ \"Arzon\" pozitsiyasi xavfli: nusxalash oson + davlat bepul AI beryapti. Pozitsiyani NATIJAga qur.")
  }

  const score = hit.length + (engine ? 2 : 0)
  let verdict
  if (score >= 6) verdict = "KERAK — kuchli moslik. Dvigatel va natija halqasini markazga ol."
  else if (score >= 3) verdict = "KERAK — lekin \"tashlamaslik + natija\" farqlovchi o'qini kuchaytir."
  else verdict = "QAYTA O'YLA — bozor bor, lekin hozirgi shaklda farq va ushlab turish kuchsiz."

  L.push("\n## ✅ YAKUNIY XULOSA")
  L.push(verdict)
  L.push("\nTavsiyalar:")
  L.push("1. Pozitsiya: \"arzon\" emas — \"natija + tashlab ketmaslik\".")
  L.push("2. Dvigatel (AI ustoz + Battle + streak/reyting) — mahsulot markazida.")
  L.push("3. Natija halqasi: portfel, real bitiruvchi tarixi, ish/frilans ko'prigi.")
  L.push("4. Mobil-first + mikro-darslar (3–10 daq).")
  L.push("5. Mohirdev bilan to'g'ridan urushma — bepul + o'yin bilan keng kirish segmentini ol.")

  return L.join("\n")
}

// ── dispatch ─────────────────────────────────────────────────────────────
function callTool(name, args) {
  switch (name) {
    case "market_snapshot": return marketSnapshot(args)
    case "youth_preferences": return youthPreferences(args)
    case "completion_problem": return completionProblem(args)
    case "competitor_analysis": return competitorAnalysis(args)
    case "analyze_project": return analyzeProject(args)
    default: throw new Error("Noma'lum tool: " + name)
  }
}

const TOOLS = [
  {
    name: "market_snapshot",
    description: "O'zbekiston yoshlar va raqamli bozori: demografiya, internet qamrovi, davlat IT strategiyasi (manbalari bilan).",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", enum: ["all", "demografiya", "internet", "davlat"], description: "Qaysi bo'limni ko'rsatish (default: all)" }
      }
    }
  },
  {
    name: "youth_preferences",
    description: "Yoshlar (Gen Z) qanday o'qish tizimini hohlaydi: mobil, AI ustoz, gamifikatsiya, mikro-darslar, ijtimoiylik, natija.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "completion_problem",
    description: "Onlayn ta'limning eng katta dardi — kurs tugatmaslik (5–15%) va uni 70%+ ga ko'taradigan yechim.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "competitor_analysis",
    description: "Mahalliy raqobatchilar (Mohirdev, Najot Ta'lim, PDP, davlat bepul AI) tahlili.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Aniq raqobatchi nomi (ixtiyoriy)" } }
    }
  },
  {
    name: "analyze_project",
    description: "Ta'lim loyihasi g'oyasini bozor signallariga solishtirib baholaydi (talab, yoshlar istagiga moslik, tugatish dvigateli, raqobat, monetizatsiya) va yakuniy xulosa + tavsiyalar beradi. idea bo'sh bo'lsa — Eduzy bo'yicha namuna.",
    inputSchema: {
      type: "object",
      properties: {
        idea: { type: "string", description: "Loyiha g'oyasi tavsifi" },
        audience: { type: "string", description: "Maqsadli auditoriya (ixtiyoriy)" },
        monetization: { type: "string", description: "Daromad modeli (ixtiyoriy)" }
      }
    }
  }
]

module.exports = { TOOLS, callTool }
