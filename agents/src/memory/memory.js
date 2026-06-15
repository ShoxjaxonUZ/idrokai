// Xotira & Kontekst — uzoq muddatli xotira (run'lar orasida saqlanadi).
// Oddiy fayl asosida (JSON), tashqi DB shart emas.

const fs = require('fs')
const path = require('path')

class Memory {
  constructor(file) {
    this.file = file
    this.data = { tasks: [], notes: [] }
    this._load()
  }

  _load() {
    try {
      if (fs.existsSync(this.file)) {
        const d = JSON.parse(fs.readFileSync(this.file, 'utf8'))
        this.data = { tasks: d.tasks || [], notes: d.notes || [] }
      }
    } catch { /* buzilgan bo'lsa — toza boshlaymiz */ }
  }

  _save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2))
    } catch {}
  }

  // Tegishli o'tmish vazifalar (sodda kalit-so'z mosligi)
  recall(task, limit = 3) {
    const words = new Set(String(task).toLowerCase().split(/\W+/).filter(w => w.length > 3))
    return this.data.tasks
      .map(t => {
        const tw = new Set(String(t.task).toLowerCase().split(/\W+/))
        let overlap = 0
        for (const w of words) if (tw.has(w)) overlap++
        return { ...t, _score: overlap }
      })
      .filter(t => t._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
  }

  remember(record) {
    this.data.tasks.push({ ...record, at: new Date().toISOString() })
    if (this.data.tasks.length > 200) this.data.tasks = this.data.tasks.slice(-200)
    this._save()
  }

  addNote(note) {
    this.data.notes.push({ note, at: new Date().toISOString() })
    this._save()
  }
}

module.exports = { Memory }
