import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import PasswordReset from '../models/PasswordReset.js';
import {
  createDocument,
  getDocumentById,
  updateDocument,
  queryDocuments,
  MODELS
} from '../services/mongodb.js';
import { requireAuth } from '../middleware/auth-jwt.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';

const router = express.Router();

// Helper constants
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d'; // 7 days
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const ALLOWED_ROLES = ['lawyer', 'assistant'];

// Default settings
const defaultNotificationSettings = {
  emailAlerts: true,
  smsAlerts: true,
  pushNotifications: true,
  hearingReminders: true,
  clientUpdates: true,
  billingAlerts: false,
  weeklyReports: true
};

const defaultPreferenceSettings = {
  theme: 'light',
  language: 'en-IN',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
  currency: 'INR'
};

const defaultSecuritySettings = {
  twoFactorEnabled: false,
  sessionTimeout: '30',
  loginNotifications: true
};

// Helper functions
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function normalizeRole(role) {
  if (!role) return 'lawyer';
  const normalized = role.toString().toLowerCase();
  return ALLOWED_ROLES.includes(normalized) ? normalized : 'lawyer';
}

function generateJWT(userId, email, role) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }

  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  });
}

function buildUserResponse(userId, profile) {
  return {
    id: userId,
    name: profile.name,
    email: profile.email,
    role: profile.role || 'lawyer',
    barNumber: profile.barNumber,
    firm: profile.firm,
    phone: profile.phone,
    address: profile.address,
    bio: profile.bio,
    emailVerified: profile.emailVerified || false,
    notifications: profile.notifications || defaultNotificationSettings,
    preferences: profile.preferences || defaultPreferenceSettings,
    security: profile.security || defaultSecuritySettings,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, barNumber, firm, role } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength (minimum 6 characters for now)
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    if (process.env.NODE_ENV === 'development') {
      console.log('📝 Registration attempt for:', normalizedEmail);
    }

    // Check if user already exists
    const existingUsers = await queryDocuments(MODELS.USERS, [
      { field: 'email', operator: '==', value: normalizedEmail }
    ]);

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = User.schema.statics.hashPassword(password);

    // Create user in MongoDB
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: normalizeRole(role),
      barNumber: barNumber?.trim() || undefined,
      firm: firm?.trim() || undefined,
      emailVerified: false,
      notifications: defaultNotificationSettings,
      preferences: defaultPreferenceSettings,
      security: defaultSecuritySettings
    };

    const user = await createDocument(MODELS.USERS, userData);

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ User registered successfully:', user.email);
    }

    // Generate JWT
    const token = generateJWT(user.id, user.email, user.role);

    // Set cookie
    setAuthCookie(res, token);

    // Return user data
    res.status(201).json({
      user: buildUserResponse(user.id, user),
      token
    });
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('📋 Error details:', error);
    }
    res.status(500).json({
      error: 'Registration failed. Please try again.',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Login attempt for:', normalizedEmail);
    }

    // Find user by email
    let users;
    try {
      users = await queryDocuments(MODELS.USERS, [
        { field: 'email', operator: '==', value: normalizedEmail }
      ]);
      if (process.env.NODE_ENV === 'development') {
        console.log('👤 Found users:', users.length);
      }
    } catch (dbError) {
      console.error('❌ Database query error:', dbError.message);
      if (process.env.NODE_ENV === 'development') {
        console.error('📋 DB Error details:', dbError);
      }
      return res.status(500).json({
        error: 'Database error. Please try again.',
        ...(process.env.NODE_ENV === 'development' && { details: dbError.message })
      });
    }

    if (users.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ No user found with email:', normalizedEmail);
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Get full user document to access passwordHash
    let userDoc;
    try {
      userDoc = await User.findById(user.id);
      if (process.env.NODE_ENV === 'development') {
        console.log('📄 User document found:', !!userDoc);
      }
    } catch (findError) {
      console.error('❌ Error finding user document:', findError.message);
      if (process.env.NODE_ENV === 'development') {
        console.error('📋 Find error details:', findError);
      }
      return res.status(500).json({
        error: 'Error retrieving user data. Please try again.',
        ...(process.env.NODE_ENV === 'development' && { details: findError.message })
      });
    }

    if (!userDoc) {
      console.error('❌ User document not found for ID:', user.id);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    let isPasswordValid;
    try {
      isPasswordValid = await userDoc.verifyPassword(password);
      if (process.env.NODE_ENV === 'development') {
        console.log('🔑 Password valid:', isPasswordValid);
      }
    } catch (verifyError) {
      console.error('❌ Password verification error:', verifyError.message);
      if (process.env.NODE_ENV === 'development') {
        console.error('📋 Verify error details:', verifyError);
      }
      return res.status(500).json({
        error: 'Error verifying password. Please try again.',
        ...(process.env.NODE_ENV === 'development' && { details: verifyError.message })
      });
    }

    if (!isPasswordValid) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Invalid password for user:', normalizedEmail);
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = generateJWT(user.id, user.email, user.role);

    // Set cookie
    setAuthCookie(res, token);

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Login successful for:', normalizedEmail);
    }

    // Return user data
    res.json({
      user: buildUserResponse(user.id, user),
      token
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    console.error('📍 Error stack:', error.stack);
    if (process.env.NODE_ENV === 'development') {
      console.error('📋 Full error:', error);
    }
    res.status(500).json({
      error: 'Login failed. Please try again.',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        stack: error.stack
      })
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await getDocumentById(MODELS.USERS, req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: buildUserResponse(user.id, user) });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PATCH /api/auth/profile
 * Update user profile
 */
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const allowedFields = ['name', 'barNumber', 'firm', 'phone', 'address', 'bio'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updatedUser = await updateDocument(MODELS.USERS, req.user.userId, updates);

    res.json({ user: buildUserResponse(updatedUser.id, updatedUser) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * PATCH /api/auth/settings/notifications
 * Update notification settings
 */
router.patch('/settings/notifications', requireAuth, async (req, res) => {
  try {
    const user = await getDocumentById(MODELS.USERS, req.user.userId);

    const updatedNotifications = {
      ...defaultNotificationSettings,
      ...(user.notifications || {}),
      ...req.body
    };

    const updatedUser = await updateDocument(MODELS.USERS, req.user.userId, {
      notifications: updatedNotifications
    });

    res.json({ user: buildUserResponse(updatedUser.id, updatedUser) });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

/**
 * PATCH /api/auth/settings/preferences
 * Update user preferences
 */
router.patch('/settings/preferences', requireAuth, async (req, res) => {
  try {
    const user = await getDocumentById(MODELS.USERS, req.user.userId);

    const updatedPreferences = {
      ...defaultPreferenceSettings,
      ...(user.preferences || {}),
      ...req.body
    };

    const updatedUser = await updateDocument(MODELS.USERS, req.user.userId, {
      preferences: updatedPreferences
    });

    res.json({ user: buildUserResponse(updatedUser.id, updatedUser) });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const users = await queryDocuments(MODELS.USERS, [
      { field: 'email', operator: '==', value: normalizedEmail }
    ]);

    // Always return success even if user doesn't exist (security best practice)
    if (users.length === 0) {
      return res.json({ message: 'If that email exists, a password reset link has been sent' });
    }

    const user = users[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

    // Store reset token in database
    await createDocument(MODELS.PASSWORD_RESETS, {
      userId: user.id,
      email: normalizedEmail,
      tokenHash,
      expiresAt
    });

    // Send email (implement this based on your email service)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=${resetToken}`;

    try {
      await sendPasswordResetEmail(normalizedEmail, resetUrl);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Continue anyway - token is stored
    }

    res.json({ message: 'If that email exists, a password reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Hash the provided token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset token
    const resetRequests = await queryDocuments(MODELS.PASSWORD_RESETS, [
      { field: 'tokenHash', operator: '==', value: tokenHash }
    ]);

    if (resetRequests.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const resetRequest = resetRequests[0];

    // Check if token is expired
    if (new Date(resetRequest.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Hash new password
    const passwordHash = User.schema.statics.hashPassword(newPassword);

    // Update user password
    await updateDocument(MODELS.USERS, resetRequest.userId, { passwordHash });

    // Delete used reset token
    await PasswordReset.deleteMany({ userId: resetRequest.userId });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (requires authentication)
 */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    // Get user with password
    const userDoc = await User.findById(req.user.userId);

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isPasswordValid = await userDoc.verifyPassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const passwordHash = User.schema.statics.hashPassword(newPassword);
    await updateDocument(MODELS.USERS, req.user.userId, { passwordHash });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
