const express  = require('express');
const { body, validationResult } = require('express-validator');
const Service  = require('../models/Service');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All service routes require authentication
router.use(protect);

const VALID_SERVICE_IDS = ['software', 'cloud', 'support', 'ai'];

// ─── GET /api/services ───────────────────────────────────────────────────────
// Get all services for the logged-in user
router.get('/', async (req, res) => {
  try {
    const services = await Service.find({ userId: req.user._id }).sort('-requestedAt');
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/services/request ─────────────────────────────────────────────
// Request a new service (adds to queue as 'pending')
router.post('/request', [
  body('serviceId').isIn(VALID_SERVICE_IDS).withMessage('Invalid service ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  try {
    const existing = await Service.findOne({ userId: req.user._id, serviceId: req.body.serviceId });
    if (existing) {
      if (existing.status === 'cancelled') {
        // Allow re-requesting a cancelled service — move back to queue
        existing.status      = 'pending';
        existing.cancelledAt = undefined;
        existing.cancelReason = undefined;
        existing.requestedAt = new Date();
        existing.history.push({ action: 're-requested', note: 'Service re-requested after cancellation' });
        await existing.save();
        return res.json({ success: true, message: 'Service re-requested and added back to queue.', service: existing });
      }
      return res.status(409).json({ success: false, message: 'Service already active or pending.' });
    }

    const service = await Service.create({
      userId:    req.user._id,
      serviceId: req.body.serviceId,
      status:    'pending',
      history:   [{ action: 'requested' }]
    });

    res.status(201).json({ success: true, message: 'Service requested successfully.', service });
  } catch (err) {
    console.error('Request service error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/services/cancel ───────────────────────────────────────────────
// Cancel a service — it moves back to 'cancelled' (request queue)
router.post('/cancel', [
  body('serviceId').isIn(VALID_SERVICE_IDS).withMessage('Invalid service ID')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  try {
    const service = await Service.findOne({ userId: req.user._id, serviceId: req.body.serviceId });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }
    if (service.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Service is already cancelled.' });
    }

    service.status      = 'cancelled';
    service.cancelledAt = new Date();
    service.cancelReason = req.body.reason || 'Cancelled by user';
    service.history.push({ action: 'cancelled', note: service.cancelReason });
    await service.save();

    res.json({
      success: true,
      message: 'Service cancelled. It has been moved back to the request queue.',
      service
    });
  } catch (err) {
    console.error('Cancel service error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE /api/services/:serviceId ────────────────────────────────────────
// Permanently remove a service record
router.delete('/:serviceId', async (req, res) => {
  if (!VALID_SERVICE_IDS.includes(req.params.serviceId)) {
    return res.status(400).json({ success: false, message: 'Invalid service ID.' });
  }
  try {
    await Service.findOneAndDelete({ userId: req.user._id, serviceId: req.params.serviceId });
    res.json({ success: true, message: 'Service removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
