/**
 * NexaCore Backend Server
 * Node.js + Express + MongoDB + JWT + Bcrypt + Nodemailer
 */

require('dotenv').config();
const express       = require('express');
const path          = require('path');
const cookieParser  = require('cookie-parser');
const helmet        = require('helmet');
const cors          = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit     = require('express-rate-limit');
const mongoose      = require('mongoose');
const crypto        = require('crypto');

const authRoutes    = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const contactRoutes = require('./routes/contact');
const userRoutes    = require('./routes/user');
const teamRoutes    = require('./routes/team');
const adminRoutes   = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MongoDB ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexacore')
  .then(() => console.log('✅  MongoDB connected'))
  .catch(err => { console.error('❌  MongoDB error:', err.message); process.exit(1); });

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitize());

// ── Rate limiters ────────────────────────────────────────────────────────────
const loginLimiter = (req, res, next) => next();

// ── CSRF token ───────────────────────────────────────────────────────────────
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('_csrf', token, {
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true'
  });
  res.json({ csrfToken: token });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',     loginLimiter, authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/contact',  contactRoutes);
app.use('/api/user',     userRoutes);
app.use('/api/team',     teamRoutes);
app.use('/api/admin',    adminRoutes);

// ── Serve static frontend ────────────────────────────────────────────────────
// All HTML files are at public/*.html, CSS at public/CSS/, JS at public/JS/
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Root → index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Catch-all: try to serve any .html file directly from public/
app.get('/:page', (req, res, next) => {
  const page = req.params.page;
  // Only handle .html files
  if (!page.endsWith('.html')) return next();
  const file = path.join(publicDir, page);
  res.sendFile(file, err => {
    if (err) res.status(404).send('Page not found: ' + page);
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  NexaCore running at http://localhost:${PORT}`);
});
