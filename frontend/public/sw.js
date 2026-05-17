// Eduzy Service Worker — basic offline cache
const CACHE_VERSION = 'eduzy-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const PRECACHE_URLS = [
  '/',
  '/favicon.svg',
  '/manifest.webmanifest'
]

// Install — precache asosiy fayllar
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

// Activate — eski cache'larni tozalash
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((n) => n !== STATIC_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  )
})

// Fetch — strategiya:
// - API so'rovlari (POST/PUT/DELETE va /api/*) — network only
// - Statik resurslar (CSS, JS, image) — cache first, network fallback
// - Navigation (HTML) — network first, offline'da cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Faqat o'z domain
  if (url.origin !== self.location.origin) return

  // API yoki write so'rovlari — to'g'ridan-to'g'ri network
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return

  // Navigation (HTML sahifa) — network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
          return res
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/')))
    )
    return
  }

  // Statik resurslar — cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        // Faqat OK javoblarni cache qilish
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
        }
        return res
      }).catch(() => cached)
    })
  )
})
