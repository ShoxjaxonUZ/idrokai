const { Pool } = require('pg')
require('dotenv').config()

// Cloud DB (Neon, Render, Heroku) DATABASE_URL beradi.
// Lokal dev DB_USER/DB_PASSWORD/... alohida.
const useDatabaseUrl = !!process.env.DATABASE_URL

const pool = useDatabaseUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Neon/Render uchun majburiy
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
