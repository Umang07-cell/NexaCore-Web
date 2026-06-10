const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema({
  jobId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  jobTitle:   { type: String, required: true },
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, trim: true, lowercase: true },
  phone:      { type: String, default: '' },
  linkedin:   { type: String, default: '' },
  portfolio:  { type: String, default: '' },
  experience: { type: String, default: '' },
  coverLetter:{ type: String, default: '', maxlength: 3000 },
  resumeFilename: { type: String, default: '' },
  resumeOriginalName: { type: String, default: '' },
  status:     { type: String, enum: ['pending','reviewing','interview','rejected','hired'], default: 'pending' },
  notes:      { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
