import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String },
  panNumber: { type: String },
  aadharNumber: { type: String },
  notes: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

// Indexes for efficient queries
clientSchema.index({ owner: 1, email: 1 });

export default mongoose.model('Client', clientSchema);
