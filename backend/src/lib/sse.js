// Server-Sent Events (SSE) — real-time client'larga push.
// WebSocket'dan oson: bir tomonlama, HTTP, avtomatik reconnect.

// userId -> Set<{res, lastPing}> — har user'ning ochiq SSE ulanishlari
const clients = new Map()

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set())
  const entry = { res, lastPing: Date.now() }
  clients.get(userId).add(entry)
  return entry
}

function removeClient(userId, entry) {
  const set = clients.get(userId)
  if (!set) return
  set.delete(entry)
  if (set.size === 0) clients.delete(userId)
}

// Bitta user uchun event yuborish (notification yaratilganda chaqiriladi)
function sendToUser(userId, event, data) {
  const set = clients.get(userId)
  if (!set) return 0
  let sent = 0
  for (const entry of set) {
    try {
      entry.res.write(`event: ${event}\n`)
      entry.res.write(`data: ${JSON.stringify(data)}\n\n`)
      sent++
    } catch {
      // ulanish uzilgan
      removeClient(userId, entry)
    }
  }
  return sent
}

// Bir nechta user uchun (broadcast)
function sendToMany(userIds, event, data) {
  let total = 0
  for (const uid of userIds) total += sendToUser(uid, event, data)
  return total
}

// Heartbeat — har 30 sekundda barcha ulanishlarga "ping" yuborish
// (proxylar va load balancerlar idle connectionlarni uzmasligi uchun)
setInterval(() => {
  for (const [userId, set] of clients.entries()) {
    for (const entry of set) {
      try {
        entry.res.write(': ping\n\n')
        entry.lastPing = Date.now()
      } catch {
        removeClient(userId, entry)
      }
    }
  }
}, 30000)

function stats() {
  let total = 0
  for (const set of clients.values()) total += set.size
  return { users: clients.size, connections: total }
}

module.exports = { addClient, removeClient, sendToUser, sendToMany, stats }
