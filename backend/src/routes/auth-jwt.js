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
import { setCsrfToken } from '../middleware/csrf.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';
import { validate } from '../middleware/validate.js';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  reactivateSchema,
} from '../schemas/authSchemas.js';
import { blacklistToken, isTokenBlacklisted } from '../services/tokenService.js';

const router = express.Router();

// ── CSRF Token Endpoint ────────────────────────────────────────────────────────
// Sets csrf-token cookie (non-httpOnly) and returns token in body.
// Called by the frontend useCSRF hook on first render.
router.get('/csrf-token', setCsrfToken);


// Helper constants
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET + '_refresh');
const JWT_EXPIRES_IN = '15m'; // Short-lived access token
const JWT_REFRESH_EXPIRES_IN = '7d'; // Long-lived refresh token
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
    { expiresIn: JWT_EXPIRES_IN } // 15 min access token
  );
}

function generateRefreshToken(userId) {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/'
  });
}

function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/' // Must be '/' so clearCookie('/', ...) reliably removes it on logout
  });
}

function buildUserResponse(userId, profile) {
  // Auto-migrate existing users: if they have old fields populated, consider onboarding complete
  const hasLegacyData = profile.barNumber || profile.firm || profile.phone;
  const onboardingCompleted = profile.onboardingCompleted !== undefined
    ? profile.onboardingCompleted
    : (hasLegacyData ? true : false);

  return {
    id: userId,
    name: profile.name,
    email: profile.email,
    role: profile.role || 'lawyer',
    emailVerified: profile.emailVerified || false,
    onboardingCompleted,
    immutableFieldsLocked: profile.immutableFieldsLocked || false,
    profile: {
      fullName: profile.profile?.fullName || null,
      barCouncilNumber: profile.profile?.barCouncilNumber || profile.barNumber || null,
      currency: profile.profile?.currency || profile.preferences?.currency || null,
      phoneNumber: profile.profile?.phoneNumber || profile.phone || null,
      lawFirmName: profile.profile?.lawFirmName || profile.firm || null,
      practiceAreas: profile.profile?.practiceAreas || [],
      courtLevels: profile.profile?.courtLevels || [],
      address: profile.profile?.address || profile.address || null,
      city: profile.profile?.city || null,
      state: profile.profile?.state || null,
      country: profile.profile?.country || null,
      timezone: profile.profile?.timezone || profile.preferences?.timezone || null
    },
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
router.post('/register', validate({ body: registerSchema }), async (req, res) => {
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

    // Check if user already exists (including deleted users)
    // Use findOne to get all fields including 'deleted'
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      // Check if user was deleted - show dialog to confirm reactivation
      if (existingUser.status === 'deleted' || existingUser.deleted === true || existingUser.deletedAt) {
        console.log(`🗑️ Deleted account signup attempt: ${normalizedEmail}`);
        return res.status(409).json({
          errorCode: 'ACCOUNT_DELETED',
          error: 'This email belongs to a previously deleted account.'
        });
      }

      // User exists and is not deleted
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user in MongoDB
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: normalizeRole(role),
      barNumber: barNumber?.trim() || undefined,
      firm: firm?.trim() || undefined,
      emailVerified: false,
      onboardingCompleted: false, // New users must complete onboarding
      immutableFieldsLocked: false, // Immutable fields not yet set
      deleted: false, // Explicitly set to false
      notifications: defaultNotificationSettings,
      preferences: defaultPreferenceSettings,
      security: defaultSecuritySettings
    };

    const user = await createDocument(MODELS.USERS, userData);

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ User registered successfully:', user.email);
    }

    // Generate JWT + refresh token
    const token = generateJWT(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Set cookies
    setAuthCookie(res, token);
    setRefreshCookie(res, refreshToken);

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
 * POST /api/auth/reactivate
 * Reactivate a previously deleted account (called after user confirms dialog)
 */
router.post('/reactivate', validate({ body: reactivateSchema }), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (!existingUser) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (existingUser.status !== 'deleted' && !existingUser.deleted && !existingUser.deletedAt) {
      return res.status(400).json({ error: 'This account is not deleted' });
    }

    // Hash new password
    const passwordHash = await User.hashPassword(password);

    // Reactivate the account with fresh data
    const reactivatedUser = await User.findByIdAndUpdate(
      existingUser._id,
      {
        $set: {
          name: name.trim(),
          passwordHash,
          emailVerified: false,
          onboardingCompleted: false,
          immutableFieldsLocked: false,
          status: 'active',
          deleted: false,
          deletedAt: null,
          profile: {},
          notifications: defaultNotificationSettings,
          preferences: defaultPreferenceSettings,
          security: defaultSecuritySettings,
        }
      },
      { new: true }
    );

    console.log(`♻️ Account reactivated: ${reactivatedUser.email}`);

    const token = generateJWT(reactivatedUser._id.toString(), reactivatedUser.email, reactivatedUser.role);
    setAuthCookie(res, token);

    res.status(200).json({
      user: buildUserResponse(reactivatedUser._id.toString(), reactivatedUser),
      token,
      message: 'Account reactivated successfully'
    });
  } catch (error) {
    console.error('Reactivation error:', error);
    res.status(500).json({ error: 'Failed to reactivate account' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', validate({ body: loginSchema }), async (req, res) => {
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
      // For non-existent users, show generic error
      // Note: Hard-deleted users (deleted before soft-delete implementation) cannot be detected
      // Only soft-deleted users (deleted after implementation) will show the deleted account dialog
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Check if user account has been soft-deleted (support both old and new fields)
    if (user.status === 'deleted' || user.deleted === true || user.deletedAt) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ User account has been deleted:', normalizedEmail);
      }
      return res.status(403).json({
        success: false,
        errorCode: 'ACCOUNT_DELETED',
        message: 'This account was deleted previously.'
      });
    }

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

    // ⚠️ CRITICAL: Check if user account has been soft-deleted BEFORE password verification
    // Deleted users may have passwordHash set to null in old implementation, so password check would fail
    if (userDoc.status === 'deleted' || userDoc.deleted === true || userDoc.deletedAt) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ User account has been deleted:', normalizedEmail);
      }
      return res.status(403).json({
        success: false,
        errorCode: 'ACCOUNT_DELETED',
        message: 'This account was deleted previously.'
      });
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

    // Set access cookie + refresh cookie
    const refreshToken = generateRefreshToken(user.id);
    setAuthCookie(res, token);
    setRefreshCookie(res, refreshToken);

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
 * Logout user — clears both access + refresh token cookies
 */
router.post('/logout', async (req, res) => {
  const token = req.cookies?.token || (req.headers.authorization || '').replace('Bearer ', '');
  const refreshToken = (req.cookies?.refreshToken);

  // Blacklist tokens in Redis for immediate revocation across all instances
  if (token) {
    // Access tokens are 15m, so blacklist for 20m to be safe
    await blacklistToken(token, 20 * 60);
  }
  if (refreshToken) {
    // Refresh tokens are 7d, so blacklist for 7d
    await blacklistToken(refreshToken, 7 * 24 * 60 * 60);
  }

  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };
  // Clear access token (set at path '/')
  res.clearCookie('token', { ...base, path: '/' });
  // Clear refresh token — use same path it is set with ('/')
  res.clearCookie('refreshToken', { ...base, path: '/' });
  // Belt-and-suspenders: also clear legacy '/api' path in case old cookies exist
  res.clearCookie('refreshToken', { ...base, path: '/api' });
  res.clearCookie('refreshToken', { ...base, path: '/api/v1' });
  // Clear CSRF token so a fresh one is issued on next login
  res.clearCookie('csrf-token', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });

  res.json({ message: 'Logged out successfully' });
});

/**
 * POST /api/auth/refresh
 * Issue a new access token using the refresh token cookie
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      res.clearCookie('refreshToken', { httpOnly: true, path: '/' });
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Check if refresh token is blacklisted (revoked)
    if (await isTokenBlacklisted(refreshToken)) {
      console.error('Revoked refresh token used');
      res.clearCookie('refreshToken', { httpOnly: true, path: '/' });
      return res.status(401).json({ error: 'Refresh token has been revoked' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId).select('-passwordHash -resetPasswordToken -verificationToken');
    if (!user || user.status === 'deleted' || user.deleted) {
      res.clearCookie('refreshToken', { httpOnly: true, path: '/' });
      return res.status(401).json({ error: 'User not found or account is inactive' });
    }

    // Issue new access + refresh token pair (rotation)
    const newAccessToken = generateJWT(user._id.toString(), user.email, user.role);
    const newRefreshToken = generateRefreshToken(user._id.toString());

    // Revoke the old refresh token (rotation policy)
    await blacklistToken(refreshToken, 7 * 24 * 60 * 60);

    setAuthCookie(res, newAccessToken);
    setRefreshCookie(res, newRefreshToken);

    res.json({ token: newAccessToken, message: 'Token refreshed' });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const response = buildUserResponse(user._id.toString(), user);
    console.log('GET /me - profile data:', JSON.stringify(response.profile, null, 2));
    res.json({ user: response });
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
router.post('/forgot-password', validate({ body: forgotPasswordSchema }), async (req, res) => {
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
router.post('/reset-password', validate({ body: resetPasswordSchema }), async (req, res) => {
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
    const passwordHash = await User.hashPassword(newPassword);

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
 * PUT /api/auth/me
 * Update user profile and settings (unified endpoint)
 */
router.put('/me', requireAuth, async (req, res) => {
  console.log('🔥🔥🔥 PUT /me ENDPOINT HIT 🔥🔥🔥');
  try {
    const { name, profile, notifications, preferences, security } = req.body;

    console.log('📝 PUT /api/auth/me - Received:', JSON.stringify({ name, profile }, null, 2));

    // Get current user
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update object - only allow updating editable fields
    const updateFields = {};

    // Update display name if provided
    if (name !== undefined) {
      updateFields.name = name.trim();
    }

    // Update editable profile fields (NOT immutable: fullName, barCouncilNumber, currency)
    if (profile) {
      if (profile.lawFirmName !== undefined) updateFields['profile.lawFirmName'] = profile.lawFirmName?.trim() || null;
      if (profile.practiceAreas !== undefined) updateFields['profile.practiceAreas'] = profile.practiceAreas || [];
      if (profile.courtLevels !== undefined) updateFields['profile.courtLevels'] = profile.courtLevels || [];
      if (profile.phoneNumber !== undefined) updateFields['profile.phoneNumber'] = profile.phoneNumber?.trim() || null;
      if (profile.address !== undefined) updateFields['profile.address'] = profile.address?.trim() || null;
      if (profile.city !== undefined) updateFields['profile.city'] = profile.city?.trim() || null;
      if (profile.state !== undefined) updateFields['profile.state'] = profile.state?.trim() || null;
      if (profile.country !== undefined) updateFields['profile.country'] = profile.country?.trim() || null;
      if (profile.timezone !== undefined) updateFields['profile.timezone'] = profile.timezone || 'Asia/Kolkata';
    }

    // Update notification settings
    if (notifications) {
      updateFields.notifications = { ...(user.notifications?.toObject?.() || user.notifications || {}), ...notifications };
    }

    // Update preferences
    if (preferences) {
      updateFields.preferences = { ...(user.preferences?.toObject?.() || user.preferences || {}), ...preferences };
    }

    // Update security settings
    if (security) {
      updateFields.security = { ...(user.security?.toObject?.() || user.security || {}), ...security };
    }

    console.log('💾 Saving update fields:', JSON.stringify(updateFields, null, 2));

    // Perform update
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const response = buildUserResponse(updatedUser._id.toString(), updatedUser);
    console.log('✅ Profile updated. New profile:', JSON.stringify(response.profile, null, 2));

    res.json({
      user: response,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user data' });
  }
});

/**
 * PATCH /api/auth/settings/security
 * Update security settings
 */
router.patch('/settings/security', requireAuth, async (req, res) => {
  try {
    const user = await getDocumentById(MODELS.USERS, req.user.userId);

    const updatedSecurity = {
      ...defaultSecuritySettings,
      ...(user.security || {}),
      ...req.body
    };

    const updatedUser = await updateDocument(MODELS.USERS, req.user.userId, {
      security: updatedSecurity
    });

    res.json({ user: buildUserResponse(updatedUser.id, updatedUser) });
  } catch (error) {
    console.error('Update security settings error:', error);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (requires authentication)
 */
router.post('/change-password', requireAuth, validate({ body: changePasswordSchema }), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
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
    const passwordHash = await User.hashPassword(newPassword);
    await updateDocument(MODELS.USERS, req.user.userId, { passwordHash });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * GET /api/auth/export-data
 * Export all user data
 */
router.get('/export-data', requireAuth, async (req, res) => {
  try {
    const user = await getDocumentById(MODELS.USERS, req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch all user-related data
    const cases = await queryDocuments(MODELS.CASES, [
      { field: 'userId', operator: '==', value: req.user.userId }
    ]);

    const clients = await queryDocuments(MODELS.CLIENTS, [
      { field: 'userId', operator: '==', value: req.user.userId }
    ]);

    const documents = await queryDocuments(MODELS.DOCUMENTS, [
      { field: 'userId', operator: '==', value: req.user.userId }
    ]);

    const hearings = await queryDocuments(MODELS.HEARINGS, [
      { field: 'userId', operator: '==', value: req.user.userId }
    ]);

    const invoices = await queryDocuments(MODELS.INVOICES, [
      { field: 'userId', operator: '==', value: req.user.userId }
    ]);

    // Compile export data
    const exportData = {
      exportDate: new Date().toISOString(),
      user: buildUserResponse(user.id, user),
      data: {
        cases,
        clients,
        documents,
        hearings,
        invoices
      },
      statistics: {
        totalCases: cases.length,
        totalClients: clients.length,
        totalDocuments: documents.length,
        totalHearings: hearings.length,
        totalInvoices: invoices.length
      }
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="lawgpt-data-export-${Date.now()}.json"`);

    res.json(exportData);
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

/**
 * DELETE /api/auth/delete-account
 * Delete user account and all associated data
 */
router.delete('/delete-account', requireAuth, async (req, res) => {
  try {
    const { password, confirmation } = req.body;

    // Require password confirmation
    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete account' });
    }

    // Require explicit confirmation
    if (confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Please type DELETE to confirm account deletion' });
    }

    // Get user with password
    const userDoc = await User.findById(req.user.userId);

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const isPasswordValid = await userDoc.verifyPassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Soft delete: Mark user as deleted instead of removing from database
    // This allows for account recovery and prevents email reuse issues
    await User.findByIdAndUpdate(req.user.userId, {
      status: 'deleted',
      deleted: true,      // Keep for backward compatibility
      deletedAt: new Date()
      // DO NOT clear passwordHash - preserve it for security and potential verification
    });

    console.log(`✅ User account marked as deleted: ${req.user.userId}`);

    // Clear auth cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

/**
 * POST /api/auth/complete-onboarding
 * Complete user onboarding with immutable profile fields
 */
router.post('/complete-onboarding', requireAuth, async (req, res) => {
  try {
    const {
      fullName,
      fullNameConfirm,
      barCouncilNumber,
      barCouncilNumberConfirm,
      currency,
      currencyConfirm,
      lawFirmName,
      practiceAreas,
      courtLevels,
      phoneNumber,
      address,
      city,
      state,
      country,
      timezone
    } = req.body;

    // Get current user
    const user = await getDocumentById(MODELS.USERS, req.user.userId);

    // Check if already completed
    if (user.onboardingCompleted) {
      return res.status(400).json({
        errorCode: 'ONBOARDING_ALREADY_COMPLETED',
        error: 'Onboarding already completed'
      });
    }

    // Validate immutable fields - Full Name
    if (!fullName?.trim() || !fullNameConfirm?.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (fullName !== fullNameConfirm) {
      return res.status(400).json({ error: 'Full names do not match' });
    }

    // Validate immutable fields - Bar Council Number
    if (!barCouncilNumber?.trim() || !barCouncilNumberConfirm?.trim()) {
      return res.status(400).json({ error: 'Bar Council Number is required' });
    }
    if (barCouncilNumber !== barCouncilNumberConfirm) {
      return res.status(400).json({ error: 'Bar Council Numbers do not match' });
    }

    // CRITICAL: Check Bar Council Number uniqueness across ACTIVE users only
    const existingBar = await User.findOne({
      'profile.barCouncilNumber': barCouncilNumber.trim(),
      status: 'active'
    });

    if (existingBar && existingBar._id.toString() !== req.user.userId) {
      return res.status(409).json({
        errorCode: 'BAR_COUNCIL_EXISTS',
        message: 'This Bar Council Number is already registered.',
        error: 'This Bar Council Number is already registered.'
      });
    }

    // Validate immutable fields - Currency
    if (!currency || !currencyConfirm) {
      return res.status(400).json({ error: 'Currency is required' });
    }
    if (currency !== currencyConfirm) {
      return res.status(400).json({ error: 'Currency selections do not match' });
    }

    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AED'];
    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({ error: 'Invalid currency selection' });
    }

    // Build audit trail entries for all fields
    const auditEntries = [];
    const now = new Date();

    // Audit immutable fields
    auditEntries.push(
      { fieldName: 'fullName', value: fullName.trim(), enteredAt: now },
      { fieldName: 'barCouncilNumber', value: barCouncilNumber.trim(), enteredAt: now },
      { fieldName: 'currency', value: currency, enteredAt: now }
    );

    // Audit optional fields (only if provided)
    if (phoneNumber?.trim()) {
      auditEntries.push({ fieldName: 'phoneNumber', value: phoneNumber.trim(), enteredAt: now });
    }
    if (lawFirmName?.trim()) {
      auditEntries.push({ fieldName: 'lawFirmName', value: lawFirmName.trim(), enteredAt: now });
    }
    if (practiceAreas && practiceAreas.length > 0) {
      auditEntries.push({ fieldName: 'practiceAreas', value: practiceAreas.join(', '), enteredAt: now });
    }
    if (courtLevels && courtLevels.length > 0) {
      auditEntries.push({ fieldName: 'courtLevels', value: courtLevels.join(', '), enteredAt: now });
    }
    if (address?.trim()) {
      auditEntries.push({ fieldName: 'address', value: address.trim(), enteredAt: now });
    }
    if (city?.trim()) {
      auditEntries.push({ fieldName: 'city', value: city.trim(), enteredAt: now });
    }
    if (state?.trim()) {
      auditEntries.push({ fieldName: 'state', value: state.trim(), enteredAt: now });
    }
    if (country?.trim()) {
      auditEntries.push({ fieldName: 'country', value: country.trim(), enteredAt: now });
    }
    if (timezone) {
      auditEntries.push({ fieldName: 'timezone', value: timezone, enteredAt: now });
    }

    // Perform atomic update using Mongoose directly for better control
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          onboardingCompleted: true,
          immutableFieldsLocked: true,
          'profile.fullName': fullName.trim(),
          'profile.barCouncilNumber': barCouncilNumber.trim(),
          'profile.currency': currency,
          'profile.phoneNumber': phoneNumber?.trim() || null,
          'profile.lawFirmName': lawFirmName?.trim() || null,
          'profile.practiceAreas': practiceAreas || [],
          'profile.courtLevels': courtLevels || [],
          'profile.address': address?.trim() || null,
          'profile.city': city?.trim() || null,
          'profile.state': state?.trim() || null,
          'profile.country': country?.trim() || null,
          'profile.timezone': timezone || 'Asia/Kolkata',
          // Also save to preferences so Settings page and app-wide context reflect it
          'preferences.timezone': timezone || 'Asia/Kolkata',
          'preferences.currency': currency,
        },
        $push: {
          onboardingDataAudit: { $each: auditEntries }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`✅ User ${updatedUser.email} completed onboarding with currency: ${currency}`);
    console.log(`📝 Audit trail: ${auditEntries.length} fields recorded`);

    res.json({
      user: buildUserResponse(updatedUser.id, updatedUser),
      message: 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);

    // Handle duplicate key errors specifically
    if (error.code === 11000 && error.keyPattern?.['profile.barCouncilNumber']) {
      return res.status(409).json({
        errorCode: 'BAR_COUNCIL_EXISTS',
        message: 'This Bar Council Number is already registered.',
        error: 'This Bar Council Number is already registered.'
      });
    }

    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

export default router;

