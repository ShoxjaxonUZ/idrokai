// Express middleware — har bir so'rovda hujum naqshlarini topadi.
// Aniqlangan hujumlarni DB ga yozadi va Telegram'ga xabar yuboradi.
//
// MUHIM: hujumchi sezmasligi uchun BIZ HEECH NARSANI O'ZGARTIRMAYMIZ —
// so'rov o'z yo'lida o'tib ketadi (allaqachon parametrli SQL/auth/rate limit
// uni baribir bloklaydi). Biz faqat *kuzatamiz* va xabar beramiz.

const pool = require('../db')
const geoip = require('../lib/geoip')
const telegram = require('../lib/telegram')

// Naqsh ro'yxatlari — har biri (regex, name) shaklida.
// ESLATMA: regexlar o'zlarida ReDoS bo'lmasligi uchun cheklangan.

// 1. SQL injection naqshlari
const SQL_PATTERNS = [
  { re: /\bunion\s+(all\s+)?select\b/i,                  name: 'UNION SELECT' },
  { re: /(\b|')or\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i,      name: 'OR 1=1' },
  { re: /;\s*(drop|delete|update|insert)\s+/i,            name: 'SQL chained' },
  { re: /\b(exec|execute)\s*\(/i,                        name: 'EXEC()' },
  { re: /\bxp_cmdshell\b/i,                              name: 'xp_cmdshell' },
  { re: /\binformation_schema\b/i,                       name: 'information_schema' },
  { re: /\bsleep\s*\(\s*\d+/i,                           name: 'SLEEP() injection' },
  { re: /\bbenchmark\s*\(/i,                             name: 'BENCHMARK injection' },
  { re: /--\s|#\s|\/\*[\s\S]*?\*\//,                     name: 'SQL comment' },
  { re: /\bload_file\s*\(/i,                             name: 'LOAD_FILE()' }
]

// 2. XSS naqshlari
const XSS_PATTERNS = [
  { re: /<script\b[^>]*>/i,           name: '<script>' },
  { re: /<\/script>/i,                name: '</script>' },
  { re: /\bon(error|load|click|focus|mouseover|submit)\s*=/i, name: 'on*=' },
  { re: /javascript:/i,               name: 'javascript:' },
  { re: /vbscript:/i,                 name: 'vbscript:' },
  { re: /<iframe\b[^>]*>/i,           name: '<iframe>' },
  { re: /<svg\b[^>]*\bon\w+/i,        name: '<svg onx>' },
  { re: /document\.cookie/i,          name: 'document.cookie' },
  { re: /String\.fromCharCode/i,      name: 'String.fromCharCode' }
]

// 3. Path traversal
const PATH_TRAVERSAL = [
  { re: /\.\.\//,             name: '../' },
  { re: /\.\.\\/,             name: '..\\' },
  { re: /%2e%2e%2f/i,         name: '%2e%2e/' },
  { re: /%2e%2e\//i,          name: 'mixed traversal' },
  { re: /\/etc\/(passwd|shadow|hosts)/i, name: '/etc/passwd' },
  { re: /\/proc\/self/i,      name: '/proc/self' }
]

// 4. Command injection
const CMD_INJECTION = [
  { re: /[;|&`$]\s*(cat|ls|wget|curl|nc|bash|sh|powershell|cmd)\s/i, name: 'shell command' },
  { re: /\$\([^)]+\)/,                 name: '$()' },
  { re: /`[^`]{2,}`/,                  name: 'backticks' }
]

// 5. Skanerlar (User-Agent)
const SCANNER_UA = [
  { re: /sqlmap/i,        name: 'sqlmap' },
  { re: /nikto/i,         name: 'nikto' },
  { re: /nmap/i,          name: 'nmap' },
  { re: /masscan/i,       name: 'masscan' },
  { re: /\bzgrab\b/i,     name: 'zgrab' },
  { re: /\bnuclei\b/i,    name: 'nuclei' },
  { re: /\bferoxbuster\b/i, name: 'feroxbuster' },
  { re: /\bgobuster\b/i,  name: 'gobuster' },
  { re: /\bdirbuster\b/i, name: 'dirbuster' },
  { re: /burp\s*suite/i,  name: 'burpsuite' },
  { re: /owasp\s*zap/i,   name: 'owasp-zap' },
  { re: /acunetix/i,      name: 'acunetix' },
  { re: /netsparker/i,    name: 'netsparker' },
  { re: /\bw3af\b/i,      name: 'w3af' },
  { re: /\bwpscan\b/i,    name: 'wpscan' },
  { re: /\bcurl\/[\d.]+\b/i, name: 'curl' }, // medium severity
  { re: /\bpython-requests\b/i, name: 'python-requests' } // medium
]

// 6. Tergov yo'llari (probe paths) — admin/login/.env/wp-admin va h.k.
const PROBE_PATHS = [
  { re: /\/\.env(\.|$|\/)/i,           name: '.env file' },
  { re: /\/\.git\//i,                  name: '.git directory' },
  { re: /\/\.aws\//i,                  name: '.aws config' },
  { re: /\/\.ssh\//i,                  name: '.ssh directory' },
  { re: /\/wp-(login|admin|config|content)/i, name: 'WordPress probe' },
  { re: /\/phpmyadmin/i,               name: 'phpMyAdmin' },
  { re: /\/(config|database|db|secret|backup|backups|dump)\.(json|yml|yaml|sql|bak|zip)/i, name: 'config/dump file' },
  { re: /\/(\.htaccess|\.htpasswd)/i,  name: '.htaccess' },
  { re: /\/(actuator|console|debug|server-status|server-info)/i, name: 'admin endpoint probe' },
  { re: /\/cgi-bin\//i,                name: 'cgi-bin' },
  { re: /\/(adminer|phpinfo)/i,        name: 'adminer/phpinfo' }
]

// Tekshirish funksiyasi — naqsh ro'yxatidan birinchi mosini qaytaradi yoki null
const matchAny = (text, list) => {
  if (!text) return null
  for (const p of list) {
    if (p.re.test(text)) return p.name
  }
  return null
}

// Asosiy tekshiruv: req obyektidan toifa va naqshni qaytaradi
const detect = (req) => {
  const url = req.originalUrl || req.url || ''
  const ua = req.headers['user-agent'] || ''
  const referer = req.headers.referer || ''

  // Body'ni string'ga aylantirib tekshiramiz (chuqur scan emas — payload katta bo'lsa kesiladi)
  let bodyStr = ''
  try {
    if (req.body && typeof req.body === 'object') {
      bodyStr = JSON.stringify(req.body).slice(0, 8000)
    }
  } catch {}

  // Query string ham
  const queryStr = url.includes('?') ? url.slice(url.indexOf('?')) : ''
  const surface = `${url} ${queryStr} ${bodyStr} ${referer}`

  // Probe path — IP'ga zarar yo'q lekin scanning belgisi
  const probe = matchAny(url, PROBE_PATHS)
  if (probe) return { category: 'probe', severity: 'high', pattern: probe }

  // Skanerlar
  const scanner = matchAny(ua, SCANNER_UA)
  if (scanner) {
    const sev = ['curl', 'python-requests'].includes(scanner) ? 'medium' : 'high'
    return { category: 'scanner', severity: sev, pattern: scanner }
  }

  // SQL injection
  const sqli = matchAny(surface, SQL_PATTERNS)
  if (sqli) return { category: 'sqli', severity: 'critical', pattern: sqli }

  // XSS
  const xss = matchAny(surface, XSS_PATTERNS)
  if (xss) return { category: 'xss', severity: 'critical', pattern: xss }

  // Path traversal
  const pt = matchAny(url + ' ' + bodyStr, PATH_TRAVERSAL)
  if (pt) return { category: 'path_traversal', severity: 'high', pattern: pt }

  // Command injection
  const cmd = matchAny(bodyStr, CMD_INJECTION)
  if (cmd) return { category: 'cmd_injection', severity: 'critical', pattern: cmd }

  // Bo'sh User-Agent (oddiy bot)
  if (!ua) return { category: 'no_user_agent', severity: 'low', pattern: 'empty UA' }

  return null
}

// Hujumchi sezmasligi uchun async yozish — request'ga ta'sir qilmaydi
const logAttack = (req, threat) => {
  const ip = (req.ip || req.socket?.remoteAddress || '0.0.0.0').replace(/^::ffff:/, '')
  const ua = (req.headers['user-agent'] || '').slice(0, 500)
  const url = (req.originalUrl || req.url || '').slice(0, 1000)
  const method = req.method || ''
  const userId = req.user?.id || null

  let payloadStr = ''
  try {
    payloadStr = req.body ? JSON.stringify(req.body).slice(0, 4000) : ''
  } catch {}

  // Async fire-and-forget — request bloklanmaydi
  ;(async () => {
    let geo = {
      country: '?', countryCode: '', region: '', city: '?',
      postal: '', latitude: null, longitude: null,
      timezone: '', isp: '?', asn: ''
    }
    try {
      geo = await geoip.lookup(ip)
    } catch {}

    const entry = {
      ip,
      user_agent: ua,
      method,
      url,
      category: threat.category,
      severity: threat.severity,
      pattern: threat.pattern,
      payload: payloadStr,
      user_id: userId,
      country: geo.country,
      city: geo.city,
      isp: geo.isp,
      region: geo.region,
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezone: geo.timezone,
      postal: geo.postal,
      asn: geo.asn,
      countryCode: geo.countryCode,
      details: { headers: { referer: req.headers.referer, origin: req.headers.origin } }
    }

    try {
      await pool.query(
        `INSERT INTO attack_logs
         (ip, user_agent, method, url, category, severity, pattern, payload,
          user_id, country, city, isp, region, latitude, longitude, timezone, postal, asn, details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          entry.ip, entry.user_agent, entry.method, entry.url,
          entry.category, entry.severity, entry.pattern, entry.payload,
          entry.user_id, entry.country, entry.city, entry.isp,
          entry.region, entry.latitude, entry.longitude, entry.timezone,
          entry.postal, entry.asn,
          JSON.stringify(entry.details)
        ]
      )
    } catch (err) {
      console.error('[Threat] DB log fail:', err.message)
    }

    // Telegram'ga jim xabar (faqat medium va undan yuqori)
    if (threat.severity !== 'low') {
      telegram.sendAttackAlert(entry).catch(() => {})
    }
  })()
}

// Express middleware
const threatDetector = (req, res, next) => {
  try {
    const threat = detect(req)
    if (threat) {
      console.log(`[Threat] ${threat.severity.toUpperCase()} ${threat.category} (${threat.pattern}) — ${req.method} ${req.url}`)
      logAttack(req, threat)
    }
  } catch (err) {
    console.error('[Threat] detector error:', err.message)
  }
  next()
}

// Failed login uchun maxsus log (auth.js dan chaqiriladi)
const logFailedLogin = (req, email) => {
  logAttack(req, {
    category: 'failed_login',
    severity: 'low',
    pattern: `email=${(email || '').slice(0, 100)}`
  })
}

module.exports = { threatDetector, logFailedLogin, detect }
