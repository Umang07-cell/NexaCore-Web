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
 
// ── MongoDB ──────────────────────────────────────────────────────────────────
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
app.use('/api/auth',     authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/contact',  contactRoutes);
app.use('/api/user',     userRoutes);
app.use('/api/team',     teamRoutes);
app.use('/api/admin',    adminRoutes);
 
// ── Public jobs endpoint (for careers.html) ───────────────────────────────
const Job = require('./models/Job');
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find({ isActive: true }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
// ── Serve static frontend ────────────────────────────────────────────────────
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
 
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
 
app.get('/:page', (req, res, next) => {
  const page = req.params.page;
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
