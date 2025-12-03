import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';
import {
  createFirebaseUser,
  verifyFirebaseToken,
  updateFirebaseUser,
  getFirestore,
  getFirebaseAuth
} from '../config/firebase.js';
import admin from 'firebase-admin';
import {
  createDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  queryDocuments,
  COLLECTIONS
} from '../services/firestore.js';
import { requireAuth } from '../middleware/auth.js';

import { getFirebaseWebApiKey, ensureFirebaseWebApiKey } from '../utils/env.js';

const db = getFirestore();
import { sendPasswordResetEmail } from '../utils/mailer.js';

const router = express.Router();

const FIREBASE_WEB_API_KEY = getFirebaseWebApiKey();
const resolvedFetch = globalThis.fetch || fetch;
if (!globalThis.fetch) {
  globalThis.fetch = resolvedFetch;
}

// Fail fast in production so deployments cannot miss the API key silently.
try {
  ensureFirebaseWebApiKey({ requireInProduction: true });
} catch (error) {
  console.error(error.message);
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw error;
  }
}
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const ALLOWED_ROLES = ['lawyer', 'assistant'];

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

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function normalizeRole(role) {
  if (!role) return 'lawyer';
  const normalized = role.toString().toLowerCase();
  return ALLOWED_ROLES.includes(normalized) ? normalized : 'lawyer';
}

function mergeSettings(defaults, existing = {}, incoming = {}) {
  return {
    ...defaults,
    ...existing,
    ...incoming
  };
}

function buildUserResponse(userId, profile) {
  return {
    id: userId,
    name: profile.name,
    email: profile.email,
    role: profile.role || 'lawyer',
    barNumber: profile.barNumber,
    firm: profile.firm,
    phone: profile.phone || '',
    address: profile.address || '',
    bio: profile.bio || '',
    emailVerified: profile.emailVerified || false,
    notifications: mergeSettings(
      defaultNotificationSettings,
      profile.notifications
    ),
    preferences: mergeSettings(
      defaultPreferenceSettings,
      profile.preferences
    ),
    security: mergeSettings(
      defaultSecuritySettings,
      profile.security
    )
  };
}

