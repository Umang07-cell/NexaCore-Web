/**
 * Admin data viewer — protected by ADMIN_SECRET env var.
 * GET /api/admin/data?secret=YOUR_ADMIN_SECRET
 * Returns all users, their services, and team connect requests.
 * Never expose this route without the secret in production.
 */
const express     = require('express');
const User        = require('../models/User');
const Service     = require('../models/Service');
const TeamConnect = require('../models/TeamConnect');

const router = express.Router();

// Simple secret-key guard (not cookie-based, so you can use curl/browser)
function adminGuard(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(403).json({ success: false, message: 'ADMIN_SECRET not configured.' });
  }
  if (req.query.secret !== secret && req.headers['x-admin-secret'] !== secret) {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }
  next();
}

router.get('/data', adminGuard, async (req, res) => {
  try {
    const users    = await User.find().select('-password -otp').lean();
    const services = await Service.find().lean();
    const connects = await TeamConnect.find().lean();

    // Attach services and connects to each user
    const data = users.map(u => ({
      ...u,
      services: services.filter(s => String(s.userId) === String(u._id)),
      teamConnects: connects.filter(c => String(c.userId) === String(u._id))
    }));

    res.json({
      success: true,
      totals: { users: users.length, services: services.length, teamConnects: connects.length },
      data
    });
  } catch (err) {
    console.error('Admin data error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
