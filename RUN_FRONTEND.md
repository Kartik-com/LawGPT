# 🚀 How to Run the Frontend Application

## The Issue

You're seeing the API JSON response because you're accessing the **backend API** directly. You need to run the **frontend application** separately.

---

## Solution: Run Both Backend AND Frontend

You need **2 terminals** running:

1. **Terminal 1:** Backend API (port 5000) ✅ Already running
2. **Terminal 2:** Frontend App (port 8080) ❌ Need to start

---

## Step-by-Step Instructions

### Step 1: Keep Backend Running

**Terminal 1** (already running):
```bash
cd backend
npm run dev
```
✅ Keep this running!

---

### Step 2: Start Frontend (New Terminal)

**Terminal 2** (open a NEW terminal):

1. **Navigate to root folder:**
   ```bash
   cd D:\IMS\Law\LawGPT
   ```

2. **Install dependencies (first time only):**
   ```bash
   npm install
   ```

3. **Start frontend:**
   ```bash
   npm run dev
   ```

---

### Step 3: Access the Application

**Open your browser and go to:**
```
http://localhost:8080
```

**NOT** `http://localhost:5000` (that's the API)

---

## Expected Output

### Terminal 1 (Backend):
```
Firebase initialized successfully
API listening on port 5000
Using Firebase Firestore for database
Using Cloudinary for media storage
```

### Terminal 2 (Frontend):
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
```

---

## Quick Command Summary

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd D:\IMS\Law\LawGPT
npm install  # First time only
npm run dev
```

**Browser:**
```
http://localhost:8080
```

---

## File Structure

```
LawGPT/
├── backend/          ← Backend API (port 5000)
│   └── npm run dev
│
└── (root)/           ← Frontend App (port 8080)
    └── npm run dev
```

---

## Troubleshooting

### Frontend won't start
- **Check:** Are you in the root `LawGPT` folder? (not `backend`)
- **Fix:** Run `cd D:\IMS\Law\LawGPT` first

### "Cannot find module"
- **Fix:** Run `npm install` in the root folder

### Frontend can't connect to backend
- **Check:** Backend is running on port 5000
- **Check:** Vite config has proxy setup
- **Fix:** Make sure both are running

### Port 8080 already in use
- **Fix:** Close other apps using port 8080
- **Or:** Change port in `vite.config.ts`

---

## ✅ Checklist

- [ ] Backend running on port 5000 ✅ (already done)
- [ ] Frontend dependencies installed (`npm install` in root)
- [ ] Frontend running on port 8080 (`npm run dev` in root)
- [ ] Browser opened to `http://localhost:8080`
- [ ] Application loads correctly

---

## 🎯 What You Should See

When you open `http://localhost:8080`, you should see:
- ✅ Login/Signup page (or Dashboard if logged in)
- ✅ Full application UI
- ✅ NOT the JSON API response

---

## 📝 Summary

1. **Backend** = `http://localhost:5000` (API - already running) ✅
2. **Frontend** = `http://localhost:8080` (App - need to start) ❌
3. **Access** = `http://localhost:8080` (not port 5000)

Open a **new terminal**, go to root folder, run `npm run dev`, then open `http://localhost:8080`!





