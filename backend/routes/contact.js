const express = require('express');
const { body, validationResult } = require('express-validator');
const { sendContactEmail } = require('../utils/mailer');
const Contact = require('../models/Contact');

const router = express.Router();

router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).escape(),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 2000 }).escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { name, email, company, service, subject, message } = req.body;

  try {
    await Contact.create({ name, email, company: company || '', service: service || '', subject: subject || service || 'General Inquiry', message });
    try { await sendContactEmail({ name, email, subject: subject || service || 'General Inquiry', message }); } catch {}
    res.json({ success: true, message: 'Message sent! We will get back to you within 24 hours.' });
  } catch (err) {
    console.error('Contact error:', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

module.exports = router;
