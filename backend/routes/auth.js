const express  = require('express');
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { body, validationResult } = require('express-validator');
const User     = require('../models/User');
const { sendOTPEmail } = require('../utils/mailer');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Helper: set JWT in HttpOnly cookie
function setAuthCookie(res, userId) {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('nexacore_token', token, {
    httpOnly: true,
    secure:   process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000   // 7 days
  });
  return token;
}

// Helper: clear auth cookie
function clearAuthCookie(res) {
  res.clearCookie('nexacore_token', {
    httpOnly: true,
    secure:   process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict'
  });
}

// ─── POST /api/auth/signup ───────────────────────────────────────────────────
router.post('/signup', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((val, { req }) => {
    if (val !== req.body.password) throw new Error('Passwords do not match');
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { name, email, password } = req.body;

  try {
    // Check duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + (Number(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000);

    // Create unverified user
    const user = await User.create({
      name,
      email,
      password,
      isVerified: false,
      otp: { code: otp, expiresAt }
    });

    // Send OTP email
    const result = await sendOTPEmail(email, name, otp);

    res.status(201).json({
      success: true,
      message: result.devMode
        ? `Account created. DEV MODE — OTP printed to server console (no SMTP configured).`
        : 'Account created. A 6-digit verification code has been sent to your email.',
      userId: user._id,
      devOtp: result.devMode ? result.otp : undefined   // only in dev mode
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
router.post('/verify-otp', [
  body('userId').notEmpty().withMessage('User ID required'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits').isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { userId, otp } = req.body;

  try {
    const user = await User.findById(userId).select('+otp.code +otp.expiresAt');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Account already verified. Please log in.' });
    }
    if (!user.otp || !user.otp.code) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please sign up again.' });
    }
    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please sign up again.' });
    }
    if (user.otp.code !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    // Mark verified, clear OTP
    user.isVerified = true;
    user.otp        = undefined;
    user.lastLogin  = new Date();
    await user.save();

    // Set JWT cookie and return user info
    setAuthCookie(res, user._id);

    res.json({
      success: true,
      message: 'Email verified successfully. Welcome to NexaCore!',
      user: { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt }
    });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/resend-otp ───────────────────────────────────────────────
router.post('/resend-otp', otpLimiter, [
  body('userId').notEmpty()
], async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId).select('+otp.code +otp.expiresAt');
    if (!user || user.isVerified) {
      return res.status(400).json({ success: false, message: 'Invalid request.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + (Number(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000);
    user.otp = { code: otp, expiresAt };
    await user.save();

    const result = await sendOTPEmail(user.email, user.name, otp);

    res.json({
      success: true,
      message: result.devMode ? 'OTP resent (check server console — DEV MODE).' : 'A new OTP has been sent to your email.',
      devOtp: result.devMode ? result.otp : undefined
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
// No OTP required — user is already registered and verified
router.post('/login', loginLimiter, [
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Please complete registration first.',
        needsVerification: true,
        userId: user._id
      });
    }

    user.lastLogin = new Date();
    await user.save();

    setAuthCookie(res, user._id);

    res.json({
      success: true,
      message: 'Login successful.',
      user: { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
// Validate session — called on page load to check if still logged in
router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id:        req.user._id,
      name:      req.user.name,
      email:     req.user.email,
      createdAt: req.user.createdAt,
      lastLogin: req.user.lastLogin
    }
  });
});

module.exports = router;
