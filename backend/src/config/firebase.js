import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
let firebaseApp = null;

export function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Option 1: Use service account JSON file (recommended for production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH.startsWith('/')
        ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        : join(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    // Option 2: Use service account JSON from environment variable
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    // Option 3: Use individual credentials from environment variables
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    else {
      throw new Error('Firebase configuration not found. Please set FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT, or individual Firebase credentials in environment variables.');
    }

    console.log('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
}

export function getFirebaseAuth() {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.auth();
}

// Verify Firebase ID token
export async function verifyFirebaseToken(idToken) {
  try {
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    throw error;
  }
}

// Create custom token (for testing or special cases)
export async function createCustomToken(uid, additionalClaims = {}) {
  try {
    const auth = getFirebaseAuth();
    const customToken = await auth.createCustomToken(uid, additionalClaims);
    return customToken;
  } catch (error) {
    console.error('Error creating custom token:', error);
    throw error;
  }
}

// Get user by UID
export async function getUserByUid(uid) {
  try {
    const auth = getFirebaseAuth();
    const userRecord = await auth.getUser(uid);
    return userRecord;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
}

// Create user in Firebase Auth
export async function createFirebaseUser(email, password, displayName = null, customClaims = {}) {
  try {
    const auth = getFirebaseAuth();
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });

    // Set custom claims if provided
    if (Object.keys(customClaims).length > 0) {
      await auth.setCustomUserClaims(userRecord.uid, customClaims);
    }

    return userRecord;
  } catch (error) {
    console.error('Error creating Firebase user:', error);
    throw error;
  }
}

// Update user in Firebase Auth
export async function updateFirebaseUser(uid, updates) {
  try {
    const auth = getFirebaseAuth();
    const userRecord = await auth.updateUser(uid, updates);
    return userRecord;
  } catch (error) {
    console.error('Error updating Firebase user:', error);
    throw error;
  }
}

// Delete user from Firebase Auth
export async function deleteFirebaseUser(uid) {
  try {
    const auth = getFirebaseAuth();
    await auth.deleteUser(uid);
    return true;
  } catch (error) {
    console.error('Error deleting Firebase user:', error);
    throw error;
  }
}

// Get Firestore instance
export function getFirestore() {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.firestore();
}

export default admin;

