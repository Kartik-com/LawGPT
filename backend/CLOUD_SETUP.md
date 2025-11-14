# Cloud Storage Setup Guide

This guide explains how to set up Firebase Authentication and Cloudinary media storage for the Lawyer Zen application.

## Overview

The application now uses:
- **Firebase Authentication** for secure user credential management
- **Cloudinary** for secure cloud-based media storage
- **MongoDB** for application data (cases, clients, documents metadata, etc.)

## Prerequisites

1. A Firebase project with Authentication enabled
2. A Cloudinary account
3. Node.js and npm installed

## Step 1: Firebase Setup

### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Enable Authentication:
   - Go to Authentication → Sign-in method
   - Enable Email/Password provider

### 1.2 Get Service Account Credentials

1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file (keep it secure!)
4. Save it as `config/firebase-service-account.json` in your backend directory

**OR** use environment variables (see below)

### 1.3 Configure Environment Variables

Add to your `.env` file:

```env
# Option 1: Service account file path (recommended for local dev)
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

# Option 2: Service account JSON as string (for cloud deployments)
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Option 3: Individual credentials
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

## Step 2: Cloudinary Setup

### 2.1 Create Cloudinary Account

1. Go to [Cloudinary](https://cloudinary.com/) and sign up (free tier available)
2. After signup, you'll be taken to your dashboard

### 2.2 Get API Credentials

From your Cloudinary dashboard, you'll find:
- **Cloud Name**: Your cloud name
- **API Key**: Your API key
- **API Secret**: Your API secret (keep it secure!)

### 2.3 Configure Environment Variables

Add to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Step 3: Install Dependencies

Run the following command in your backend directory:

```bash
npm install
```

This will install:
- `firebase-admin` - Firebase Admin SDK
- `cloudinary` - Cloudinary SDK

## Step 4: Update User Model (Optional)

If you want to use Firebase for authentication, you may want to update your User model to include a `firebaseUid` field:

```javascript
{
  firebaseUid: { type: String, unique: true }, // Link to Firebase UID
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  // ... other fields
}
```

## Step 5: Test the Setup

### Test Firebase

```bash
# Start your server
npm run dev

# You should see:
# "Firebase initialized successfully" (if configured)
# OR
# "Firebase not configured..." (if not configured - that's OK for now)
```

### Test Cloudinary

Upload a file through your application. It should:
1. Upload to Cloudinary
2. Store the Cloudinary URL in your database
3. Return the secure URL for access

## Security Best Practices

### Firebase

1. **Never commit service account files** to version control
2. Add `config/firebase-service-account.json` to `.gitignore`
3. Use environment variables in production
4. Enable email verification for production
5. Set up Firebase Security Rules if using Firestore

### Cloudinary

1. **Never commit API secrets** to version control
2. Use environment variables for all credentials
3. Enable signed uploads for production (optional)
4. Set up upload presets with restrictions:
   - File size limits
   - Allowed file types
   - Folder structure
5. Use secure URLs (`secure_url`) for all file access

## File Structure

After setup, your files will be organized in Cloudinary as:

```
lawyer-zen/
  ├── user-{userId}/
  │   ├── folder-{folderId}/
  │   │   └── documents...
  │   └── documents...
  └── shared/
```

## Migration from Local Storage

If you have existing files in local storage:

1. **Keep the `/uploads` route** (already configured for backward compatibility)
2. **Gradually migrate files**:
   - Upload existing files to Cloudinary
   - Update Document records with Cloudinary URLs
   - Remove local files after verification

## Troubleshooting

### Firebase Issues

**Error: "Firebase configuration not found"**
- Check that you've set one of the Firebase environment variables
- Verify the service account file path is correct
- Ensure the JSON file is valid

**Error: "Permission denied"**
- Verify your service account has proper permissions
- Check that Authentication is enabled in Firebase Console

### Cloudinary Issues

**Error: "Invalid API credentials"**
- Double-check your Cloudinary credentials in `.env`
- Verify credentials in Cloudinary dashboard
- Ensure no extra spaces in environment variables

**Error: "File upload failed"**
- Check file size (default limit: 100MB)
- Verify file type is supported
- Check Cloudinary account limits (free tier: 25MB per file)

## Next Steps

1. **Update authentication routes** to use Firebase (if desired)
2. **Update frontend** to use Firebase Auth SDK
3. **Test file uploads** through the application
4. **Set up monitoring** for both services
5. **Configure backup strategies** for important data

## Support

- Firebase Documentation: https://firebase.google.com/docs
- Cloudinary Documentation: https://cloudinary.com/documentation
- Schema Reference: See `src/schemas/firebase-schema.md` and `src/schemas/cloudinary-schema.md`





