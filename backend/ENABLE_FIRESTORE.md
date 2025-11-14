# 🔥 Enable Firestore API - Quick Fix

## The Error

```
PERMISSION_DENIED: Cloud Firestore API has not been used in project lawgpt-7cb25 before or it is disabled.
```

## ✅ Solution: Enable Firestore API

### Option 1: Direct Link (Easiest)

**Click this link to enable Firestore:**
https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=lawgpt-7cb25

1. Click the link above
2. Click **"Enable"** button
3. Wait 1-2 minutes
4. Try registration again

---

### Option 2: Manual Steps

1. **Go to:** https://console.cloud.google.com/
2. **Select project:** `lawgpt-7cb25`
3. **Go to:** APIs & Services → Library
4. **Search for:** "Cloud Firestore API"
5. **Click:** "Cloud Firestore API"
6. **Click:** "Enable"
7. **Wait:** 1-2 minutes for it to activate

---

### Option 3: Firebase Console

1. **Go to:** https://console.firebase.google.com/
2. **Select project:** `lawgpt-7cb25`
3. **Click:** "Firestore Database" (left sidebar)
4. **Click:** "Create database" (if not created)
5. **Select:** "Start in test mode"
6. **Choose location:** Closest to you
7. **Click:** "Enable"

This will automatically enable the Firestore API.

---

## ✅ After Enabling

1. **Wait 1-2 minutes** for the API to activate
2. **Restart backend server:**
   - Press `Ctrl + C` in backend terminal
   - Run `npm run dev` again
3. **Try registration again**

---

## 🧪 Test

After enabling and restarting:

1. Go to: `http://localhost:8080/signup`
2. Fill in the form
3. Submit
4. Should work now! ✅

---

## ⚠️ Important

- **Enable Firestore Database** in Firebase Console (not just the API)
- **Wait 1-2 minutes** after enabling
- **Restart backend** after enabling

---

## 📋 Quick Checklist

- [ ] Firestore API enabled (click the link above)
- [ ] Firestore Database created in Firebase Console
- [ ] Waited 1-2 minutes
- [ ] Restarted backend server
- [ ] Tried registration again

---

## 🎯 Summary

**Problem:** Firestore API not enabled  
**Solution:** Enable it using the link above  
**Time:** 1-2 minutes to activate

**Click this link to enable:**
https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=lawgpt-7cb25

