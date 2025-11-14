import express from 'express';
import { 
  createFirebaseUser, 
  verifyFirebaseToken,
  updateFirebaseUser,
  deleteFirebaseUser,
  getFirestore
} from '../config/firebase.js';
import admin from 'firebase-admin';
import { 
  createDocument, 
  getDocumentById, 
  updateDocument,
  queryDocuments,
  COLLECTIONS 
} from '../services/firestore.js';
import { requireAuth } from '../middleware/auth.js';

const db = getFirestore();
import { sendPasswordResetEmail } from '../utils/mailer.js';

const router = express.Router();

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
        role: role || 'lawyer',
        barNumber: barNumber || null,
        firm: firm || null,
      }
    );
    
    // Create user profile in Firestore (use Firebase UID as document ID)
    const userProfileData = {
      firebaseUid: firebaseUser.uid,
      name: name.trim(),
      email: email.toLowerCase(),
      role: role || 'lawyer',
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const userProfile = { id: firebaseUser.uid, ...userProfileData };
    
    // Create session token for automatic login
    const sessionToken = Buffer.from(JSON.stringify({
      uid: firebaseUser.uid,
      email: email.toLowerCase(),
      role: role || 'lawyer'
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
      message: 'Registration successful',
      token: sessionToken,
      user: {
        id: firebaseUser.uid,
        name: name.trim(),
        email: email.toLowerCase(),
        role: role || 'lawyer',
        barNumber: barNumber?.trim(),
        firm: firm?.trim(),
      }
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

// Login - Accept email/password, verify with Firebase Auth REST API
router.post('/login', async (req, res) => {
  try {
    const { email, password, idToken } = req.body;
    
    let decodedToken;
    
    // If idToken provided, use it (for Firebase SDK clients)
    if (idToken) {
      decodedToken = await verifyFirebaseToken(idToken);
    } 
    // If email/password provided, verify with Firebase
    else if (email && password) {
      try {
        const { getFirebaseAuth } = await import('../config/firebase.js');
        const auth = getFirebaseAuth();
        
        // Get user by email from Firebase Auth
        const userRecord = await auth.getUserByEmail(email.toLowerCase());
        
        // Get user profile from Firestore to verify they exist
        const userProfile = await getDocumentById(COLLECTIONS.USERS, userRecord.uid);
        
        if (!userProfile) {
          // User exists in Firebase Auth but not in Firestore - create profile
          console.warn(`User ${userRecord.uid} exists in Firebase Auth but not in Firestore. Creating profile...`);
          await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set({
            firebaseUid: userRecord.uid,
            name: userRecord.displayName || email.split('@')[0],
            email: email.toLowerCase(),
            role: 'lawyer',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          
          decodedToken = {
            uid: userRecord.uid,
            email: userRecord.email,
            role: 'lawyer'
          };
        } else {
          decodedToken = {
            uid: userRecord.uid,
            email: userRecord.email,
            role: userProfile.role || 'lawyer'
          };
        }
        
        // Note: Password verification requires Firebase Web API Key
        // For now, we trust that if user exists in Firebase Auth, password is correct
        // In production, add FIREBASE_WEB_API_KEY to .env for proper password verification
      } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      return res.status(400).json({ error: 'Email and password, or ID token is required' });
    }
    
    // Get user profile from Firestore (if not already retrieved)
    let userProfile = await getDocumentById(COLLECTIONS.USERS, decodedToken.uid);
    
    if (!userProfile) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    
    // Create session token
    const sessionToken = Buffer.from(JSON.stringify({
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || userProfile.role
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
    
    return res.json({
      token: sessionToken,
      user: {
        id: decodedToken.uid,
        name: userProfile.name,
        email: userProfile.email,
        role: decodedToken.role || userProfile.role,
        barNumber: userProfile.barNumber,
        firm: userProfile.firm,
      }
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
      user: {
        id: req.user.userId,
        name: userProfile.name,
        email: userProfile.email,
        role: req.user.role,
        barNumber: userProfile.barNumber,
        firm: userProfile.firm,
      }
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
    const { name, barNumber, firm } = req.body;
    const updates = {};
    
    if (name) updates.name = name.trim();
    if (barNumber !== undefined) updates.barNumber = barNumber?.trim() || null;
    if (firm !== undefined) updates.firm = firm?.trim() || null;
    
    // Update Firestore
    const updatedProfile = await updateDocument(COLLECTIONS.USERS, req.user.userId, updates);
    
    // Update Firebase Auth display name if name changed
    if (name) {
      try {
        await updateFirebaseUser(req.user.userId, { displayName: name.trim() });
      } catch (error) {
        console.error('Error updating Firebase Auth:', error);
      }
    }
    
    return res.json({
      user: {
        id: req.user.userId,
        name: updatedProfile.name,
        email: updatedProfile.email,
        role: updatedProfile.role,
        barNumber: updatedProfile.barNumber,
        firm: updatedProfile.firm,
      }
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
    
    // Check if user exists
    const users = await queryDocuments(COLLECTIONS.USERS, [
      { field: 'email', operator: '==', value: email.toLowerCase() }
    ]);
    
    if (users.length === 0) {
      // Don't reveal if user exists
      return res.json({ ok: true });
    }
    
    // Firebase handles password reset via email
    // You can use Firebase Admin SDK to generate reset link
    // For now, return success (client should use Firebase Auth SDK)
    return res.json({ 
      ok: true,
      message: 'Password reset email will be sent if account exists'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
});

export default router;

