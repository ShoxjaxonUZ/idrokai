// Bepul IP geolocation — ipapi.co (kunlik 30k so'rov bepul, kalit kerakmas).
// 10 daqiqalik in-memory cache.
//
// Qaytarilgan maydonlar:
//   country  — davlat nomi
//   countryCode — ISO 2-harf
//   region   — viloyat/shtat
//   city     — shahar
//   postal   — pochta indeksi
//   latitude, longitude — koordinatalar
//   timezone — vaqt zonasi
//   isp      — provayder/tashkilot
//   asn      — Autonomous System raqami

const cache = new Map()
const TTL = 10 * 60 * 1000 // 10 daqiqa

const isPrivateIp = (ip) => {
  if (!ip) return true
  return (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('::ffff:127.') ||
    ip.startsWith('::ffff:10.') ||
    ip.startsWith('::ffff:192.168.') ||
    ip.startsWith('fc00:') ||
    ip.startsWith('fe80:')
  )
}

const cleanIp = (ip) => {
  if (!ip) return ''
  return ip.replace(/^::ffff:/, '')
}

const localData = {
  country: 'Local',
  countryCode: '',
  region: 'Local',
  city: 'Local',
  postal: '',
  latitude: null,
  longitude: null,
  timezone: 'Asia/Tashkent',
  isp: 'Local network',
  asn: ''
}

const lookup = async (rawIp) => {
  const ip = cleanIp(rawIp)
  if (!ip || isPrivateIp(ip)) return localData

  const cached = cache.get(ip)
  if (cached && cached.expires > Date.now()) return cached.data

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { 'User-Agent': 'Eduzy-Security/1.0' },
      signal: ctrl.signal
    })
    clearTimeout(timer)

    if (!res.ok) return { ...localData, country: '?', city: '?', isp: '?' }
    const j = await res.json()
    if (j.error) return { ...localData, country: '?', city: '?', isp: '?' }

    const data = {
      country: j.country_name || j.country || '?',
      countryCode: j.country_code || j.country || '',
      region: j.region || j.region_code || '',
      city: j.city || '?',
      postal: j.postal || '',
      latitude: typeof j.latitude === 'number' ? j.latitude : null,
      longitude: typeof j.longitude === 'number' ? j.longitude : null,
      timezone: j.timezone || '',
      isp: j.org || '',
      asn: j.asn || ''
    }
    cache.set(ip, { data, expires: Date.now() + TTL })
    return data
  } catch {
    return { ...localData, country: '?', city: '?', isp: '?' }
  }
}

// Davlat bayrog'i emoji (countryCode'dan)
const flagEmoji = (cc) => {
  if (!cc || cc.length !== 2) return ''
  const A = 0x1F1E6
  return String.fromCodePoint(...cc.toUpperCase().split('').map(c => A + c.charCodeAt(0) - 65))
}

// Google Maps URL — koordinatalar bo'lsa
const mapsUrl = (lat, lng) => {
  if (lat == null || lng == null) return null
  return `https://www.google.com/maps?q=${lat},${lng}`
}

// To'liq inson o'qiy oladigan joylashuv satri
const formatLocation = (geo) => {
  if (!geo) return '?'
  const flag = flagEmoji(geo.countryCode)
  const parts = [
    geo.city && geo.city !== '?' ? geo.city : null,
    geo.region || null,
    geo.country && geo.country !== '?' ? geo.country : null
  ].filter(Boolean)
  return (flag ? flag + ' ' : '') + (parts.join(', ') || '?')
}

module.exports = { lookup, isPrivateIp, cleanIp, flagEmoji, mapsUrl, formatLocation }
