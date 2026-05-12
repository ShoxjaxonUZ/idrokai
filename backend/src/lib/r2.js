// Cloudflare R2 storage — S3-mos.
// Env vars (production'da Render'da, dev'da .env'da):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
// Hech qaysi bo'lmasa: isConfigured() false qaytaradi, kod fallback'ga (lokal disk) o'tadi.

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET = process.env.R2_BUCKET
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '') // trailing slash olib tashlash

const isConfigured = () => Boolean(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET && PUBLIC_URL)

let client = null
if (isConfigured()) {
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY
    }
  })
  console.log(`📦 R2 storage yoqildi (bucket: ${BUCKET})`)
} else {
  console.log('📁 R2 storage o\'chirilgan — lokal disk ishlatiladi')
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
