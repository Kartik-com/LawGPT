# 🚨 Quick Fix for 401/500 Errors

## Immediate Steps

### 1. Restart Backend Server

**Stop the server:**
- Press `Ctrl + C` in backend terminal

**Start again:**
```bash
cd backend
npm run dev
```

### 2. Clear Browser Data

1. Open browser DevTools (F12)
2. Go to **Application** tab
3. Click **Clear storage**
4. Check all boxes
5. Click **Clear site data**
6. Refresh page

### 3. Try Registration Again

1. Go to: `http://localhost:8080/signup`
2. Fill in the form
3. Submit

**Watch the backend terminal** for any error messages.

---

## What to Check in Backend Terminal

After restarting, you should see:
```
Firebase initialized successfully
API listening on port 5000
```

When you try to register, look for:
- `Registration error:` - This will show the actual problem
- `Error details:` - This shows the error code and message

**Share these error messages** if registration still fails!

---

## Common Issues

### Issue 1: "Firebase configuration not found"
**Fix:** Check `.env` file has `FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json`

### Issue 2: "Permission denied"
**Fix:** 
- Go to Firebase Console
- Enable Authentication (Email/Password)
- Enable Firestore Database

### Issue 3: "User profile not found" after login
**Fix:** The user was created in Firebase Auth but not Firestore. Try registering again.

---

## Test Registration with curl

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@test.com",
    "password": "test123",
    "role": "lawyer"
  }'
```

Check the response - it will show the exact error!

---

## Still Not Working?

**Please share:**
1. The exact error message from backend terminal
2. The error code (if shown)
3. Screenshot of the error (if possible)

This will help me fix it quickly!

