// Modul testi savollarini userga "shaxsiylashtirish" — keshlangan savollar
// barcha userlarda bir xil javob kaliti bo'lib qolmasligi uchun savol va
// variant tartibini aralashtiramiz, correct indeksni yangi joyiga moslaymiz.

// Fisher–Yates — mutatsiyasiz nusxa qaytaradi
const shuffled = (arr) => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// questions: [{question, options:[4], correct:0-3}, ...]
// Qaytaradi: o'sha savollar, ammo aralashtirilgan tartibda, correct to'g'ri.
const personalize = (questions) => shuffled(questions).map((q) => {
  const order = shuffled(q.options.map((_, i) => i)) // eski indekslar yangi tartibda
  const options = order.map((oldIdx) => q.options[oldIdx])
  const correct = order.indexOf(q.correct)
  return { question: q.question, options, correct }
})

module.exports = { shuffled, personalize }
