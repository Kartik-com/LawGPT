import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
  type: { type: String, enum: ['hearing', 'deadline', 'payment', 'document'], required: true },
  message: { type: String, required: true },
  alertTime: { type: Date, required: true },
  isRead: { type: Boolean, default: false },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

// Indexes for efficient queries
alertSchema.index({ owner: 1, isRead: 1 });
alertSchema.index({ owner: 1, alertTime: 1 });

export default mongoose.model('Alert', alertSchema);
