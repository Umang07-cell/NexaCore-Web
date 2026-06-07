const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceId: {
    type: String,
    required: true,
    enum: ['software', 'cloud', 'support', 'ai']
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'cancelled'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  activatedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  // History log for the service
  history: [{
    action: { type: String },
    at: { type: Date, default: Date.now },
    note: String
  }]
}, { timestamps: true });

// Each user can only have one entry per service
serviceSchema.index({ userId: 1, serviceId: 1 }, { unique: true });

module.exports = mongoose.model('Service', serviceSchema);
