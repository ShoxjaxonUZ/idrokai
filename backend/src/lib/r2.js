// S3-mos object storage (Cloudflare R2 yoki Backblaze B2).
// Env vars:
//   R2_ENDPOINT       — to'liq endpoint URL (B2 uchun majburiy)
//                       Yoki R2_ACCOUNT_ID berib R2 endpoint avtomatik tuziladi
//   R2_ACCESS_KEY_ID  — provayder Access Key ID (R2) yoki keyID (B2)
//   R2_SECRET_ACCESS_KEY — Secret Access Key (R2) yoki applicationKey (B2)
//   R2_BUCKET         — bucket nomi
//   R2_PUBLIC_URL     — public URL prefiksi (fayl URL'larini yasash uchun)
//   R2_REGION         — ixtiyoriy, default 'auto'
// Hech qaysi bo'lmasa: isConfigured() false qaytaradi, kod fallback'ga (lokal disk) o'tadi.

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET = process.env.R2_BUCKET
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '') // trailing slash olib tashlash
const REGION = process.env.R2_REGION || 'auto'

// Endpoint: ENDPOINT to'g'ridan-to'g'ri berilsa shuni ishlatamiz (B2),
// aks holda ACCOUNT_ID'dan R2 endpointini yasaymiz
const ENDPOINT = process.env.R2_ENDPOINT ||
  (ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : null)

const isConfigured = () => Boolean(ENDPOINT && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET && PUBLIC_URL)

let client = null
if (isConfigured()) {
  client = new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY
    },
    // R2 va AWS SDK v3 mosligi uchun: SDK avtomatik checksum header'larini
    // qo'shmasligi kerak (R2 ba'zi qo'shimcha header'lar uchun 401 qaytaradi).
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  })
  console.log(`📦 Object storage yoqildi (bucket: ${BUCKET}, endpoint: ${ENDPOINT})`)
} else {
  console.log('📁 Object storage o\'chirilgan — lokal disk ishlatiladi')
}

// Bufferdan R2'ga yuklash. Key — bucket ichidagi yo'l (e.g., "images/img-xxx.jpg")
const uploadBuffer = async ({ key, body, contentType }) => {
  if (!client) throw new Error('R2 sozlanmagan')
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    // Cache 30 kun
    CacheControl: 'public, max-age=2592000, immutable'
  }))
  return `${PUBLIC_URL}/${key}`
}

// Faylni o'chirish (ixtiyoriy — kelajakda kerak bo'lsa)
const deleteObject = async (key) => {
  if (!client) return
  try {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  } catch (err) {
    console.warn('R2 delete xatosi:', err.message)
  }
}

// Public URL'dan bucket key'ni ajratish (delete uchun kerak)
const keyFromUrl = (url) => {
  if (!url || !PUBLIC_URL) return null
  if (!url.startsWith(PUBLIC_URL)) return null
  return url.slice(PUBLIC_URL.length + 1)
}

module.exports = {
  isConfigured,
  uploadBuffer,
  deleteObject,
  keyFromUrl,
  PUBLIC_URL
}
