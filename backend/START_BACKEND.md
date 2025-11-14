# 🚨 Backend Server Not Running - Quick Fix

## The Problem

The error `ECONNREFUSED` means:
- ❌ Backend server is **NOT running** on port 5000
- ✅ Frontend is running on port 8080
- ❌ Frontend can't connect to backend API

---

## ✅ Solution: Start Backend Server

### Step 1: Open New Terminal

Open a **NEW terminal window** (keep frontend running in the other terminal)

### Step 2: Navigate to Backend Folder

```bash
cd D:\IMS\Law\LawGPT\backend
```

### Step 3: Start Backend Server

```bash
npm run dev
```

### Step 4: Check for Success

You should see:
```
Firebase initialized successfully
API listening on port 5000
Using Firebase Firestore for database
Using Cloudinary for media storage
```

---

## ✅ You Need 2 Terminals Running

### Terminal 1: Frontend (port 8080)
```bash
cd D:\IMS\Law\LawGPT
npm run dev
```
✅ Keep this running

### Terminal 2: Backend (port 5000)
```bash
cd D:\IMS\Law\LawGPT\backend
npm run dev
```
✅ Start this now!

---

## 🧪 Test It

1. **Backend running?** 
   - Open: http://localhost:5000
   - Should see JSON with API info

2. **Frontend can connect?**
   - Open: http://localhost:8080
   - Errors should be gone

---

## ❌ If Backend Won't Start

### Error: "Firebase configuration required"
**Fix:** Check `.env` file has `FIREBASE_SERVICE_ACCOUNT_PATH`

### Error: "Cannot find module"
**Fix:** Run `npm install` in backend folder

### Error: Port 5000 already in use
**Fix:** 
- Close other apps using port 5000
- Or change `PORT=5001` in `.env`

---

## 📋 Quick Checklist

- [ ] Backend terminal open
- [ ] In `backend` folder
- [ ] Run `npm run dev`
- [ ] See "API listening on port 5000"
- [ ] Frontend errors gone

---

## 🎯 Summary

**Problem:** Backend server not running  
**Solution:** Start backend in separate terminal  
**Command:** `cd backend && npm run dev`

**You need BOTH servers running:**
- Frontend: `http://localhost:8080` ✅
- Backend: `http://localhost:5000` ❌ (start this!)

