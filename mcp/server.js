#!/usr/bin/env node
// Eduzy Market-Intelligence MCP server.
// Transport: stdio. Protokol: MCP (JSON-RPC 2.0, satr bilan ajratilgan JSON).
// Tashqi paket YO'Q — `node server.js` bilan darhol ishlaydi.
// MUHIM: stdout faqat protokol uchun; barcha loglar stderr'ga.

const { TOOLS, callTool } = require("./src/tools")

const SERVER_INFO = { name: "eduzy-market-mcp", version: "0.1.0" }
const DEFAULT_PROTOCOL = "2024-11-05"

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n")
}
function log(...a) {
  process.stderr.write("[eduzy-market-mcp] " + a.join(" ") + "\n")
}

function handle(msg) {
  const { id, method, params } = msg

  // Bildirishnomalar (id yo'q) — javob bermaymiz
  if (method === "notifications/initialized" || method === "initialized") return

  if (method === "initialize") {
    const proto = params && params.protocolVersion ? params.protocolVersion : DEFAULT_PROTOCOL
    return send({
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: proto,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "EdTech/yoshlar bozori tahlili. analyze_project bilan loyiha g'oyasini bozorga solishtirib baholang; market_snapshot, youth_preferences, completion_problem, competitor_analysis bilan faktlarni oling."
      }
    })
  }

  if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} })

  if (method === "tools/list") {
    return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } })
  }

  if (method === "tools/call") {
    const name = params && params.name
    const args = (params && params.arguments) || {}
    try {
      const text = callTool(name, args)
      return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } })
    } catch (err) {
      return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "Xato: " + err.message }], isError: true } })
    }
  }

  // Noma'lum metod
  if (id !== undefined) {
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } })
  }
}

let buf = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => {
  buf += chunk
  let nl
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    let msg
    try { msg = JSON.parse(line) } catch { log("JSON parse xato:", line.slice(0, 80)); continue }
    try { handle(msg) } catch (e) { log("handle xato:", e.message) }
  }
})
process.stdin.on("end", () => process.exit(0))

log("server tayyor (stdio) — tool'lar:", TOOLS.map(t => t.name).join(", "))
