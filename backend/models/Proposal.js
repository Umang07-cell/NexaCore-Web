const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  // Step 1 - Company Info
  companyName:   { type: String, required: true, trim: true },
  industry:      { type: String, required: true },
  companySize:   { type: String, required: true },
  website:       { type: String, default: '' },
  // Step 2 - Contact Info
  contactName:   { type: String, required: true, trim: true },
  contactEmail:  { type: String, required: true, trim: true, lowercase: true },
  contactPhone:  { type: String, default: '' },
  contactRole:   { type: String, default: '' },
  // Step 3 - Project Details
  services:      [{ type: String }],
  projectScope:  { type: String, required: true },
  budget:        { type: String, default: '' },
  timeline:      { type: String, default: '' },
  description:   { type: String, required: true, maxlength: 3000 },
  // Step 4 - Additional
  currentChallenges: { type: String, default: '' },
  howHeard:      { type: String, default: '' },
  // Admin
  status:  { type: String, enum: ['pending','in-progress','completed','declined'], default: 'pending' },
  notes:   { type: String, default: '' },
  priority:{ type: String, enum: ['normal','high','urgent'], default: 'normal' }
}, { timestamps: true });

module.exports = mongoose.model('Proposal', proposalSchema);
