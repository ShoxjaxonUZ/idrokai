// personalize — keshlangan savollarni aralashtiradi, ammo to'g'ri javob
// (correct) o'zining variant matniga bog'langan holda to'g'ri qolishi SHART.

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { shuffled, personalize } = require('../src/lib/quizShuffle')

const sample = () => ([
  { question: 'Q1', options: ['a0', 'a1', 'a2', 'a3'], correct: 0 },
  { question: 'Q2', options: ['b0', 'b1', 'b2', 'b3'], correct: 2 },
  { question: 'Q3', options: ['c0', 'c1', 'c2', 'c3'], correct: 3 },
])

test('shuffled: asl massivni o\'zgartirmaydi va elementlarni saqlaydi', () => {
  const orig = [1, 2, 3, 4, 5]
  const out = shuffled(orig)
  assert.deepEqual(orig, [1, 2, 3, 4, 5]) // mutatsiya yo'q
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]) // hamma element bor
  assert.equal(out.length, 5)
})

test('personalize: to\'g\'ri javob matni har doim to\'g\'ri indeksda qoladi', () => {
  const src = sample()
  // Asl correct javob matnlari (question -> to'g'ri option matni)
  const correctText = {}
  for (const q of src) correctText[q.question] = q.options[q.correct]

  // Ko'p marta — random shuffle har xil bo'lsa ham invariant buzilmasin
  for (let run = 0; run < 200; run++) {
    const out = personalize(src)
    assert.equal(out.length, 3)
    for (const q of out) {
      assert.equal(q.options.length, 4)
      assert.ok(q.correct >= 0 && q.correct <= 3)
      // Yangi correct indeksdagi matn — asl to'g'ri javob matni bilan bir xil
      assert.equal(q.options[q.correct], correctText[q.question])
      // Variantlar to'plami o'zgarmagan (faqat tartib)
      const orig = src.find(s => s.question === q.question)
      assert.deepEqual([...q.options].sort(), [...orig.options].sort())
    }
  }
})

test('personalize: asl savollarni mutatsiya qilmaydi', () => {
  const src = sample()
  const snapshot = JSON.stringify(src)
  personalize(src)
  assert.equal(JSON.stringify(src), snapshot)
})
