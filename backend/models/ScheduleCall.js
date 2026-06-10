const mongoose = require('mongoose');

const scheduleCallSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  email:           { type: String, required: true, trim: true, lowercase: true },
  company:         { type: String, default: '' },
  phone:           { type: String, default: '' },
  preferredDate:   { type: String, default: '' },
  preferredTime:   { type: String, default: '' },
  timezone:        { type: String, default: '' },
  topic:           { type: String, default: '' },
  message:         { type: String, default: '', maxlength: 1000 },
  status:          { type: String, enum: ['pending','confirmed','completed','cancelled'], default: 'pending' },
  notes:           { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('ScheduleCall', scheduleCallSchema);
