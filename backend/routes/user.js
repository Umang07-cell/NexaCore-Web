const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

router.get('/profile', protect, async (req, res) => {
  res.json({
    success: true,
    user: {
      id:        req.user._id,
      name:      req.user.name,
      email:     req.user.email,
      role:      req.user.role,
      createdAt: req.user.createdAt,
      lastLogin: req.user.lastLogin
    }
  });
});

module.exports = router;
