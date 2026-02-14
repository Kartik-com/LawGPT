import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
  invoiceNumber: { type: String, required: true },
  issueDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'sent', 'paid', 'overdue'], default: 'draft', index: true },
  currency: { type: String, default: 'INR' },
  items: { type: [invoiceItemSchema], default: [] },
  subtotal: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, default: 0 }, // percentage
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  total: { type: Number, required: true, min: 0 },
  notes: { type: String },
  terms: { type: String },
  paidAt: { type: Date },
}, { timestamps: true });

// Indexes for efficient queries
invoiceSchema.index({ owner: 1, status: 1 });
invoiceSchema.index({ owner: 1, dueDate: 1 });

export default mongoose.model('Invoice', invoiceSchema);
