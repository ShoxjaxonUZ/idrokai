// safeParseJson / extractAndParseJson — AI (Groq) javoblarini chidamli parse qilish.
// Bu lib kritik: LLM tez-tez invalid escape yuboradi (audit sabog'i).

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { safeParseJson, extractAndParseJson } = require('../src/lib/jsonParse')

test('safeParseJson: to\'g\'ri JSON to\'g\'ridan-to\'g\'ri parse bo\'ladi', () => {
  assert.deepEqual(safeParseJson('{"a":1,"b":"x"}'), { a: 1, b: 'x' })
})

test('safeParseJson: invalid escape (\\d, \\s, \\w) ni tuzatadi', () => {
  // LLM kod bloki ichida \d kabi regex escape'larini yuboradi
  const raw = '{"code":"\\d+ va \\s belgi"}'
  const out = safeParseJson(raw)
  assert.equal(out.code, '\\d+ va \\s belgi')
})

test('safeParseJson: control character (xom newline) ni normalize qiladi', () => {
  const raw = '{"text":"birinchi\nikkinchi"}'
  const out = safeParseJson(raw)
  assert.equal(out.text, 'birinchi\nikkinchi')
})

test('safeParseJson: bo\'sh/noto\'g\'ri kirish null qaytaradi', () => {
  assert.equal(safeParseJson(''), null)
  assert.equal(safeParseJson(null), null)
  assert.equal(safeParseJson(undefined), null)
  assert.equal(safeParseJson(42), null)
})

test('safeParseJson: butunlay buzuq JSON null qaytaradi (crash emas)', () => {
  assert.equal(safeParseJson('{ bu json emas '), null)
})

test('extractAndParseJson: matn ichidagi JSON blokini ajratadi', () => {
  const text = 'Mana javob: {"score": 5, "ok": true} — rahmat!'
  assert.deepEqual(extractAndParseJson(text), { score: 5, ok: true })
})

test('extractAndParseJson: JSON yo\'q bo\'lsa null', () => {
  assert.equal(extractAndParseJson('hech qanday json yo\'q'), null)
  assert.equal(extractAndParseJson(''), null)
  assert.equal(extractAndParseJson(null), null)
})

test('extractAndParseJson: markdown ```json blok ichidan oladi', () => {
  const text = '```json\n{"a":1}\n```'
  assert.deepEqual(extractAndParseJson(text), { a: 1 })
})
