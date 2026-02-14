import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' }, // Optional case reference
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

// Indexes for efficient queries
folderSchema.index({ ownerId: 1, caseId: 1 });

export default mongoose.model('Folder', folderSchema);