async function verifyPasswordWithFirebase(email, password) {
  if (!FIREBASE_WEB_API_KEY) {
    const err = new Error('Firebase Web API key is not configured');
    err.code = 'MISSING_FIREBASE_WEB_API_KEY';
    throw err;
  }

  const response = await resolvedFetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const firebaseMessage = data?.error?.message || 'INVALID_LOGIN_CREDENTIALS';
    if (['EMAIL_NOT_FOUND', 'INVALID_PASSWORD', 'USER_DISABLED', 'INVALID_LOGIN_CREDENTIALS'].includes(firebaseMessage)) {
      const err = new Error('Invalid credentials');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const err = new Error(firebaseMessage);
    err.code = firebaseMessage;
    throw err;
  }

  return {
    uid: data.localId,
    email: data.email
  };
}

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, barNumber, firm } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Normalize role input (prevent admin self sign-ups)
    const normalizedRole = normalizeRole(role);

    // Check if user already exists in Firestore
    const existingUsers = await queryDocuments(COLLECTIONS.USERS, [
      { field: 'email', operator: '==', value: email.toLowerCase() }
    ]);

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create user in Firebase Auth
    const firebaseUser = await createFirebaseUser(
      email.toLowerCase(),
      password,
      name.trim(),
      {
        role: normalizedRole,
        barNumber: barNumber || null,
        firm: firm || null,
      }
    );


    // Generate email verification token
    const { generateVerificationToken, hashToken, sendVerificationEmail } = require('../utils/emailVerification');
    const verificationToken = generateVerificationToken();
    const hashedToken = hashToken(verificationToken);
    // Create user profile in Firestore (use Firebase UID as document ID)
    const userProfileData = {
      firebaseUid: firebaseUser.uid,
      name: name.trim(),
      email: email.toLowerCase(),
      role: normalizedRole,
    };

    // Only add optional fields if they have values
    if (barNumber?.trim()) {
      userProfileData.barNumber = barNumber.trim();
    }
    if (firm?.trim()) {
      userProfileData.firm = firm.trim();
    }

    // Use Firebase UID as document ID for easy lookup
    await db.collection(COLLECTIONS.USERS).doc(firebaseUser.uid).set({
      ...userProfileData,
      notifications: defaultNotificationSettings,
      preferences: defaultPreferenceSettings,
      security: defaultSecuritySettings,
      // Email verification fields
      emailVerified: false,
      verificationToken: hashedToken,
      verificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });



    // Send verification email
    try {
      await sendVerificationEmail(email.toLowerCase(), name.trim(), verificationToken);
      console.log(`Verification email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails - user can resend later
    }

    const userProfile = buildUserResponse(firebaseUser.uid, {
      ...userProfileData,
      notifications: defaultNotificationSettings,
      preferences: defaultPreferenceSettings,
      security: defaultSecuritySettings,
    });

    // Create session token for automatic login
    const sessionToken = Buffer.from(JSON.stringify({
      uid: firebaseUser.uid,
      email: email.toLowerCase(),
      role: normalizedRole
    })).toString('base64');

    // Set cookie with session token
    // Use 'lax' for development (works with Vite proxy) and 'none' for production (cross-origin)
    res.cookie('token', sessionToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    return res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      token: sessionToken,
      user: userProfile,
      emailVerificationRequired: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (error.code === 'auth/weak-password') {
      return res.status(400).json({ error: 'Password is too weak' });
    }

    if (error.code === 'auth/invalid-credential') {
      return res.status(500).json({
        error: 'Firebase authentication failed',
        details: 'Invalid Firebase credentials. Check your service account configuration.',
        code: error.code
      });
    }

    // Handle Firestore errors
    if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
      return res.status(500).json({
        error: 'Firestore permission denied',
        details: 'Check Firestore security rules and service account permissions.',
        code: 'FIRESTORE_PERMISSION_DENIED'
      });
    }

    if (error.message?.includes('Firestore API') || error.message?.includes('API is not enabled')) {
      return res.status(500).json({
        error: 'Firestore API is not enabled',
        details: 'Enable Firestore API in Google Cloud Console: https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=lawgpt-7cb25',
        code: 'FIRESTORE_NOT_ENABLED'
      });
    }

    // Handle network/timeout errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(500).json({
        error: 'Firebase connection failed',
        details: 'Cannot connect to Firebase services. Check your internet connection and Firebase status.',
        code: error.code
      });
    }

    // Return detailed error (always include details in development)
    const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

    return res.status(500).json({
      error: 'Registration failed',
      ...(isDevelopment && {
        details: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN_ERROR',
        errorName: error.name,
        stack: error.stack
      }),
      ...(!isDevelopment && {
        details: 'An error occurred during registration. Please try again later.'
      })
    });
  }
});

// Verify email with token
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const { hashToken, isTokenExpired } = require('../utils/emailVerification');
    const hashedToken = hashToken(token);

    // Find user with this verification token
    const users = await queryDocuments(COLLECTIONS.USERS, [
      { field: 'verificationToken', operator: '==', value: hashedToken }
    ]);

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    const userProfile = users[0];
    const userId = userProfile.id || userProfile._id;

    // Check if already verified
    if (userProfile.emailVerified) {
      return res.json({
        ok: true,
        message: 'Email already verified',
        alreadyVerified: true
      });
    }

    // Check if token expired
    if (isTokenExpired(userProfile.verificationSentAt)) {
      return res.status(400).json({
        error: 'Verification token has expired. Please request a new one.',
        expired: true
      });
    }

    // Mark as verified
    await updateDocument(COLLECTIONS.USERS, userId, {
      emailVerified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      verificationToken: null // Clear the token
    });

    console.log(`Email verified for user: ${userProfile.email}`);

    return res.json({
      ok: true,
      message: 'Email verified successfully! You can now log in.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const users = await queryDocuments(COLLECTIONS.USERS, [
      { field: 'email', operator: '==', value: normalizedEmail }
    ]);

    if (users.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json({
        ok: true,
        message: 'If the email exists and is unverified, a verification email has been sent.'
      });
    }

    const userProfile = users[0];
    const userId = userProfile.id || userProfile._id;

    // Check if already verified
    if (userProfile.emailVerified) {
      return res.json({
        ok: true,
        message: 'Email is already verified',
        alreadyVerified: true
      });
    }

    // Check rate limiting
    const { canResendVerification, generateVerificationToken, hashToken, sendVerificationEmail } = require('../utils/emailVerification');

    if (!canResendVerification(userProfile.verificationSentAt)) {
      return res.status(429).json({
        error: 'Please wait before requesting another verification email',
        retryAfter: 60 // seconds
      });
    }

    // Generate new token
    const verificationToken = generateVerificationToken();
    const hashedToken = hashToken(verificationToken);

    // Update user with new token
    await updateDocument(COLLECTIONS.USERS, userId, {
      verificationToken: hashedToken,
      verificationSentAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send verification email
    try {
      await sendVerificationEmail(normalizedEmail, userProfile.name, verificationToken);
      console.log(`Verification email resent to ${normalizedEmail}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    return res.json({
      ok: true,
      message: 'Verification email sent. Please check your inbox.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// Login - Accept email/password, verify with Firebase Auth REST API
router.post('/login', async (req, res) => {
  try {
    const { email, password, idToken } = req.body;

    let decodedToken;

    if (idToken) {
      decodedToken = await verifyFirebaseToken(idToken);
    } else if (email && password) {
      const normalizedEmail = email.toLowerCase().trim();
      try {
        const verifiedUser = await verifyPasswordWithFirebase(normalizedEmail, password);
        decodedToken = {
          uid: verifiedUser.uid,
          email: (verifiedUser.email || normalizedEmail)
        };
      } catch (error) {
        if (error.code === 'MISSING_FIREBASE_WEB_API_KEY') {
          return res.status(500).json({
            error: 'Password verification is not configured on the server. Please set FIREBASE_WEB_API_KEY.'
          });
        }
        if (error.code === 'INVALID_CREDENTIALS') {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        console.error('Password verification failed:', error);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      return res.status(400).json({ error: 'Email and password, or ID token is required' });
    }

    let userProfile = await getDocumentById(COLLECTIONS.USERS, decodedToken.uid);

    if (!userProfile) {
      const auth = getFirebaseAuth();
      const authRecord = await auth.getUser(decodedToken.uid);
      console.warn(`User ${decodedToken.uid} exists without profile. Creating default profile...`);
      const fallbackName = authRecord.displayName || decodedToken.email?.split('@')[0] || 'User';
      const profileData = {
        firebaseUid: decodedToken.uid,
        name: fallbackName,
        email: (decodedToken.email || authRecord.email || '').toLowerCase(),
        role: 'lawyer',
        notifications: defaultNotificationSettings,
        preferences: defaultPreferenceSettings,
        security: defaultSecuritySettings,
      };
      await db.collection(COLLECTIONS.USERS).doc(decodedToken.uid).set({
        ...profileData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      userProfile = { id: decodedToken.uid, ...profileData };
    }

    const responseUser = buildUserResponse(decodedToken.uid, userProfile);

    const sessionToken = Buffer.from(JSON.stringify({
      uid: decodedToken.uid,
      email: responseUser.email,
      role: responseUser.role
    })).toString('base64');

    res.cookie('token', sessionToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    return res.json({
      token: sessionToken,
      user: responseUser
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  const cookieOptions = [
    { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' },
    { httpOnly: true, sameSite: 'none', secure: true, path: '/' },
    { path: '/' },
  ];

  cookieOptions.forEach(options => {
    res.clearCookie('token', options);
  });

  res.cookie('token', '', {
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });

  return res.json({ ok: true, message: 'Logged out successfully' });
});

// Get current user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userProfile = await getDocumentById(COLLECTIONS.USERS, req.user.userId);

    if (!userProfile) {
      res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      return res.status(401).json({ error: 'User not found' });
    }

    return res.json({
      user: buildUserResponse(req.user.userId, userProfile)
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
    return res.status(401).json({ error: 'Authentication failed' });
  }
});

// Update user profile
router.put('/me', requireAuth, async (req, res) => {
  try {
    const {
      name,
      barNumber,
      firm,
      phone,
      address,
      bio,
      notifications,
      preferences,
      security
    } = req.body;

    const existingProfile = await getDocumentById(COLLECTIONS.USERS, req.user.userId);
    if (!existingProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = {};

    if (name !== undefined) updates.name = name?.trim() || existingProfile.name;
    if (barNumber !== undefined) updates.barNumber = barNumber?.trim() || null;
    if (firm !== undefined) updates.firm = firm?.trim() || null;
    if (phone !== undefined) updates.phone = phone?.trim() || '';
    if (address !== undefined) updates.address = address?.trim() || '';
    if (bio !== undefined) updates.bio = bio?.trim() || '';

    if (notifications) {
      updates.notifications = mergeSettings(
        defaultNotificationSettings,
        existingProfile.notifications,
        notifications
      );
    }

    if (preferences) {
      updates.preferences = mergeSettings(
        defaultPreferenceSettings,
        existingProfile.preferences,
        preferences
      );
    }

    if (security) {
      updates.security = mergeSettings(
        defaultSecuritySettings,
        existingProfile.security,
        security
      );
    }

    const updatedProfile = await updateDocument(COLLECTIONS.USERS, req.user.userId, updates);

    if (name) {
      try {
        await updateFirebaseUser(req.user.userId, { displayName: name.trim() });
      } catch (error) {
        console.error('Error updating Firebase Auth:', error);
      }
    }

    return res.json({
      user: buildUserResponse(req.user.userId, updatedProfile)
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Password reset request
router.post('/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const users = await queryDocuments(COLLECTIONS.USERS, [
      { field: 'email', operator: '==', value: normalizedEmail }
    ]);

    if (users.length === 0) {
      return res.json({ ok: true });
    }

    const userProfile = users[0];
    const userId = userProfile.id || userProfile._id;
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS)
    );

    // Remove existing tokens for user
    const existingTokens = await queryDocuments(COLLECTIONS.PASSWORD_RESETS, [
      { field: 'userId', operator: '==', value: userId }
    ]);
    await Promise.all(
      existingTokens.map(tokenDoc => deleteDocument(COLLECTIONS.PASSWORD_RESETS, tokenDoc.id))
    );

    await createDocument(COLLECTIONS.PASSWORD_RESETS, {
      userId,
      email: normalizedEmail,
      tokenHash,
      expiresAt
    });

    const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:8080';
    const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

    let previewUrl;
    try {
      const mailResult = await sendPasswordResetEmail({
        to: normalizedEmail,
        resetUrl
      });
      previewUrl = mailResult?.previewUrl;
    } catch (mailError) {
      console.error('Failed to send password reset email:', mailError?.message || mailError);
    }

    const response = {
      ok: true,
      message: 'If the email exists, a reset link has been sent.'
    };

    if (process.env.NODE_ENV !== 'production') {
      response.token = token;
      response.resetUrl = resetUrl;
      if (previewUrl) {
        response.previewUrl = previewUrl;
      }
    }

    return res.json(response);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const tokenHash = hashToken(token);
    const resetRequests = await queryDocuments(COLLECTIONS.PASSWORD_RESETS, [
      { field: 'tokenHash', operator: '==', value: tokenHash }
    ]);

    if (resetRequests.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const now = new Date();
    const validRequest = resetRequests.find(request => {
      const expires = request.expiresAt?.toDate ? request.expiresAt.toDate() : new Date(request.expiresAt);
      return expires && expires > now;
    });

    if (!validRequest) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const userId = validRequest.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    const auth = getFirebaseAuth();
    await auth.updateUser(userId, { password });

    const userTokens = await queryDocuments(COLLECTIONS.PASSWORD_RESETS, [
      { field: 'userId', operator: '==', value: userId }
    ]);
    await Promise.all(
      userTokens.map(record => deleteDocument(COLLECTIONS.PASSWORD_RESETS, record.id))
    );

    return res.json({ ok: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;

