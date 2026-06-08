// validQuestion — AI generatsiya qilgan savol to'g'ri tuzilganmi.
// (generateQuestions network qiladi — bu yerda sof validator test qilinadi.)

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validQuestion } = require('../src/lib/quizGen')

test('validQuestion: to\'g\'ri savolni qabul qiladi', () => {
  assert.equal(validQuestion({ question: 'Q', options: ['a', 'b', 'c', 'd'], correct: 0 }), true)
  assert.equal(validQuestion({ question: 'Q', options: ['a', 'b', 'c', 'd'], correct: 3 }), true)
})

test('validQuestion: variant soni 4 bo\'lmasa rad etadi', () => {
  assert.equal(validQuestion({ question: 'Q', options: ['a', 'b', 'c'], correct: 0 }), false)
  assert.equal(validQuestion({ question: 'Q', options: ['a', 'b', 'c', 'd', 'e'], correct: 0 }), false)
})

test('validQuestion: correct oraliqdan tashqari bo\'lsa rad etadi', () => {
  assert.equal(validQuestion({ question: 'Q', options: ['a', 'b', 'c', 'd'], correct: 4 }), false)
  assert.equal(validQuestion({ question: 'Q', options: ['a', 'b', 'c', 'd'], correct: -1 }), false)
  assert.equal(validQuestion({ question: 'Q', options: ['a', 'b', 'c', 'd'], correct: 1.5 }), false)
  assert.equal(validQuestion({ question: 'Q', options: ['a', 'b', 'c', 'd'], correct: '0' }), false)
})

test('validQuestion: matn/struktura buzuq bo\'lsa rad etadi', () => {
  assert.equal(validQuestion({ options: ['a', 'b', 'c', 'd'], correct: 0 }), false) // question yo'q
  assert.equal(validQuestion({ question: 'Q', correct: 0 }), false)                  // options yo'q
  assert.equal(validQuestion(null), false)
  assert.equal(validQuestion(undefined), false)
  assert.equal(validQuestion('savol'), false)
})
