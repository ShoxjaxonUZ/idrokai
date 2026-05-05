const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { auth, teacherOrAdmin } = require('../middleware/auth')

// Relative URL qaytaramiz — frontend o'zi API_URL bilan birlashtiradi.
// Bu lokal va production'da bir xil ishlaydi (PUBLIC_BASE_URL ga muhtoj emas).

// Magic byte signatures — fayl haqiqatan o'sha turdaligini tekshiradi.
// MIME spoofing'dan himoya: hujumchi `image/png` deb yozsa-da, agar fayl PNG bo'lmasa, rad etiladi.
const MAGIC_BYTES = {
  'image/jpeg':  [[0xFF, 0xD8, 0xFF]],
  'image/jpg':   [[0xFF, 0xD8, 0xFF]],
  'image/png':   [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif':   [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp':  [[0x52, 0x49, 0x46, 0x46]], // RIFF (WEBP konteyneri)
  'video/mp4':   [[0x66, 0x74, 0x79, 0x70]], // 'ftyp' (4-baytdan keyin)
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'application/zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]]
}

// docx/pptx/xlsx aslida ZIP konteyneri — ulardan biri bo'ladi
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

const verifyMagicBytes = (filePath, declaredMime, ext) => {
  let fd
  try {
    fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(16)
    fs.readSync(fd, buf, 0, 16, 0)

    // MP4 uchun magic '4-7' baytlarda
    if (declaredMime === 'video/mp4') {
      return matchesMagic(buf, MAGIC_BYTES['video/mp4'], 4)
    }

    // ZIP-asosli office hujjatlar
    if (ZIP_BASED.includes(ext)) {
      return matchesMagic(buf, MAGIC_BYTES['application/zip'])
    }

    const sigs = MAGIC_BYTES[declaredMime]
    if (!sigs) return false
    return matchesMagic(buf, sigs)
  } catch {
    return false
  } finally {
    if (fd) try { fs.closeSync(fd) } catch {}
  }
}

const safeUnlink = (p) => {
  try { fs.unlinkSync(p) } catch {}
}

// =========== IMAGE UPLOAD ===========
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/images')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg'
    if (!/^\.[a-z0-9]+$/.test(ext)) return cb(new Error('Fayl kengaytmasi noto\'g\'ri'))
    cb(null, 'img-' + unique + ext)
  }
})

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif']
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Faqat rasm formatlari qabul qilinadi (JPG, PNG, WEBP, GIF)'))
    }
    cb(null, true)
  }
})

router.post('/image', auth, teacherOrAdmin, imageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Rasm yuklanmadi' })

  const ext = path.extname(req.file.filename).toLowerCase()
  if (!verifyMagicBytes(req.file.path, req.file.mimetype, ext)) {
    safeUnlink(req.file.path)
    return res.status(400).json({ message: 'Fayl haqiqiy rasm emas (magic bytes mos kelmadi)' })
  }

  const url = `/uploads/images/${req.file.filename}`
  res.json({ url, filename: req.file.filename, size: req.file.size })
})

// =========== VIDEO UPLOAD (FAQAT MP4) ===========
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/videos')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'video-' + unique + '.mp4')
  }
})

const videoUpload = multer({
  storage: videoStorage,
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

router.post('/video', auth, teacherOrAdmin, videoUpload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Video yuklanmadi' })

  if (!verifyMagicBytes(req.file.path, 'video/mp4', '.mp4')) {
    safeUnlink(req.file.path)
    return res.status(400).json({ message: 'Fayl haqiqiy MP4 video emas' })
  }

  const url = `/uploads/videos/${req.file.filename}`
  res.json({
    url,
    filename: req.file.filename,
    size: req.file.size,
    sizeMB: (req.file.size / (1024 * 1024)).toFixed(2)
  })
})

// =========== MATERIAL UPLOAD ===========
const materialStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/materials')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8)
    if (!/^\.[a-z0-9]+$/.test(ext)) return cb(new Error('Fayl kengaytmasi noto\'g\'ri'))
    cb(null, 'mat-' + unique + ext)
  }
})

const materialUpload = multer({
  storage: materialStorage,
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

router.post('/material', auth, teacherOrAdmin, materialUpload.single('material'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Material yuklanmadi' })

  const ext = path.extname(req.file.filename).toLowerCase()
  // Faqat magic bytes bilan tekshira oladiganlarini tekshiramiz
  // (.rar/.7z signaturlari mavjud-u, lekin ko'plab variantlar bor; oddiyligi uchun tashlab ketildi)
  if (ext === '.pdf') {
    if (!verifyMagicBytes(req.file.path, 'application/pdf', ext)) {
      safeUnlink(req.file.path)
      return res.status(400).json({ message: 'Fayl haqiqiy PDF emas' })
    }
  } else if (ZIP_BASED.includes(ext) || ext === '.zip') {
    if (!verifyMagicBytes(req.file.path, 'application/zip', ext)) {
      safeUnlink(req.file.path)
      return res.status(400).json({ message: 'Fayl haqiqiy ZIP/Office hujjat emas' })
    }
  }

  const url = `/uploads/materials/${req.file.filename}`
  res.json({
    url,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size
  })
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
