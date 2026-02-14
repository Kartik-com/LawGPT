import mongoose from 'mongoose';

const caseSchema = new mongoose.Schema({
  caseNumber: { type: String, required: true },
  clientName: { type: String, required: true },
  opposingParty: { type: String },
  courtName: { type: String },
  judgeName: { type: String },
  hearingDate: { type: Date },
  hearingTime: { type: String },
  status: { type: String, enum: ['active', 'pending', 'closed', 'won', 'lost'], default: 'active' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  caseType: { type: String },
  description: { type: String },
  nextHearing: { type: Date },
  notes: { type: String },
  alerts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

// Indexes for efficient queries
caseSchema.index({ owner: 1, status: 1 });
caseSchema.index({ owner: 1, nextHearing: 1 });

export default mongoose.model('Case', caseSchema);
