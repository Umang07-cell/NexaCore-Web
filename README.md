# NexaCore — Full-Stack Setup Guide

## Stack
- **Frontend**: HTML/CSS/JS (served by Express)
- **Backend**: Node.js + Express
- **Database**: MongoDB (mongoose)
- **Auth**: JWT in HttpOnly cookies + Bcrypt password hashing
- **Email**: Nodemailer (for OTP at registration only)
- **Security**: Helmet, CORS, rate limiting, CSRF, mongo-sanitize, express-validator

---

## Prerequisites
- Node.js (already installed)
- MongoDB (already installed and running on port 27017)

---

## Setup Steps

### 1. Enter the backend folder
```bash
cd backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```

Edit `.env` and fill in at minimum:
```env
JWT_SECRET=any-long-random-string-here

# Email (for OTP at signup) — use Gmail App Password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-app-password
MAIL_FROM=NexaCore <your-gmail@gmail.com>
```

> **Gmail tip**: Go to Google Account → Security → 2-Step Verification → App passwords → generate one for "Mail".

> **Dev mode**: If SMTP is not configured, OTP will be printed to the terminal console and also shown on the signup page. This lets you test without email.

### 4. Make sure MongoDB is running
```bash
# Windows
net start MongoDB

# macOS/Linux
mongod --fork --logpath /var/log/mongodb.log
# or
brew services start mongodb-community
```

### 5. Start the server
```bash
node server.js
```

The app runs at: **http://localhost:3000**

---

## How It Works

### Registration flow
1. User fills signup form → POST `/api/auth/signup`
2. Server creates unverified user in MongoDB (password bcrypt-hashed)
3. OTP generated and emailed (or printed to console in dev mode)
4. User enters OTP on `/Pages/otp.html` → POST `/api/auth/verify-otp`
5. Account marked verified, JWT set in HttpOnly cookie → redirect to dashboard

### Login flow (no OTP)
1. User enters email + password → POST `/api/auth/login`
2. Server checks credentials (bcrypt compare)
3. If verified: JWT set in HttpOnly cookie → redirect to dashboard
4. **OTP is NOT sent during login** — only during registration

### Session validation
- Every protected page calls `/api/auth/me` on load
- If cookie is missing/expired/invalid → redirect to login
- Logout: POST `/api/auth/logout` → clears cookie, clears sessionStorage → redirect to home

### Cancel Service flow
- User clicks Cancel on a service → POST `/api/services/cancel`
- Service status set to `cancelled` in MongoDB
- Service disappears from active list and reappears in "Available Services" (can be re-requested)

---

## Security Features
| Feature | Implementation |
|---|---|
| Password hashing | bcryptjs (12 rounds) |
| JWT storage | HttpOnly cookie (not localStorage) |
| CSRF | Double-submit cookie pattern |
| Rate limiting | 10 login attempts per 15 min |
| NoSQL injection | express-mongo-sanitize |
| Input validation | express-validator on all routes |
| HTTP headers | helmet |
| Back-button guard | `history.replaceState` + popstate listener |
| Session refresh | `/api/auth/me` called on every protected page load |

---

## File Structure
```
nexacore_upgraded/
├── backend/
│   ├── server.js           ← Express app entry point
│   ├── package.json
│   ├── .env.example        ← Copy to .env and fill in
│   ├── .gitignore
│   ├── models/
│   │   ├── User.js         ← MongoDB user schema (bcrypt)
│   │   └── Service.js      ← MongoDB service schema
│   ├── routes/
│   │   ├── auth.js         ← signup, login, verify-otp, logout, /me
│   │   ├── services.js     ← list, request, cancel services
│   │   ├── contact.js      ← contact form
│   │   └── user.js         ← profile
│   ├── middleware/
│   │   └── auth.js         ← JWT protect + CSRF check
│   └── utils/
│       └── mailer.js       ← Nodemailer OTP + contact email
└── public/
    ├── Pages/
    │   ├── index.html      ← Home
    │   ├── login.html      ← Login (no OTP)
    │   ├── signup.html     ← Signup (triggers OTP email)
    │   ├── otp.html        ← Email verification (registration only)
    │   ├── dashboard.html  ← Protected client dashboard
    │   ├── my-services.html← Services with Cancel button
    │   └── ...             ← Other static pages
    ├── CSS/
    └── JS/
        └── script.js       ← All frontend JS (API-backed)
```

---

## Deployment Notes
When deploying to production:
1. Set `COOKIE_SECURE=true` in `.env` (requires HTTPS)
2. Set `NODE_ENV=production`
3. Use a process manager: `npm install -g pm2 && pm2 start server.js --name nexacore`
4. Use a reverse proxy (nginx) to serve on port 80/443
5. Set `CLIENT_ORIGIN` to your actual domain
