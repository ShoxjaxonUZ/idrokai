// PWA ikonlarini SVG'dan generatsiya qilish (desktop / laptop / mobil)
// Ishga tushirish: node scripts/gen-icons.js
// Talab: npm install --save-dev sharp

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error("❌ 'sharp' paketi yo'q. O'rnating: npm install --save-dev sharp")
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, '..', 'public')
const ICONS_DIR = path.join(PUBLIC, 'icons')
const SRC_SVG = path.join(PUBLIC, 'icon.svg')

if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true })

const svg = fs.readFileSync(SRC_SVG)

// Maskable icon — Android adaptive: kontent markaziy ~80% ichida bo'lishi kerak.
const MASKABLE_BG = '#5B5BD6'

// Oddiy ikonlar (any) — to'g'ridan-to'g'ri resize
const plain = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' }, // iOS
  { size: 96, name: 'icon-96.png' },           // shortcuts
]
for (const { size, name } of plain) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(ICONS_DIR, name))
  console.log(`OK icons/${name} (${size}x${size})`)
}

// Maskable — icon 78% o'lchamda, atrofida gradient fonli safe zona
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.78)
  const pad = Math.round((size - inner) / 2)
  const iconBuf = await sharp(svg, { density: 384 })
    .resize(inner, inner)
    .png()
    .toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: MASKABLE_BG }
  })
    .composite([{ input: iconBuf, top: pad, left: pad }])
    .png()
    .toFile(path.join(ICONS_DIR, `icon-${size}-maskable.png`))
  console.log(`OK icons/icon-${size}-maskable.png (${size}x${size})`)
}

// apple-touch-icon — public ildizida ham (iOS default qidiradi)
fs.copyFileSync(
  path.join(ICONS_DIR, 'apple-touch-icon.png'),
  path.join(PUBLIC, 'apple-touch-icon.png')
)
console.log('OK apple-touch-icon.png (public ildizida)')

// favicon — 32 va 48
for (const size of [32, 48]) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(PUBLIC, `favicon-${size}.png`))
  console.log(`OK favicon-${size}.png`)
}

console.log('\nBarcha ikonlar tayyor — public/icons/')
