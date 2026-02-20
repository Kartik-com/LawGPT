import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Basic info
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['lawyer', 'assistant', 'admin'], default: 'lawyer' },

  // Account status (soft-delete support)
  status: {
    type: String,
    enum: ['active', 'deleted'],
    default: 'active',
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },

  // Onboarding tracking
  onboardingCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  immutableFieldsLocked: {
    type: Boolean,
    default: false
  },

  // Comprehensive profile (new structure)
  profile: {
    fullName: { type: String, default: null, index: true },
    barCouncilNumber: {
      type: String,
      default: null,
      unique: true,
      sparse: true, // Only enforce uniqueness when value exists
      index: true
    },
    currency: { type: String, default: null },
    phoneNumber: { type: String, default: null },
    lawFirmName: { type: String, default: null },
    practiceAreas: { type: [String], default: [] },
    courtLevels: { type: [String], default: [] },
    address: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    timezone: { type: String, default: null }
  },

  // Onboarding data audit trail
  onboardingDataAudit: [
    {
      fieldName: String,
      value: String,
      enteredAt: Date
    }
  ],

  // Legacy fields (kept for backward compatibility, will be migrated)
  barNumber: { type: String },
  firm: { type: String },
  phone: { type: String },
  // Note: legacy 'address' field removed - use profile.address instead

  // Email verification
  emailVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationSentAt: { type: Date },
  verifiedAt: { type: Date },

  // Password reset
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },

  // Notification settings (embedded document)
  notifications: {
    emailAlerts: { type: Boolean, default: true },
    smsAlerts: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    hearingReminders: { type: Boolean, default: true },
    clientUpdates: { type: Boolean, default: true },
    billingAlerts: { type: Boolean, default: false },
    weeklyReports: { type: Boolean, default: true },
  },

  // User preferences (embedded document)
  preferences: {
    theme: { type: String, default: 'light' },
    language: { type: String, default: 'en-IN' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    currency: { type: String, default: 'INR' },
  },

  // Security settings (embedded document)
  security: {
    twoFactorEnabled: { type: Boolean, default: false },
    sessionTimeout: { type: String, default: '30' },
    loginNotifications: { type: Boolean, default: true },
  },
}, { timestamps: true });

// Indexes (email already has unique index from field definition)
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ verificationToken: 1 });

userSchema.methods.verifyPassword = async function (password) {
  // Check if password hash exists
  if (!this.passwordHash) {
    console.error(`verifyPassword: User ${this._id} has no passwordHash`);
    return false;
  }

  // Check if password is provided
  if (!password) {
    return false;
  }

  // Verify the password hash format (bcrypt hashes start with $2a$, $2b$, or $2y$)
  if (!this.passwordHash.startsWith('$2')) {
    console.error(`verifyPassword: User ${this._id} has an invalid password hash format`);
    return false;
  }

  try {
    return await bcrypt.compare(password, this.passwordHash);
  } catch (error) {
    console.error(`verifyPassword error for user ${this._id}:`, error);
    return false;
  }
};

userSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 10);
};

export default mongoose.model('User', userSchema);
