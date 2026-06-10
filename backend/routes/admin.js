const express     = require('express');
const jwt         = require('jsonwebtoken');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const fs          = require('fs');
const User        = require('../models/User');
const Service     = require('../models/Service');
const TeamConnect = require('../models/TeamConnect');
const Job         = require('../models/Job');
const Contact     = require('../models/Contact');
const Proposal    = require('../models/Proposal');
const ScheduleCall = require('../models/ScheduleCall');
const JobApplication = require('../models/JobApplication');
const { sendAdminNotification, sendAdminReply } = require('../utils/mailer');

const router = express.Router();

const adminLoginLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, message: { success: false, message: 'Too many login attempts.' } });

router.post('/login', adminLoginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)
    return res.status(500).json({ success: false, message: 'Admin credentials not configured.' });
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  const token = jwt.sign({ role: 'admin', email }, process.env.JWT_SECRET + '_admin', { expiresIn: '8h' });
  res.cookie('admin_token', token, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8*60*60*1000 });
  res.json({ success: true, message: 'Admin logged in.' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

const adminAuth = require('../middleware/adminAuth');
router.use(adminAuth);

router.get('/me', (req, res) => res.json({ success: true, email: req.admin.email }));

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, services, connects, jobs, contacts, proposals, scheduleCalls, applications] = await Promise.all([
      User.countDocuments(),
      Service.countDocuments(),
      TeamConnect.countDocuments(),
      Job.countDocuments({ isActive: true }),
      Contact.countDocuments(),
      Proposal.countDocuments(),
      ScheduleCall.countDocuments(),
      JobApplication.countDocuments()
    ]);
    const pendingContacts  = await Contact.countDocuments({ status: 'pending' });
    const pendingProposals = await Proposal.countDocuments({ status: 'pending' });
    const pendingCalls     = await ScheduleCall.countDocuments({ status: 'pending' });
    const pendingApps      = await JobApplication.countDocuments({ status: 'pending' });
    const pendingServices  = await Service.countDocuments({ status: 'pending' });
    res.json({ success: true, stats: {
      users, services, connects, jobs, contacts, proposals, scheduleCalls, applications,
      pendingContacts, pendingProposals, pendingCalls, pendingApps, pendingServices,
      totalPending: pendingContacts + pendingProposals + pendingCalls + pendingApps + pendingServices
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ── Contacts ─────────────────────────────────────────────────────────────────
router.get('/contacts', async (req, res) => {
  try {
    const { search, status } = req.query;
    const q = {};
    if (status) q.status = status;
    if (search) q.$or = [{ name: new RegExp(search,'i') }, { email: new RegExp(search,'i') }, { company: new RegExp(search,'i') }];
    const contacts = await Contact.find(q).sort({ createdAt: -1 }).lean();
    res.json({ success: true, contacts });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.patch('/contacts/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = { status };
    if (notes !== undefined) update.notes = notes;
    const contact = await Contact.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!contact) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, contact });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/contacts/:id', async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── Proposals ─────────────────────────────────────────────────────────────────
router.get('/proposals', async (req, res) => {
  try {
    const { search, status } = req.query;
    const q = {};
    if (status) q.status = status;
    if (search) q.$or = [{ companyName: new RegExp(search,'i') }, { contactEmail: new RegExp(search,'i') }, { contactName: new RegExp(search,'i') }];
    const proposals = await Proposal.find(q).sort({ createdAt: -1 }).lean();
    res.json({ success: true, proposals });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.patch('/proposals/:id/status', async (req, res) => {
  try {
    const { status, notes, priority } = req.body;
    const update = { status };
    if (notes !== undefined) update.notes = notes;
    if (priority) update.priority = priority;
    const proposal = await Proposal.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!proposal) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, proposal });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/proposals/:id', async (req, res) => {
  try {
    await Proposal.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── Schedule Calls ────────────────────────────────────────────────────────────
router.get('/schedule-calls', async (req, res) => {
  try {
    const { search, status } = req.query;
    const q = {};
    if (status) q.status = status;
    if (search) q.$or = [{ name: new RegExp(search,'i') }, { email: new RegExp(search,'i') }, { company: new RegExp(search,'i') }];
    const calls = await ScheduleCall.find(q).sort({ createdAt: -1 }).lean();
    res.json({ success: true, calls });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.patch('/schedule-calls/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = { status };
    if (notes !== undefined) update.notes = notes;
    const call = await ScheduleCall.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!call) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, call });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/schedule-calls/:id', async (req, res) => {
  try {
    await ScheduleCall.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── Job Applications ──────────────────────────────────────────────────────────
router.get('/applications', async (req, res) => {
  try {
    const { search, status } = req.query;
    const q = {};
    if (status) q.status = status;
    if (search) q.$or = [{ name: new RegExp(search,'i') }, { email: new RegExp(search,'i') }, { jobTitle: new RegExp(search,'i') }];
    const applications = await JobApplication.find(q).sort({ createdAt: -1 }).lean();
    res.json({ success: true, applications });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.patch('/applications/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = { status };
    if (notes !== undefined) update.notes = notes;
    const app = await JobApplication.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!app) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, application: app });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/applications/:id', async (req, res) => {
  try {
    const app = await JobApplication.findByIdAndDelete(req.params.id);
    if (app?.resumeFilename) {
      const fp = path.join(__dirname, '..', '..', 'uploads', 'resumes', app.resumeFilename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// Resume download
router.get('/applications/:id/resume', async (req, res) => {
  try {
    const app = await JobApplication.findById(req.params.id);
    if (!app?.resumeFilename) return res.status(404).json({ success: false, message: 'No resume.' });
    const fp = path.join(__dirname, '..', '..', 'uploads', 'resumes', app.resumeFilename);
    if (!fs.existsSync(fp)) return res.status(404).json({ success: false, message: 'File not found.' });
    res.download(fp, app.resumeOriginalName || app.resumeFilename);
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search } = req.query;
    const q = search ? { $or: [{ name: new RegExp(search,'i') }, { email: new RegExp(search,'i') }] } : {};
    const users = await User.find(q).select('-password -otp -otpExpiry').sort({ createdAt: -1 }).lean();
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Service.deleteMany({ userId: req.params.id });
    await TeamConnect.deleteMany({ userId: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── Services ──────────────────────────────────────────────────────────────────
router.get('/services', async (req, res) => {
  try {
    const services = await Service.find().populate('userId','name email').sort({ createdAt: -1 }).lean();
    res.json({ success: true, services });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.patch('/services/:id/accept', async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, { status:'active', activatedAt: new Date(), $push:{ history:{ action:'activated', note: req.body.note||'Accepted by admin' } } }, { new: true }).populate('userId','name email');
    if (!service) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, service });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.patch('/services/:id/cancel', async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, { status:'cancelled', cancelledAt: new Date(), cancelReason: req.body.reason||'Cancelled by admin', $push:{ history:{ action:'cancelled', note: req.body.reason||'Cancelled by admin' } } }, { new: true }).populate('userId','name email');
    if (!service) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, service });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── Team Connects ─────────────────────────────────────────────────────────────
router.get('/team', async (req, res) => {
  try {
    const connects = await TeamConnect.find().populate('userId','name email').sort({ createdAt: -1 }).lean();
    res.json({ success: true, connects });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.patch('/team/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending','in-progress','resolved'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
    const connect = await TeamConnect.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!connect) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, connect });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.post('/team/:id/reply', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required.' });
    const connect = await TeamConnect.findById(req.params.id);
    if (!connect) return res.status(404).json({ success: false, message: 'Not found.' });
    try { await sendAdminReply({ toEmail: connect.userEmail, toName: connect.userName, message, department: connect.department }); } catch {}
    await TeamConnect.findByIdAndUpdate(req.params.id, { status: 'in-progress' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

// ── Jobs ──────────────────────────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, jobs });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.post('/jobs', async (req, res) => {
  try {
    const { title, type, department, description } = req.body;
    if (!title || !type || !department || !description) return res.status(400).json({ success: false, message: 'All fields required.' });
    const job = await Job.create({ title, type, department, description });
    res.status(201).json({ success: true, job });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.patch('/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!job) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, job });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

router.delete('/jobs/:id', async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error.' }); }
});

module.exports = router;
