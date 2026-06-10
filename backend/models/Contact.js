const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true, maxlength: 100 },
  email:   { type: String, required: true, trim: true, lowercase: true },
  company: { type: String, trim: true, default: '' },
  service: { type: String, default: '' },
  subject: { type: String, trim: true, default: '' },
  message: { type: String, required: true, maxlength: 2000 },
  status:  { type: String, enum: ['pending','in-progress','completed'], default: 'pending' },
  notes:   { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
