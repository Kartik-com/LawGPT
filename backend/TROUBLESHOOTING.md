# 🔧 Troubleshooting Guide

## Common Errors and Solutions

### Error: 401 Unauthorized on all routes

**Cause:** Authentication token not being recognized

**Solutions:**
1. **Check if you're logged in:**
   - Try registering a new account first
   - Or login with existing credentials

2. **Clear browser cookies:**
   - Open browser DevTools (F12)
   - Go to Application → Cookies
   - Delete all cookies for `localhost:8080`
   - Refresh page and try again

3. **Check backend logs:**
   - Look at terminal where `npm run dev` is running
   - Check for "Token verification failed" messages
   - Check for "User profile not found" messages

4. **Verify user exists in Firestore:**
   - Go to Firebase Console
   - Check Firestore Database
   - Look for `users` collection
   - Verify your user document exists

---

### Error: 500 Internal Server Error on Registration

**Cause:** Firebase or Firestore operation failed

**Solutions:**
1. **Check backend terminal for error details:**
   - Look for "Registration error:" messages
   - Check the error code and message

2. **Common Firebase errors:**
   - `auth/email-already-exists` → Email already registered
   - `auth/invalid-email` → Invalid email format
   - `auth/weak-password` → Password too weak

3. **Check Firebase configuration:**
   - Verify `firebase-service-account.json` exists
   - Check `.env` has correct path
   - Verify Firebase Authentication is enabled
   - Verify Firestore Database is enabled

4. **Check Firestore permissions:**
   - Go to Firebase Console
   - Firestore Database → Rules
   - Make sure test mode is enabled (for development)

---

### Error: "User profile not found"

**Cause:** User exists in Firebase Auth but not in Firestore

**Solution:**
1. **Manual fix:**
   - Go to Firebase Console
   - Check Authentication → Users (user should exist)
   - Check Firestore → `users` collection (might be missing)
   - If missing, registration failed partway through

2. **Re-register:**
   - Delete user from Firebase Auth
   - Try registering again

---

## Debug Steps

### Step 1: Check Backend Logs

Look at your backend terminal for:
```
Registration error: ...
Error details: { code: ..., message: ... }
```

### Step 2: Check Firebase Console

1. Go to: https://console.firebase.google.com/
2. Select your project
3. Check:
   - **Authentication** → Users (should see your user)
   - **Firestore Database** → `users` collection (should see document)

### Step 3: Test Registration Endpoint

Use Postman or curl:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123",
    "role": "lawyer"
  }'
```

Check the response for error details.

### Step 4: Test Login Endpoint

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

---

## Quick Fixes

### Fix 1: Restart Everything

1. Stop backend: `Ctrl + C`
2. Stop frontend: `Ctrl + C`
3. Clear browser cache and cookies
4. Restart backend: `npm run dev` (in backend folder)
5. Restart frontend: `npm run dev` (in root folder)
6. Try again

### Fix 2: Check Environment Variables

Verify `.env` file has:
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Fix 3: Verify Firebase Setup

1. Firebase Authentication enabled? ✅
2. Firestore Database created? ✅
3. Service account file exists? ✅
4. File path correct in `.env`? ✅

---

## Still Not Working?

**Check the backend terminal output** and share:
1. The exact error message
2. The error code (if any)
3. The stack trace (if any)

This will help identify the specific issue!

