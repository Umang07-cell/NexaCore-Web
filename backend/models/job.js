const mongoose = require('mongoose');
 
const jobSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  type:        { type: String, enum: ['Full Time', 'Part Time', 'Internship', 'Contract'], required: true },
  department:  { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  isActive:    { type: Boolean, default: true }
}, { timestamps: true });
 
module.exports = mongoose.model('Job', jobSchema);
 