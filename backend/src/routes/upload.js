const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { auth, teacherOrAdmin } = require('../middleware/auth')
const r2 = require('../lib/r2')

// STRATEGIYA: R2 sozlangan bo'lsa — Cloudflare R2 ga yuklanadi (production).
// Aks holda — lokal disk (development).
// Ikkala holatda ham magic byte verification ishlaydi.

// Magic byte signatures — fayl haqiqatan o'sha turdaligini tekshiradi.
const MAGIC_BYTES = {
  'image/jpeg':  [[0xFF, 0xD8, 0xFF]],
  'image/jpg':   [[0xFF, 0xD8, 0xFF]],
  'image/png':   [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif':   [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp':  [[0x52, 0x49, 0x46, 0x46]],
  'video/mp4':   [[0x66, 0x74, 0x79, 0x70]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'application/zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]]
}

const ZIP_BASED = ['.docx', '.pptx', '.xlsx']

const matchesMagic = (buf, signatures, offset = 0) => {
  return signatures.some(sig => {
    if (buf.length < offset + sig.length) return false
    for (let i = 0; i < sig.length; i++) {
      if (buf[offset + i] !== sig[i]) return false
    }
    return true
  })
}

// Buffer'dan tekshirish (memory storage uchun)
const verifyMagicBytesBuffer = (buf, declaredMime, ext) => {
  if (declaredMime === 'video/mp4') {
    return matchesMagic(buf, MAGIC_BYTES['video/mp4'], 4)
  }
  if (ZIP_BASED.includes(ext)) {
    return matchesMagic(buf, MAGIC_BYTES['application/zip'])
  }
  const sigs = MAGIC_BYTES[declaredMime]
  if (!sigs) return false
  return matchesMagic(buf, sigs)
}

// Memory storage — fayl bufferda saqlanadi, keyin R2'ga yuborilad yoki diskka yoziladi
const memoryStorage = multer.memoryStorage()

// Faylga noyob nom berish
const generateFilename = (originalname, prefix, defaultExt) => {
  const unique = Date.now() + '-' + Math.round(Math.random() * 1E9)
  let ext = path.extname(originalname || '').toLowerCase().slice(0, 8)
  if (!ext || !/^\.[a-z0-9]+$/.test(ext)) ext = defaultExt || '.bin'
  return `${prefix}-${unique}${ext}`
}

// Faylni R2'ga yoki lokal diskka saqlash
const persistFile = async ({ buffer, filename, contentType, subdir }) => {
  if (r2.isConfigured()) {
    // R2 — production
    const key = `${subdir}/${filename}`
    const url = await r2.uploadBuffer({ key, body: buffer, contentType })
    return { url, filename, key }
  }

  // Lokal disk — development
  const dir = path.join(__dirname, '../../uploads', subdir)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const filepath = path.join(dir, filename)
  fs.writeFileSync(filepath, buffer)
  return { url: `/uploads/${subdir}/${filename}`, filename, key: null }
}

// =========== IMAGE UPLOAD ===========
const imageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif']
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Faqat rasm formatlari qabul qilinadi (JPG, PNG, WEBP, GIF)'))
    }
    cb(null, true)
  }
})

router.post('/image', auth, teacherOrAdmin, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Rasm yuklanmadi' })

    const ext = path.extname(req.file.originalname || '').toLowerCase()
    if (!verifyMagicBytesBuffer(req.file.buffer.slice(0, 16), req.file.mimetype, ext)) {
      return res.status(400).json({ message: 'Fayl haqiqiy rasm emas (magic bytes mos kelmadi)' })
    }

    const filename = generateFilename(req.file.originalname, 'img', '.jpg')
    const result = await persistFile({
      buffer: req.file.buffer,
      filename,
      contentType: req.file.mimetype,
      subdir: 'images'
    })

    res.json({ url: result.url, filename: result.filename, size: req.file.size })
  } catch (err) {
    console.error('Image upload error:', err.message)
    res.status(500).json({ message: 'Yuklashda xatolik' })
  }
})

// =========== VIDEO UPLOAD (FAQAT MP4) ===========
const videoUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'video/mp4') {
      return cb(new Error('Faqat MP4 formatdagi video qabul qilinadi!'))
    }
    if (!file.originalname.toLowerCase().endsWith('.mp4')) {
      return cb(new Error('Fayl kengaytmasi .mp4 bo\'lishi kerak!'))
    }
    cb(null, true)
  }
})

router.post('/video', auth, teacherOrAdmin, videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Video yuklanmadi' })

    if (!verifyMagicBytesBuffer(req.file.buffer.slice(0, 16), 'video/mp4', '.mp4')) {
      return res.status(400).json({ message: 'Fayl haqiqiy MP4 video emas' })
    }

    const filename = generateFilename(req.file.originalname, 'video', '.mp4')
    const result = await persistFile({
      buffer: req.file.buffer,
      filename,
      contentType: 'video/mp4',
      subdir: 'videos'
    })

    res.json({
      url: result.url,
      filename: result.filename,
      size: req.file.size,
      sizeMB: (req.file.size / (1024 * 1024)).toFixed(2)
    })
  } catch (err) {
    console.error('Video upload error:', err.message)
    res.status(500).json({ message: 'Yuklashda xatolik' })
  }
})

// =========== MATERIAL UPLOAD ===========
const materialUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.zip', '.rar', '.pdf', '.docx', '.pptx', '.xlsx', '.7z']
    const ext = path.extname(file.originalname).toLowerCase()
    if (!allowed.includes(ext)) {
      return cb(new Error('Bu format qo\'llab-quvvatlanmaydi'))
    }
    cb(null, true)
  }
})

router.post('/material', auth, teacherOrAdmin, materialUpload.single('material'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Material yuklanmadi' })

    const ext = path.extname(req.file.originalname).toLowerCase()
    const head = req.file.buffer.slice(0, 16)

    if (ext === '.pdf') {
      if (!verifyMagicBytesBuffer(head, 'application/pdf', ext)) {
        return res.status(400).json({ message: 'Fayl haqiqiy PDF emas' })
      }
    } else if (ZIP_BASED.includes(ext) || ext === '.zip') {
      if (!verifyMagicBytesBuffer(head, 'application/zip', ext)) {
        return res.status(400).json({ message: 'Fayl haqiqiy ZIP/Office hujjat emas' })
      }
    }
    // .rar, .7z — magic byte tekshirilmaydi (turli xil variantlar bor)

    const filename = generateFilename(req.file.originalname, 'mat', '.bin')
    const result = await persistFile({
      buffer: req.file.buffer,
      filename,
      contentType: req.file.mimetype || 'application/octet-stream',
      subdir: 'materials'
    })

    res.json({
      url: result.url,
      filename: result.filename,
      originalName: req.file.originalname,
      size: req.file.size
    })
  } catch (err) {
    console.error('Material upload error:', err.message)
    res.status(500).json({ message: 'Yuklashda xatolik' })
  }
})

// Multer xatolarini ushlash
router.use((err, req, res, next) => {
  if (err) {
    console.error('Upload error:', err.message)
    return res.status(400).json({ message: err.message || 'Upload xatosi' })
  }
  next()
})

module.exports = router
