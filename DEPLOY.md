# 🚀 Eduzy — Bepul Deploy Qo'llanmasi

Saytni internetga **butunlay bepul** chiqarish uchun:
- **Frontend** → Vercel
- **Backend** → Render
- **Database** → Neon
- **Backend keep-alive** → UptimeRobot

**Jami vaqt:** ~30-45 daqiqa

---

## 📋 Bosqich 0: Tayyorgarlik

Sizda quyidagi akkauntlar kerak (hammasi bepul):
- ✅ GitHub
- ⬜ [Neon.tech](https://neon.tech) — DB (GitHub orqali ro'yxatdan o'tish)
- ⬜ [Render.com](https://render.com) — backend (GitHub orqali)
- ⬜ [Vercel.com](https://vercel.com) — frontend (GitHub orqali)
- ⬜ [UptimeRobot.com](https://uptimerobot.com) — keep-alive

---

## 📦 Bosqich 1: GitHub'ga yuklash

### 1.1. Yangi repo yarating
GitHub.com → yashil **"New"** tugma → repo nomi: `eduzy` → **Private** tanlang → **Create repository**

### 1.2. Lokalda terminalda (loyiha papkasida):

```bash
cd d:/Desktop/eduuz1

git init
git add .
git commit -m "Eduzy: dastlabki commit"
git branch -M main

# GitHub repo URL'ini nusxalang (yashil "Code" tugma) va quyidagi joyga qo'ying:
git remote add origin https://github.com/SIZNING-USERNAME/eduzy.git

git push -u origin main
```

> ⚠️ Birinchi push'da GitHub username/parol so'raydi. Parol o'rniga **Personal Access Token** kerak — https://github.com/settings/tokens → "Generate new token (classic)" → `repo` ruxsatini bering → tokenni nusxalab parol o'rniga yopishtiring.

✅ **Endi loyihangiz GitHub'da.**

---

## 🗄 Bosqich 2: Neon — PostgreSQL Database

1. **https://neon.tech** ga kiring → **"Sign up with GitHub"**
2. Birinchi marta kirsangiz: avtomatik proyekt yaratiladi yoki **"Create Project"** bosing
3. Sozlamalar:
   - **Project name**: `eduzy`
   - **Database name**: `eduzy`
   - **Region**: **AWS Frankfurt** (eu-central-1) — eng tez O'zbekistondan
   - **Postgres version**: 16 (default)
4. **"Create project"** bosing
5. **Connection string** chiqadi (yashil **"Show password"** tugmasi orqali):
   ```
   postgresql://user:password@ep-xxxxx.eu-central-1.aws.neon.tech/eduzy?sslmode=require
   ```
6. **Bu havolani saqlab qo'ying** — keyingi bosqichda kerak.

✅ **DB tayyor.**

---

## ⚙️ Bosqich 3: Render — Backend

### 3.1. Render'ga kiring
**https://render.com** → **"Get Started"** → **"GitHub"** orqali login

### 3.2. Yangi Web Service
1. Yashil **"New +"** tugma → **"Web Service"**
2. **"Connect a repository"** → `eduzy` repongizni tanlang → **"Connect"**

### 3.3. Sozlamalar
| Maydon | Qiymat |
|--------|--------|
| **Name** | `eduzy-api` |
| **Region** | **Frankfurt (EU Central)** |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** |

### 3.4. Environment Variables (eng muhim qism!)

Pastga aylanring → **"Environment Variables"** bo'limi → har biri uchun **"Add Environment Variable"** bosib qo'ying:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | (Neon'dan olgan connection string) |
| `JWT_SECRET` | (kuchli random string — pastdagi buyruq orqali olishingiz mumkin) |
| `ADMIN_EMAIL` | (o'zingizning admin emailingiz) |
| `ADMIN_PASSWORD` | ⚠️ **KUCHLI, UNIK parol qo'ying** — hech qachon hujjatdagi namunani ishlatmang. Kamida 12 belgi, katta/kichik harf, raqam, belgi. |
| `GROQ_API_KEY` | (sizdagi `gsk_...` kalit) |
| `CORS_ORIGIN` | `https://eduzy.vercel.app` (Vercel deploy'dan keyin yangilanadi) |
| `APP_URL` | `https://eduzy.vercel.app` |
| `TELEGRAM_BOT_TOKEN` | (sizniki) |
| `TELEGRAM_CHAT_ID` | (sizniki) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | (sizning gmail) |
| `SMTP_PASS` | (Google App Password — quyida ko'rsatma) |
| `SMTP_FROM` | `Eduzy <noreply@eduzy.uz>` |

**JWT_SECRET yaratish** (lokalda bir marta):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3.5. Deploy qiling
**"Create Web Service"** bosing → 5-7 daqiqa kuting.

Logs'da `🚀 Server 10000 portda ishlamoqda` chiqsa — backend ishladi!

URL: `https://eduzy-api.onrender.com` (yoki sizga berilgan).

**Test:** brauzerda `https://eduzy-api.onrender.com/health` ni oching → `{"status":"ok"}` chiqishi kerak.

✅ **Backend production'da.**

---

## 🌐 Bosqich 4: Vercel — Frontend

### 4.1. Vercel'ga kiring
**https://vercel.com** → **"Continue with GitHub"**

### 4.2. Yangi proyekt
1. **"Add New..."** → **"Project"**
2. `eduzy` repo ro'yxatda paydo bo'ladi → **"Import"**

### 4.3. Sozlamalar
| Maydon | Qiymat |
|--------|--------|
| **Project Name** | `eduzy` |
| **Framework Preset** | Vite (avtomatik aniqlanadi) |
| **Root Directory** | **"Edit"** bosib → `frontend` ni tanlang |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `dist` (default) |

### 4.4. Environment Variables
**"Environment Variables"** bo'limini oching:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://eduzy-api.onrender.com` (Render'dan olingan URL) |

### 4.5. Deploy
**"Deploy"** tugmasini bosing → 1-2 daqiqa.

URL: `https://eduzy.vercel.app` (yoki shunga o'xshash).

✅ **Frontend production'da.**

---

## 🔄 Bosqich 5: CORS_ORIGIN ni yangilash

Endi Vercel URL'ini bilamiz, Render'dagi `CORS_ORIGIN` ni yangilash kerak:

1. Render dashboard → `eduzy-api` proyekti → **"Environment"** tab
2. `CORS_ORIGIN` ni toping → **Edit** → qiymatni Vercel URL'ga o'zgartiring:
   ```
   https://eduzy.vercel.app
   ```
3. **"Save Changes"** → backend avtomatik qayta deploy bo'ladi (~2 daq)

`APP_URL` ham xuddi shunday yangilang.

---

## ⏰ Bosqich 6: UptimeRobot — Backend uxlamasligi uchun

Render Free plan'da backend 15 daqiqa ishlatilmasa "uxlaydi" (cold start ~30s). UptimeRobot har 5 daqiqada ping yuborib backend'ni "tirik" tutadi.

1. **https://uptimerobot.com** → **"Sign Up Free"**
2. Email tasdiqlang → login
3. **"Add New Monitor"**
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: `Eduzy Backend`
   - **URL**: `https://eduzy-api.onrender.com/health`
   - **Monitoring Interval**: **5 minutes**
4. **"Create Monitor"**

✅ **Endi backend 24/7 tirik.**

---

## 📧 Bosqich 7: Gmail App Password (email tasdiqlash uchun)

Foydalanuvchilar haqiqiy email orqali ro'yxatdan o'tishi uchun:

1. **https://myaccount.google.com/security** ga kiring
2. **2-Step Verification** yoqilgan bo'lishi shart (yoqilmagan bo'lsa avval yoqing)
3. **https://myaccount.google.com/apppasswords** ga kiring
4. **App name**: `Eduzy`
5. **Generate** bosing → **16-belgili parolni nusxalang** (masalan: `abcd efgh ijkl mnop`)
6. Render dashboard → `eduzy-api` → Environment:
   - `SMTP_USER` = `sizninggmail@gmail.com`
   - `SMTP_PASS` = nusxalangan 16-belgili parol (bo'shliqsiz: `abcdefghijklmnop`)
7. Save → backend qayta deploy

**Test:** Saytdan ro'yxatdan o'tib ko'ring → emailga link kelishi kerak.

---

## ✅ Bosqich 8: Yakuniy test

1. **Frontend**: `https://eduzy.vercel.app` ochiladimi?
2. **Health check**: `https://eduzy-api.onrender.com/health` → `{"status":"ok"}` qaytaradimi?
3. **Register**: yangi haqiqiy email bilan ro'yxatdan o'ting → emailga link kelishi
4. **Login**: tasdiqlangandan keyin login ishlaydimi?
5. **Admin**: o'zingiz `ADMIN_EMAIL`/`ADMIN_PASSWORD`'da qo'ygan ma'lumot bilan kiring → `/admin` ochiladimi?
6. **Telegram**: Telegram'da xavfsizlik xabari kelganmi?

Hammasi ✅ bo'lsa — investorlarga `https://eduzy.vercel.app` URL'ini yuborishingiz mumkin!

---

## 🆘 Muammolar va Yechimlar

### Backend deploy paytida xato
- **"Cannot find module"** → `package.json`'da `dependencies` to'g'ri ekanligini tekshiring
- **"DATABASE_URL not set"** → Render env variables'da DATABASE_URL borligini tekshiring
- **"Migration failed"** → Neon dashboard'da DB ulanish ishlayotganini tekshiring

### Frontend backend bilan bog'lanmayapti
- Brauzer DevTools (F12) → Network → so'rov qaysi URL'ga ketayotganini ko'ring
- `VITE_API_URL` to'g'ri o'rnatilganmi tekshiring
- `CORS_ORIGIN` Vercel URL'ga to'liq mosmi (`https://...`)

### Render Free plan tugadi
- Cold start juda uzun bo'lyaptimi → UptimeRobot 5 daq ping yuborayotganini tekshiring
- 750 soat/oy limitiga yaqinmi → bittadan ko'p service yo'qligiga ishonch hosil qiling

### Email yuborilmayapti
- Gmail App Password 16 belgi va bo'shliqsiz bo'lishi kerak
- Gmail account 2FA yoqilgan bo'lishi shart
- "Less secure apps" KERAK EMAS — App Password yetarli

---

## 🎓 Investor demo uchun maslahat

1. **Demo akkaunt** yarating: `demo@eduzy.uz` / `DemoUser123` — kurs ro'yxatdan o'tgan, ba'zi darslar tugatilgan
2. **Sample data**: 3-5 ta kurs, 5-10 ta foydalanuvchi yarating
3. **Battle demo**: ikkita brauzerda ikkita akkaunt bilan battle o'ynab ko'ring (investor ishlayotganini ko'rishi uchun)
4. **AI Teacher**: matematika/dasturlash savollar bilan AI'ni sinab ko'ring
5. **Sertifikat**: bitta foydalanuvchi kursni tugatib sertifikat olganini ko'rsating

**Qisqa pitch**:
> "Eduzy — O'zbek tilida bepul AI-ta'lim platformasi. AI Teacher, kunlik masalalar, code battle va sertifikatlar bilan foydalanuvchilarni intensiv ravishda o'rgatadi."

---

## 🚀 Keyingi qadamlar (deploy'dan keyin)

- [ ] Domen sotib olish: `eduzy.uz` (uznic.uz, ~80,000 so'm/yil)
- [ ] Vercel'da custom domain ulash
- [ ] Render'da custom domain ulash
- [ ] Cloudflare orqali DDoS himoyasi (bepul)
- [ ] Sentry — xato kuzatish (bepul plan)
- [ ] Google Analytics ko'rsatkichlari kuzatish

Omad! 🎉
