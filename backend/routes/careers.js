const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const JobApplication = require('../models/JobApplication');

const router = express.Router();

// Upload dir
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'resumes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

router.post('/apply', upload.single('resume'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('jobTitle').trim().notEmpty().withMessage('Job title is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  try {
    const appData = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone || '',
      jobTitle: req.body.jobTitle,
      jobId: req.body.jobId || null,
      linkedin: req.body.linkedin || '',
      portfolio: req.body.portfolio || '',
      experience: req.body.experience || '',
      coverLetter: req.body.coverLetter || ''
    };
    if (req.file) {
      appData.resumeFilename = req.file.filename;
      appData.resumeOriginalName = req.file.originalname;
    }
    await JobApplication.create(appData);
    res.status(201).json({ success: true, message: 'Application submitted successfully. We will be in touch soon.' });
  } catch (err) {
    console.error('Application error:', err.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

module.exports = router;
