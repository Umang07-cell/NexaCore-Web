const express = require('express');
const { body, validationResult } = require('express-validator');
const ScheduleCall = require('../models/ScheduleCall');

const router = express.Router();

router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  try {
    await ScheduleCall.create(req.body);
    res.status(201).json({ success: true, message: 'Call scheduled successfully. We will confirm within one business day.' });
  } catch (err) {
    console.error('Schedule error:', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

module.exports = router;
