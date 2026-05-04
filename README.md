# IdrokAI — O'zbek tilida bepul ta'lim platformasi

AI-powered ta'lim platformasi: kurslar, AI Teacher, kunlik masala, code battle, sertifikatlar.

## Stack

- **Frontend**: React 19 + Vite 8 + Tailwind 3 + React Router 7
- **Backend**: Node.js 20 + Express 5 + PostgreSQL
- **AI**: Groq (Llama 3.3 + Llama 4 Scout vision)
- **Email**: Nodemailer + SMTP (Gmail)
- **Notifications**: Telegram Bot API
- **Security**: Helmet, rate limiting, threat detector, JWT token versioning

## Lokalda ishga tushirish

### Talablar
- Node.js 20+
- PostgreSQL 14+

### Backend
```bash
cd backend
npm install
cp .env.example .env
# .env faylini tahrirlang (DB_*, JWT_SECRET, GROQ_API_KEY)
npm run dev
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Brauzerda: http://localhost:5173

## Deploy

To'liq ko'rsatma: [DEPLOY.md](./DEPLOY.md)

Tezkor: Vercel (frontend) + Render (backend) + Neon (DB) — barchasi bepul.

## Litsenziya

Barcha huquqlar himoyalangan © IdrokAI
