const express     = require('express');
const jwt         = require('jsonwebtoken');
const rateLimit   = require('express-rate-limit');
const User        = require('../models/User');
const Service     = require('../models/Service');
const TeamConnect = require('../models/TeamConnect');
const Job         = require('../models/Job');
const { sendAdminNotification, sendAdminReply } = require('../utils/mailer');
 
const router = express.Router();
 
// ── Rate limit admin login ───────────────────────────────────────────────────
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' }
});
 
// ── Admin login ──────────────────────────────────────────────────────────────
router.post('/login', adminLoginLimiter, (req, res) => {
  const { email, password } = req.body;
  const adminEmail    = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
 
  if (!adminEmail || !adminPassword) {
    return res.status(500).json({ success: false, message: 'Admin credentials not configured.' });
  }
  if (email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }
 
  const token = jwt.sign(
    { role: 'admin', email: adminEmail },
    process.env.JWT_SECRET + '_admin',
    { expiresIn: '8h' }
  );
 
  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 8 * 60 * 60 * 1000
  });
 
  res.json({ success: true, message: 'Admin logged in.' });
});
 
// ── Admin logout ─────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});
 
// ── Admin auth middleware (all routes below are protected) ───────────────────
const adminAuth = require('../middleware/adminAuth');
router.use(adminAuth);
 
// ── Check admin session ──────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  res.json({ success: true, email: req.admin.email });
});
 
// ── Overview stats ───────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, services, connects, jobs] = await Promise.all([
      User.countDocuments(),
      Service.countDocuments(),
      TeamConnect.countDocuments(),
      Job.countDocuments({ isActive: true })
    ]);
    const pending  = await Service.countDocuments({ status: 'pending' });
    const active   = await Service.countDocuments({ status: 'active' });
    const resolved = await TeamConnect.countDocuments({ status: 'resolved' });
    res.json({ success: true, stats: { users, services, connects, jobs, pending, active, resolved } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
// ── Users ────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search } = req.query;
    const query = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
      : {};
    const users = await User.find(query).select('-password -otp -otpExpiry').sort({ createdAt: -1 }).lean();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Service.deleteMany({ userId: req.params.id });
    await TeamConnect.deleteMany({ userId: req.params.id });
    res.json({ success: true, message: 'User and all associated data deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
// ── Services ─────────────────────────────────────────────────────────────────
router.get('/services', async (req, res) => {
  try {
    const services = await Service.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
router.patch('/services/:id/accept', async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      {
        status: 'active',
        activatedAt: new Date(),
        $push: { history: { action: 'activated', note: req.body.note || 'Accepted by admin' } }
      },
      { new: true }
    ).populate('userId', 'name email');
 
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
 
    // Notify admin
    await sendAdminNotification({
      subject: `Service Activated: ${service.serviceId}`,
      text: `Service "${service.serviceId}" for ${service.userId?.name} (${service.userId?.email}) has been activated.`
    }).catch(() => {});
 
    res.json({ success: true, message: 'Service activated.', service });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
router.patch('/services/:id/cancel', async (req, res) => {
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
    ).populate('userId', 'name email');
 
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });
    res.json({ success: true, message: 'Service cancelled.', service });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
// ── Team Connects ─────────────────────────────────────────────────────────────
router.get('/team', async (req, res) => {
  try {
    const connects = await TeamConnect.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, connects });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
router.patch('/team/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const connect = await TeamConnect.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!connect) return res.status(404).json({ success: false, message: 'Request not found.' });
    res.json({ success: true, message: 'Status updated.', connect });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
router.post('/team/:id/reply', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required.' });
 
    const connect = await TeamConnect.findById(req.params.id);
    if (!connect) return res.status(404).json({ success: false, message: 'Request not found.' });
 
    await sendAdminReply({
      toEmail: connect.userEmail,
      toName:  connect.userName,
      message,
      department: connect.department
    });
 
    await TeamConnect.findByIdAndUpdate(req.params.id, { status: 'in-progress' });
    res.json({ success: true, message: 'Reply sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
// ── Jobs ──────────────────────────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
router.post('/jobs', async (req, res) => {
  try {
    const { title, type, department, description } = req.body;
    if (!title || !type || !department || !description) {
      return res.status(400).json({ success: false, message: 'All fields required.' });
    }
    const job = await Job.create({ title, type, department, description });
    res.status(201).json({ success: true, message: 'Job created.', job });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
router.patch('/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    res.json({ success: true, message: 'Job updated.', job });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
router.delete('/jobs/:id', async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Job deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
 
module.exports = router;
