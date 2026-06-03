const pool = require('./src/db')
const bcrypt = require('bcryptjs')
require('dotenv').config()

async function seed() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = 'Admin'

  if (!email || !password) {
    console.error('ADMIN_EMAIL va ADMIN_PASSWORD .env da bo\'lishi shart')
    process.exit(1)
  }

  const exists = await pool.query('SELECT id, role FROM users WHERE email = $1', [email])
  if (exists.rows.length > 0) {
    if (exists.rows[0].role !== 'admin') {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', exists.rows[0].id])
      console.log('Admin roli yangilandi ✅')
    } else {
      console.log('Admin allaqachon mavjud!')
    }
    process.exit()
  }

  const hashed = await bcrypt.hash(password, 12)
  await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
    [name, email, hashed, 'admin']
  )
  console.log('Admin yaratildi! ✅')
  console.log('Email:', email)
  process.exit()
}

seed()
