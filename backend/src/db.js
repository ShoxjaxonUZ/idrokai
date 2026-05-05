const { Pool } = require('pg')
require('dotenv').config()

// Cloud DB (Neon, Render, Heroku) DATABASE_URL beradi.
// Lokal dev DB_USER/DB_PASSWORD/... alohida.
const useDatabaseUrl = !!process.env.DATABASE_URL

// pg v9+ DATABASE_URL'dagi `sslmode=require` ni `verify-full` deb talqin qiladi
// va Neon self-signed sertifikat bilan ishlamaydi. Yechim:
// 1. URL'dan sslmode parametrini olib tashlash
// 2. SSL'ni explicit ravishda { rejectUnauthorized: false } bilan o'rnatish
const stripSslMode = (url) => {
  if (!url) return url
  try {
    const u = new URL(url)
    u.searchParams.delete('sslmode')
    return u.toString()
  } catch {
    return url
  }
}

const pool = useDatabaseUrl
  ? new Pool({
      connectionString: stripSslMode(process.env.DATABASE_URL),
      ssl: { rejectUnauthorized: false }
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: String(process.env.DB_PASSWORD),
      port: Number(process.env.DB_PORT)
    })

pool.connect()
  .then(() => console.log(`PostgreSQL ulandi! ✅ (${useDatabaseUrl ? 'cloud' : 'local'})`))
  .catch(err => console.error('PostgreSQL xatosi:', err.message))

module.exports = pool
