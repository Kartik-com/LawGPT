import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true }, // Cloudinary secure URL
  cloudinaryPublicId: { type: String }, // Cloudinary public ID for deletion
  resourceType: { type: String, enum: ['image', 'video', 'raw', 'auto'], default: 'auto' }, // Cloudinary resource type
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' }, // Optional case reference
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

// Indexes for efficient queries
documentSchema.index({ ownerId: 1, folderId: 1 });
documentSchema.index({ ownerId: 1, caseId: 1 });

export default mongoose.model('Document', documentSchema);

