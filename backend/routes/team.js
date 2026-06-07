const express  = require('express');
const { body, validationResult } = require('express-validator');
const TeamConnect = require('../models/TeamConnect');
const { protect }  = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ─── POST /api/team/connect ──────────────────────────────────────────────────
router.post('/connect', [
  body('department').isIn(['engineering','cloud','support','ai','sales','general']).withMessage('Invalid department'),
  body('preferredContact').isIn(['email','phone','video']).withMessage('Invalid contact preference'),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 1000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { department, preferredContact, phone, message } = req.body;
  try {
    const entry = await TeamConnect.create({
      userId:           req.user._id,
      userName:         req.user.name,
      userEmail:        req.user.email,
      department,
      preferredContact,
      phone:            phone || '',
      message
    });
    res.status(201).json({ success: true, message: 'Your request has been submitted. A team member will reach out within 24 hours.', entry });
  } catch (err) {
    console.error('Team connect error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── GET /api/team/connect ───────────────────────────────────────────────────
// Get all team connect requests for the logged-in user
router.get('/connect', async (req, res) => {
  try {
    const entries = await TeamConnect.find({ userId: req.user._id }).sort('-submittedAt');
    res.json({ success: true, entries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
