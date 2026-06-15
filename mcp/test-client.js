// Smoke test — server'ni spawn qilib, MCP so'rovlarini yuboradi va javoblarni tekshiradi.
// Ishlatish: node test-client.js   (yoki npm test)

const { spawn } = require("child_process")
const path = require("path")

const srv = spawn("node", [path.join(__dirname, "server.js")], { stdio: ["pipe", "pipe", "inherit"] })

const requests = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
  { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "analyze_project", arguments: {} } }
]
for (const r of requests) srv.stdin.write(JSON.stringify(r) + "\n")

let buf = ""
srv.stdout.on("data", (d) => {
  buf += d.toString()
  let nl
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    const msg = JSON.parse(line)
    if (msg.id === 1) console.log("✓ initialize OK — protokol:", msg.result.protocolVersion, "| server:", msg.result.serverInfo.name)
    else if (msg.id === 2) console.log("✓ tools/list OK —", msg.result.tools.length, "tool:", msg.result.tools.map(t => t.name).join(", "))
    else if (msg.id === 3) {
      console.log("✓ tools/call (analyze_project) OK\n")
      console.log("════════ analyze_project NATIJASI ════════\n")
      console.log(msg.result.content[0].text)
      srv.kill()
      process.exit(0)
    }
  }
})

setTimeout(() => { console.error("✗ timeout — javob kelmadi"); srv.kill(); process.exit(1) }, 5000)
