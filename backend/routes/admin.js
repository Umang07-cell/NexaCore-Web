const express     = require('express');
const User        = require('../models/User');
const Service     = require('../models/Service');
const TeamConnect = require('../models/TeamConnect');

const router = express.Router();

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

// ── GET all data ─────────────────────────────────────────────────────────────
router.get('/data', adminGuard, async (req, res) => {
  try {
    const users    = await User.find().select('-password -otp').lean();
    const services = await Service.find().lean();
    const connects = await TeamConnect.find().lean();

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

// ── ACCEPT a service request ─────────────────────────────────────────────────
// PATCH /api/admin/services/:id/accept?secret=YOUR_SECRET
router.patch('/services/:id/accept', adminGuard, async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      {
        status: 'active',
        activatedAt: new Date(),
        $push: { history: { action: 'activated', note: req.body.note || 'Accepted by admin' } }
      },
      { new: true }
    );
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    res.json({ success: true, message: 'Service activated.', service });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── CANCEL a service request ─────────────────────────────────────────────────
// PATCH /api/admin/services/:id/cancel?secret=YOUR_SECRET
router.patch('/services/:id/cancel', adminGuard, async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: req.body.reason || 'Cancelled by admin',
        $push: { history: { action: 'cancelled', note: req.body.reason || 'Cancelled by admin' } }
      },
      { new: true }
    );
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    res.json({ success: true, message: 'Service cancelled.', service });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── UPDATE team connect status ────────────────────────────────────────────────
// PATCH /api/admin/team/:id/status?secret=YOUR_SECRET
// body: { status: 'in-progress' | 'resolved' }
router.patch('/team/:id/status', adminGuard, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const connect = await TeamConnect.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!connect) return res.status(404).json({ success: false, message: 'Request not found.' });
    res.json({ success: true, message: 'Status updated.', connect });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;