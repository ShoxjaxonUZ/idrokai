// Micro-dars metama'lumotlari — har dars uchun taxminiy davomiylik (daqiqa).
// Maqsad: "qisqa, tugatish oson" (3–10 daq) darslar tuyg'usini berish.
// Dars obyektida `minutes` bo'lsa — o'sha ishlatiladi; bo'lmasa matndan taxminlanadi.

const WORDS_PER_MIN = 180   // o'rtacha o'qish tezligi
const VIDEO_BASE = 5        // video bo'lsa taxminan +5 daq

// Bitta dars uchun taxminiy daqiqa (3–20 oralig'ida)
export function estimateMinutes(lesson) {
  if (!lesson) return 4
  if (Number.isFinite(lesson.minutes) && lesson.minutes > 0) {
    return Math.min(120, Math.round(lesson.minutes))
  }
  const text = `${lesson.desc || ''} ${lesson.title || ''}`.trim()
  const words = text ? text.split(/\s+/).length : 0
  const est = Math.round(words / WORDS_PER_MIN) + (lesson.video ? VIDEO_BASE : 0)
  return Math.min(20, Math.max(3, est || 4))
}

// Mikro-dars: 10 daqiqa yoki undan kam
export function isMicro(lesson) {
  return estimateMinutes(lesson) <= 10
}

export function formatMinutes(min) {
  const m = Math.round(min || 0)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const r = m % 60
    return r ? `${h} soat ${r} daq` : `${h} soat`
  }
  return `${m} daq`
}

// Kurs uchun jami taxminiy vaqt
export function totalMinutes(lessons) {
  return (lessons || []).reduce((sum, l) => sum + estimateMinutes(l), 0)
}
