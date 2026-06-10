const express = require('express');
const { body, validationResult } = require('express-validator');
const Proposal = require('../models/Proposal');

const router = express.Router();

router.post('/', [
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('industry').trim().notEmpty().withMessage('Industry is required'),
  body('companySize').trim().notEmpty().withMessage('Company size is required'),
  body('contactName').trim().notEmpty().withMessage('Contact name is required'),
  body('contactEmail').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('projectScope').trim().notEmpty().withMessage('Project scope is required'),
  body('description').trim().notEmpty().withMessage('Description is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  try {
    const proposal = await Proposal.create(req.body);
    res.status(201).json({ success: true, message: 'Proposal request submitted successfully.', id: proposal._id });
  } catch (err) {
    console.error('Proposal error:', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

module.exports = router;
