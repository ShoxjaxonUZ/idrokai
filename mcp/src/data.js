// Eduzy Market MCP — kuratsiya qilingan bilim bazasi (tadqiqotdan, manbalari bilan).
// Holat: 2026-06. Raqamlar ochiq manbalardan olingan; vaqti-vaqti bilan yangilab turing.

const sources = {
  datareportal: "https://datareportal.com/reports/digital-2025-uzbekistan",
  worldometer: "https://www.worldometers.info/demographics/uzbekistan-demographics/",
  timesca: "https://timesca.com/how-uzbekistan-plans-to-lead-central-asias-digital-future-an-interview-with-the-minister-of-digital-technologies/",
  itpark: "https://it-park.uz/en/itpark/news/gbsf-2025-outcomes-uzbekistan-strengthens-its-status-as-an-it-hub",
  wgu: "https://www.wgu.edu/blog/gen-z-education-younger-learners-online-degrees2509.html",
  raccoon: "https://raccoongang.com/blog/how-to-engage-gen-z-and-a-in-a-learning-process/",
  tcs: "https://www.tcs.com/what-we-do/industries/education/article/edtech-trends-2026-intelligence-redefining-learning-systems",
  kaopiz: "https://kaopiz.com/en/articles/trends-in-educational-technology/",
  matsh: "https://www.matsh.co/en/dropout-rates-in-online-training-programs-stats-and-insights/",
  learnstream: "https://learnstream.io/blog/what-is-the-average-online-course-completion-rate-and-why-does-it-matter/",
  mohirdev: "https://mohirdev.uz/",
  najot: "https://uz.linkedin.com/company/najottalim",
  coursera: "https://blog.coursera.org/2026s-fastest-growing-skills-and-top-learning-trends-from-2025/"
}

// 1-ip: talab (demografiya + raqamli qamrov)
const demographics = [
  { fact: "Aholi ~37 mln; 45.8% — 25 yoshgacha; median yosh 27.9; ~60% — 30 yoshgacha", src: ["worldometer"] },
  { fact: "Internet foydalanuvchilari 32.7 mln (89%); smartfon qamrovi ~77%", src: ["datareportal"] }
]

// Davlat shamoli
const state = [
  { fact: "\"Million dasturchi\" tugadi; \"Million AI lider\" — 2027 gacha (bepul aistudy.uz, omp.aistudy.uz)", src: ["timesca"] },
  { fact: "2030 strategiyasi: $5 mlrd IT eksport, 300 000 yoshga IT ish o'rni, yiliga 25 000 IT mutaxassis bitiradi", src: ["timesca", "itpark"] }
]

// 2-ip: yoshlar (Gen Z) nima hohlaydi
const youth = [
  { want: "Mobil-first", detail: "Gen Z'ning 94% telefonda o'qiydi; mobil eslab qolish ~45% yuqori", src: ["tcs", "kaopiz"] },
  { want: "AI ustoz", detail: "Shaxsiy, real-vaqt, 'qotib qolganda yo'l ochadigan' yordam", src: ["tcs"] },
  { want: "Gamifikatsiya + qilib o'rganish", detail: "Passiv tinglash emas — musobaqa, ball, daraja", src: ["raccoon", "kaopiz"] },
  { want: "Mikro-darslar (3–10 daq)", detail: "O'z tezligida; 72% shunda tugatishini aytadi", src: ["kaopiz", "learnstream"] },
  { want: "Ijtimoiy o'rganish", detail: "10 tadan 8 yosh do'sti bilan o'qishni afzal ko'radi", src: ["wgu"] },
  { want: "Natija (ish/daromad)", detail: "Kurs uchun emas — natija uchun to'laydi; 96% ish beruvchi micro-credential'ni qadrlaydi", src: ["coursera"] }
]

// 3-ip: asosiy dard — tugatmaslik
const completion = [
  { fact: "Onlayn kurs tugatish darajasi atigi 5–15% (MOOC)", src: ["matsh", "learnstream"] },
  { fact: "Coaching + jamoa qo'shilsa — 70%+ tugatadi", src: ["matsh"] }
]

// 4-ip: mahalliy raqobat
const competitors = [
  { name: "Mohirdev", note: "#1 brend, 50 000+ talaba, 50+ kurs, premium IT, o'zbek tilida", src: ["mohirdev"] },
  { name: "Najot Ta'lim", note: "8 500+ bitiruvchi, 75–85% ishga joylashish", src: ["najot"] },
  { name: "PDP Academy", note: "Ishga joylashtirishda yetakchi", src: [] },
  { name: "Davlat (aistudy.uz)", note: "Bepul AI o'quv platformalari — 'bepul AI bilan o'rganish' tovarga aylanyapti", src: ["timesca"] }
]

module.exports = { sources, demographics, state, youth, completion, competitors }
