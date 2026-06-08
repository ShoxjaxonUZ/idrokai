// isDisposable / isTrusted / looksFake — ro'yxatdan o'tishda soxta email filtri.

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { isDisposable, isTrusted, looksFake } = require('../src/lib/disposableDomains')

test('isDisposable: bir martalik domenlarni aniqlaydi', () => {
  assert.equal(isDisposable('user@mailinator.com'), true)
  assert.equal(isDisposable('x@10minutemail.com'), true)
  assert.equal(isDisposable('UPPER@YOPMAIL.COM'), true) // case-insensitive
})

test('isDisposable: normal domen false', () => {
  assert.equal(isDisposable('user@gmail.com'), false)
  assert.equal(isDisposable('student@edu.uz'), false)
})

test('isDisposable: noto\'g\'ri kirishda crash emas', () => {
  assert.equal(isDisposable('no-at-sign'), false)
  assert.equal(isDisposable(''), false)
  assert.equal(isDisposable(null), false)
  assert.equal(isDisposable(123), false)
})

test('isTrusted: mashhur provayderlarni tan oladi', () => {
  assert.equal(isTrusted('a@gmail.com'), true)
  assert.equal(isTrusted('a@yandex.uz'), true)
  assert.equal(isTrusted('a@umail.uz'), true)
  assert.equal(isTrusted('A@Outlook.com'), true)
})

test('isTrusted: noma\'lum domen false', () => {
  assert.equal(isTrusted('a@random-company.io'), false)
  assert.equal(isTrusted(null), false)
})

test('looksFake: aniq test/soxta username\'larni belgilaydi', () => {
  assert.equal(looksFake('test@gmail.com'), true)
  assert.equal(looksFake('test123@gmail.com'), true)
  assert.equal(looksFake('asdf@gmail.com'), true)
  assert.equal(looksFake('qwerty@gmail.com'), true)
  assert.equal(looksFake('12345@gmail.com'), true) // faqat raqam
  assert.equal(looksFake('a@gmail.com'), true)      // juda qisqa local
})

test('looksFake: normal email false', () => {
  assert.equal(looksFake('shoxjaxon@gmail.com'), false)
  assert.equal(looksFake('ali.valiyev@umail.uz'), false)
})

test('looksFake: struktura buzuq bo\'lsa true', () => {
  assert.equal(looksFake('no-at-sign'), true)
  assert.equal(looksFake('user@ab'), true)        // domen juda qisqa
  assert.equal(looksFake('user@x.5'), true)        // TLD\'da raqam
  assert.equal(looksFake(null), true)
  assert.equal(looksFake(''), true)
})
