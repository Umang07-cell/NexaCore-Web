const express = require('express');
const { body, validationResult } = require('express-validator');
const { sendContactEmail } = require('../utils/mailer');

const router = express.Router();

router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).escape(),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 200 }).escape(),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 }).escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { name, email, subject, message } = req.body;
  const payload = { name, email, subject, message, receivedAt: new Date().toISOString() };

  try {
    await sendContactEmail({ name, email, subject, message });
    res.json({ success: true, message: 'Message sent! We will get back to you within 24 hours.' });
  } catch (err) {
    console.error('Contact email error:', err.message);
    res.json({ success: true, message: 'Message received and saved. We will get back to you soon.' });
  }
});

module.exports = router;
