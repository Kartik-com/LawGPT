# Firebase Authentication Schema

This document describes the Firebase Authentication schema and structure for the Lawyer Zen application.

## Overview

Firebase Authentication is used to securely manage user credentials and authentication. All user authentication data is stored in Firebase, while user profile data (name, role, barNumber, firm) is stored in MongoDB.

## Firebase User Structure

### User Record (Firebase Auth)

Firebase automatically stores the following fields:

```javascript
{
  uid: string,                    // Unique user ID (Firebase generated)
  email: string,                  // User email address
  emailVerified: boolean,         // Whether email is verified
  displayName: string | null,     // User display name
  photoURL: string | null,        // User photo URL
  disabled: boolean,              // Whether account is disabled
  metadata: {
    creationTime: string,         // Account creation timestamp
    lastSignInTime: string,       // Last sign-in timestamp
    lastRefreshTime: string       // Last token refresh timestamp
  },
  customClaims: {                 // Custom claims for role-based access
    role: 'lawyer' | 'assistant' | 'admin',
    barNumber?: string,
    firm?: string
  }
}
```

## MongoDB User Profile Schema

The MongoDB User model stores additional profile information:

```javascript
{
  _id: ObjectId,                  // MongoDB document ID
  firebaseUid: string,            // Reference to Firebase UID (required)
  name: string,                  // Full name
  email: string,                  // Email (synced with Firebase)
  role: string,                   // 'lawyer' | 'assistant' | 'admin'
  barNumber: string,              // Bar registration number (optional)
  firm: string,                   // Law firm name (optional)
  createdAt: Date,                // Account creation date
  updatedAt: Date                 // Last update date
}
```

## Authentication Flow

### 1. User Registration

```javascript
// Step 1: Create user in Firebase Auth
const firebaseUser = await createFirebaseUser(email, password, name, {
  role: 'lawyer',
  barNumber: barNumber || null,
  firm: firm || null
});

// Step 2: Create user profile in MongoDB
const userProfile = await User.create({
  firebaseUid: firebaseUser.uid,
  name: name,
  email: email,
  role: 'lawyer',
  barNumber: barNumber,
  firm: firm
});
```

### 2. User Login

```javascript
// Client sends Firebase ID token
// Server verifies token
const decodedToken = await verifyFirebaseToken(idToken);

// Get user profile from MongoDB using Firebase UID
const user = await User.findOne({ firebaseUid: decodedToken.uid });
```

### 3. Token Verification

```javascript
// Middleware verifies Firebase ID token
const decodedToken = await verifyFirebaseToken(req.headers.authorization);
req.user = {
  userId: decodedToken.uid,        // Firebase UID
  email: decodedToken.email,
  role: decodedToken.role         // From custom claims
};
```

## Custom Claims

Custom claims are used to store role and additional user metadata:

```javascript
{
  role: 'lawyer' | 'assistant' | 'admin',
  barNumber?: string,
  firm?: string
}
```

These claims are included in the Firebase ID token and can be accessed without a database query.

## Environment Variables

Required Firebase configuration:

```env
# Option 1: Service account JSON file path
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

# Option 2: Service account JSON as string (for cloud deployments)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Option 3: Individual credentials
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

## Security Considerations

1. **Never expose Firebase Admin SDK credentials** in client-side code
2. **Always verify Firebase ID tokens** on the server before granting access
3. **Use custom claims** for role-based access control
4. **Enable email verification** for production applications
5. **Implement rate limiting** on authentication endpoints
6. **Use HTTPS** in production to protect tokens in transit

## Migration from MongoDB Auth

If migrating from MongoDB-based authentication:

1. Create Firebase users for existing MongoDB users
2. Link Firebase UID to MongoDB user documents
3. Update authentication middleware to verify Firebase tokens
4. Update registration/login routes to use Firebase





