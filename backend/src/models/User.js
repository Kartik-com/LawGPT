import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Basic info
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['lawyer', 'assistant', 'admin'], default: 'lawyer' },

  // Professional info
  barNumber: { type: String },
  firm: { type: String },

  // Profile info
  phone: { type: String },
  address: { type: String },
  bio: { type: String },

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

userSchema.statics.hashPassword = function (password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
};

export default mongoose.model('User', userSchema);
