# 🔥 Firebase Setup Checklist

## ✅ What You've Already Done:
- [x] Created Firebase account
- [x] Downloaded `firebase-service-account.json` file
- [x] Saved it to `backend/config/firebase-service-account.json`

---

## 📋 What You Need to Do Now:

### Step 1: Verify File Location ✅

Make sure your file is here:
```
backend/
└── config/
    └── firebase-service-account.json  ← Should be here
```

**Check:** Open `backend/config/` folder and verify the file exists.

---

### Step 2: Enable Authentication in Firebase Console

1. **Go to:** https://console.firebase.google.com/
2. **Select your project**
3. **Click:** "Authentication" (left sidebar)
4. **Click:** "Get started" (if first time)
5. **Click:** "Sign-in method" tab
6. **Click:** "Email/Password"
7. **Toggle ON:** "Enable" switch
8. **Click:** "Save"

✅ **Status:** Authentication enabled

---

### Step 3: Enable Firestore Database

1. **In Firebase Console**, click: "Firestore Database" (left sidebar)
2. **Click:** "Create database" (if not created)
3. **Select:** "Start in test mode" (for development)
4. **Choose location:** Select closest to you (e.g., `us-central1`, `asia-south1`)
5. **Click:** "Enable"

✅ **Status:** Firestore Database enabled

---

### Step 4: Verify .env File

Open `backend/.env` and make sure you have:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
```

✅ **Status:** Path is correct

---

## 🧪 Test Firebase Setup

Run these commands:

```bash
cd backend
npm install
npm run dev
```

**Expected Output:**
```
Firebase initialized successfully
API listening on port 5000
Using Firebase Firestore for database
Using Cloudinary for media storage
```

If you see this, Firebase is working! ✅

---

## ❌ Troubleshooting

### Error: "Firebase configuration not found"
- **Check:** `.env` file has `FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json`
- **Check:** File exists at `backend/config/firebase-service-account.json`
- **Fix:** Make sure path is correct (relative to `backend` folder)

### Error: "Permission denied"
- **Check:** Authentication is enabled in Firebase Console
- **Check:** Firestore Database is enabled in Firebase Console
- **Fix:** Enable both services in Firebase Console

### Error: "Invalid service account"
- **Check:** Service account JSON file is valid
- **Fix:** Re-download from Firebase Console → Settings → Service accounts

---

## ✅ Final Checklist

- [ ] `firebase-service-account.json` exists in `backend/config/`
- [ ] `.env` file has `FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json`
- [ ] Authentication enabled in Firebase Console (Email/Password)
- [ ] Firestore Database created in Firebase Console
- [ ] Ran `npm install`
- [ ] Ran `npm run dev` and saw "Firebase initialized successfully"

---

## 🎯 Quick Reference

**Firebase Console:** https://console.firebase.google.com/

**Enable Authentication:**
- Console → Authentication → Sign-in method → Email/Password → Enable

**Enable Firestore:**
- Console → Firestore Database → Create database → Test mode → Enable

**Service Account File:**
- Console → Settings → Project settings → Service accounts → Generate new private key

---

## 🚀 You're Done When:

1. ✅ Service account file is in place
2. ✅ Authentication is enabled
3. ✅ Firestore is enabled
4. ✅ Server starts without errors
5. ✅ You see "Firebase initialized successfully"

---

## 📞 Need Help?

If you see any errors:
1. Check the error message
2. Verify all checklist items
3. Make sure Firebase Console has both services enabled
4. Check that service account file is valid JSON





