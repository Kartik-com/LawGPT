import mongoose from 'mongoose';

const hearingSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },

  // Legacy fields (kept for backward compatibility)
  hearingDate: { type: Date, required: true },
  hearingTime: { type: String },

  // New timezone-aware fields
  timezone: { type: String, default: 'Asia/Kolkata' }, // IANA timezone
  startAt: { type: Date }, // UTC timestamp for hearing start
  endAt: { type: Date }, // UTC timestamp for hearing end
  duration: { type: Number, default: 60 }, // Duration in minutes

  courtName: { type: String, required: true },
  judgeName: { type: String },
  hearingType: {
    type: String,
    enum: ['first_hearing', 'interim_hearing', 'final_hearing', 'evidence_hearing', 'argument_hearing', 'judgment_hearing', 'other'],
    default: 'interim_hearing'
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'adjourned', 'cancelled'],
    default: 'scheduled'
  },
  purpose: { type: String }, // Purpose of the hearing
  courtInstructions: { type: String }, // Instructions from court for next hearing
  documentsToBring: [{ type: String }], // Documents required for next hearing
  proceedings: { type: String }, // What happened during the hearing
  nextHearingDate: { type: Date }, // Next hearing date if adjourned
  nextHearingTime: { type: String },
  adjournmentReason: { type: String }, // Reason for adjournment if applicable
  attendance: {
    clientPresent: { type: Boolean, default: false },
    opposingPartyPresent: { type: Boolean, default: false },
    witnessesPresent: [{ type: String }], // Names of witnesses present
  },
  orders: [{
    orderType: { type: String }, // e.g., 'interim_order', 'final_order', 'direction'
    orderDetails: { type: String },
    orderDate: { type: Date, default: Date.now }
  }],
  notes: { type: String }, // Additional notes

  // Resource scope for conflict detection
  resourceScope: {
    courtroomId: { type: String }, // Specific courtroom identifier
    counselId: { type: String }, // Assigned counsel/lawyer
    clientId: { type: String }, // Client involved
  },

  // Conflict override tracking
  conflictOverride: {
    allowed: { type: Boolean, default: false },
    reason: { type: String },
    overriddenBy: { type: String }, // User ID who approved override
    overriddenAt: { type: Date },
    conflictingHearings: [{ type: String }], // IDs of conflicting hearings
  },

  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true });

// Indexes for efficient queries
hearingSchema.index({ caseId: 1, hearingDate: -1 });
hearingSchema.index({ owner: 1, hearingDate: -1 });
hearingSchema.index({ owner: 1, startAt: 1 }); // For conflict detection
hearingSchema.index({ owner: 1, status: 1, startAt: 1 }); // For active hearings

export default mongoose.model('Hearing', hearingSchema);

