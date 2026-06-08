// geoip lib — sof (network'siz) yordamchi funksiyalar.
// lookup() network so'rov qiladi — bu yerda test qilinmaydi.

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { isPrivateIp, cleanIp, flagEmoji, mapsUrl, formatLocation } = require('../src/lib/geoip')

test('isPrivateIp: lokal/ichki IP\'larni aniqlaydi', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true)
  assert.equal(isPrivateIp('::1'), true)
  assert.equal(isPrivateIp('10.0.0.5'), true)
  assert.equal(isPrivateIp('192.168.1.1'), true)
  assert.equal(isPrivateIp('172.16.0.1'), true)
  assert.equal(isPrivateIp('172.31.255.255'), true)
  assert.equal(isPrivateIp('::ffff:192.168.0.1'), true)
  assert.equal(isPrivateIp('fe80::1'), true)
  assert.equal(isPrivateIp(''), true)
  assert.equal(isPrivateIp(null), true)
})

test('isPrivateIp: ommaviy IP false', () => {
  assert.equal(isPrivateIp('8.8.8.8'), false)
  assert.equal(isPrivateIp('213.230.64.1'), false) // O'zbekiston ISP
  assert.equal(isPrivateIp('172.15.0.1'), false)   // 172.16-31 oralig'idan tashqarida
  assert.equal(isPrivateIp('172.32.0.1'), false)
})

test('cleanIp: IPv4-mapped IPv6 prefiksini olib tashlaydi', () => {
  assert.equal(cleanIp('::ffff:213.230.64.1'), '213.230.64.1')
  assert.equal(cleanIp('8.8.8.8'), '8.8.8.8')
  assert.equal(cleanIp(''), '')
  assert.equal(cleanIp(null), '')
})

test('flagEmoji: 2-harfli koddan bayroq emoji', () => {
  assert.equal(flagEmoji('UZ'), '🇺🇿')
  assert.equal(flagEmoji('us'), '🇺🇸') // kichik harf ham
  assert.equal(flagEmoji(''), '')
  assert.equal(flagEmoji('USA'), '')   // 2 harf emas
  assert.equal(flagEmoji(null), '')
})

test('mapsUrl: koordinatalardan Google Maps havola', () => {
  assert.equal(mapsUrl(41.31, 69.24), 'https://www.google.com/maps?q=41.31,69.24')
  assert.equal(mapsUrl(null, 69.24), null)
  assert.equal(mapsUrl(41.31, null), null)
})

test('formatLocation: inson o\'qiy oladigan joylashuv satri', () => {
  const geo = { countryCode: 'UZ', city: 'Tashkent', region: 'Toshkent', country: 'Uzbekistan' }
  assert.equal(formatLocation(geo), '🇺🇿 Tashkent, Toshkent, Uzbekistan')
})

test('formatLocation: noma\'lum (?) maydonlarni tashlab ketadi', () => {
  const geo = { countryCode: '', city: '?', region: '', country: '?' }
  assert.equal(formatLocation(geo), '?')
  assert.equal(formatLocation(null), '?')
})
