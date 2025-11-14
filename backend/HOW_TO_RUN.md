# 🚀 How to Run the Application

## Step-by-Step Instructions

### Step 1: Open Terminal/Command Prompt

**Windows:**
- Press `Win + R`
- Type `cmd` or `powershell`
- Press Enter

**Or:**
- Right-click in `backend` folder
- Select "Open in Terminal" or "Open PowerShell here"

---

### Step 2: Navigate to Backend Folder

```bash
cd D:\IMS\Law\LawGPT\backend
```

**Or if you're already in the LawGPT folder:**
```bash
cd backend
```

---

### Step 3: Install Dependencies (First Time Only)

```bash
npm install
```

This will install all required packages (Firebase, Cloudinary, etc.)

**Wait for it to finish** - you'll see:
```
added 234 packages in 2m
```

---

### Step 4: Start the Server

```bash
npm run dev
```

**Or:**
```bash
npm start
```

---

### Step 5: Check for Success ✅

You should see output like this:

```
Firebase initialized successfully
API listening on port 5000
Using Firebase Firestore for database
Using Cloudinary for media storage
```

**If you see this, everything is working!** 🎉

---

## 📍 Server Information

- **URL:** http://localhost:5000
- **Health Check:** http://localhost:5000/api/health
- **Port:** 5000

---

## 🧪 Test the Server

### Option 1: Browser Test

Open your browser and go to:
```
http://localhost:5000/api/health
```

You should see:
```json
{"ok":true,"service":"lawyer-zen-api"}
```

### Option 2: Terminal Test

Open a new terminal and run:
```bash
curl http://localhost:5000/api/health
```

---

## ⚠️ Common Issues

### Error: "Firebase configuration not found"
**Fix:**
- Check `.env` file exists
- Verify `FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json`
- Make sure `config/firebase-service-account.json` exists

### Error: "Invalid Cloudinary credentials"
**Fix:**
- Check `.env` file has all 3 Cloudinary values
- Make sure no "PASTE_YOUR_..." text remains
- Verify credentials in Cloudinary dashboard

### Error: "Port 5000 already in use"
**Fix:**
- Close other applications using port 5000
- Or change `PORT=5001` in `.env` file

### Error: "Cannot find module"
**Fix:**
- Run `npm install` again
- Delete `node_modules` folder and run `npm install`

---

## 🛑 Stop the Server

Press: `Ctrl + C` in the terminal

---

## 📋 Quick Command Reference

```bash
# Navigate to backend folder
cd backend

# Install dependencies (first time)
npm install

# Start development server
npm run dev

# Start production server
npm start

# Stop server
Ctrl + C
```

---

## ✅ Pre-Run Checklist

Before running, make sure:

- [ ] `.env` file exists in `backend/` folder
- [ ] `.env` has all Cloudinary credentials (no placeholders)
- [ ] `config/firebase-service-account.json` exists
- [ ] Firebase Authentication is enabled
- [ ] Firebase Firestore is enabled
- [ ] `npm install` has been run

---

## 🎯 What Happens When You Run

1. ✅ Server reads `.env` file
2. ✅ Initializes Firebase connection
3. ✅ Connects to Firestore database
4. ✅ Sets up Cloudinary configuration
5. ✅ Starts listening on port 5000
6. ✅ Ready to accept API requests

---

## 🚀 Next Steps After Server Starts

1. **Test API:** Visit http://localhost:5000/api/health
2. **Connect Frontend:** Point your frontend to `http://localhost:5000`
3. **Test Authentication:** Try registering a user
4. **Test File Upload:** Try uploading a document

---

## 💡 Tips

- Keep the terminal window open while server is running
- Server auto-restarts on file changes (with `npm run dev`)
- Check terminal for error messages if something doesn't work
- Server logs all requests in the terminal

---

## 📞 Need Help?

If you see errors:
1. Read the error message carefully
2. Check the troubleshooting section above
3. Verify all setup steps are complete
4. Check `.env` file has correct values





