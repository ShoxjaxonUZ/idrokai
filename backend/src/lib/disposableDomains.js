// Bir martalik (vaqtinchalik) email provayderlar — ro'yxatdan o'tishda taqiqlanadi.
// Ko'pi soxta hisoblar yaratish uchun ishlatiladi.
// To'liq ro'yxat: https://github.com/disposable-email-domains/disposable-email-domains

const DISPOSABLE = new Set([
  '10minutemail.com', '10minutemail.net', '20minutemail.com',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
  'mailinator.com', 'mailinator.net', 'mailinator.org',
  'temp-mail.org', 'tempmail.com', 'tempmail.io', 'tempmail.net',
  'throwawaymail.com', 'maildrop.cc', 'getnada.com', 'nada.email',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'fake-mail.net', 'fakeinbox.com', 'fakemail.com', 'fakemailgenerator.com',
  'trashmail.com', 'trashmail.net', 'trashmail.de',
  'mohmal.com', 'emailondeck.com', 'spambox.us',
  'dispostable.com', 'mailcatch.com', 'mintemail.com',
  'mytemp.email', 'mytrashmail.com', 'tempinbox.com',
  'inboxalias.com', 'inboxbear.com', 'inboxkitten.com',
  'jetable.org', 'mailnesia.com', 'meltmail.com',
  'mvrht.com', 'objectmail.com', 'odaymail.com',
  'rcpt.at', 'recode.me', 'rmqkr.net',
  'safetymail.info', 'selfdestructingmail.com', 'spamavert.com',
  'spambog.com', 'spambog.de', 'spambog.ru', 'spamfree24.com', 'spamfree24.de', 'spamfree24.eu',
  'spamfree24.info', 'spamfree24.net', 'spamfree24.org',
  'tempemail.net', 'tempinbox.com', 'temporarily.de', 'temporary-email.com', 'temporaryemail.net',
  'tempymail.com', 'thrott.com', 'tilien.com',
  'tmail.ws', 'trbvm.com', 'trialmail.de',
  'wegwerfemail.de', 'whyspam.me', 'wronghead.com',
  'yapped.net', 'youmailr.com', 'zoemail.org',
  // O'zbekistonda mashhur soxta:
  'mail.ru.com', 'gmail.fake', 'yahoo.fake', 'temp.uz'
])

// Mashhur va yaxshi email provayderlar (oq ro'yxat — bularga qo'shimcha tasdiqlash kerak emas)
const TRUSTED = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'mail.ru', 'yandex.ru', 'yandex.com', 'yandex.uz',
  'rambler.ru', 'list.ru', 'inbox.ru', 'bk.ru',
  'protonmail.com', 'proton.me',
  'umail.uz', 'edu.uz', 'tashkent.uz', 'beeline.uz', 'ucell.uz',
  'inbox.uz', 'fastmail.com', 'tutanota.com', 'zoho.com', 'aol.com'
])

const isDisposable = (email) => {
  if (typeof email !== 'string') return false
  const domain = email.toLowerCase().split('@')[1]
  if (!domain) return false
  return DISPOSABLE.has(domain)
}

const isTrusted = (email) => {
  if (typeof email !== 'string') return false
  const domain = email.toLowerCase().split('@')[1]
  if (!domain) return false
  return TRUSTED.has(domain)
}

// Email syntax + struktura tahlili (yuzaki tekshiruv)
const looksFake = (email) => {
  if (typeof email !== 'string') return true
  const lower = email.toLowerCase()
  const [local, domain] = lower.split('@')
  if (!local || !domain) return true

  // Juda qisqa local part (1-2 belgi) shubhali
  if (local.length < 2) return true

  // Faqat raqamlardan iborat bo'lgan local part shubhali (test123456@)
  if (/^\d+$/.test(local)) return true

  // 'test', 'fake', 'temp', 'admin', 'asdf' kabi obvious test username
  if (/^(test\d*|fake\d*|temp\d*|asdf\d*|qwerty\d*|spam\d*|bot\d*|null|undefined)$/i.test(local)) return true

  // Domen juda qisqa bo'lsa shubhali
  if (domain.length < 4) return true

  // Domain TLD'da raqam bo'lishi shubhali (a.b.5)
  const tld = domain.split('.').pop()
  if (!tld || tld.length < 2 || /\d/.test(tld)) return true

  return false
}

module.exports = { isDisposable, isTrusted, looksFake }
