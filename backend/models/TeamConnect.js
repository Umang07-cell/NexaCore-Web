const mongoose = require('mongoose');

const teamConnectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // User's own info (auto-filled from session)
  userName:  { type: String, required: true },
  userEmail: { type: String, required: true },
  // Request info
  department: {
    type: String,
    enum: ['engineering', 'cloud', 'support', 'ai', 'sales', 'general'],
    required: true
  },
  preferredContact: {
    type: String,
    enum: ['email', 'phone', 'video'],
    default: 'email'
  },
  phone:   { type: String, default: '' },
  message: { type: String, required: true, maxlength: 1000 },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved'],
    default: 'pending'
  },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('TeamConnect', teamConnectSchema);
