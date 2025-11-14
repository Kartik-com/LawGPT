# Step-by-Step Setup Instructions

## What You Need to Add

You need to add **Firebase** and **Cloudinary** credentials to your `.env` file in the `backend` folder.

---

## Step 1: Create `.env` File

**Location:** `LawGPT/backend/.env`

If you don't have a `.env` file, copy from `env.example`:
```bash
cd backend
cp env.example .env
```

---

## Step 2: Get Firebase Credentials

### 2.1 Create Firebase Project

1. Go to: https://console.firebase.google.com/
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `lawyer-zen` (or any name)
4. Click **Continue**
5. Disable Google Analytics (optional)
6. Click **Create project**

### 2.2 Enable Authentication

1. In Firebase Console, click **Authentication** (left sidebar)
2. Click **Get started**
3. Click **Sign-in method** tab
4. Click **Email/Password**
5. Enable **Email/Password** (toggle ON)
6. Click **Save**

### 2.3 Enable Firestore Database

1. In Firebase Console, click **Firestore Database** (left sidebar)
2. Click **Create database**
3. Select **Start in test mode** (for development)
4. Choose a location (closest to you)
5. Click **Enable**

### 2.4 Get Service Account Credentials

1. In Firebase Console, click **⚙️ Settings** (gear icon) → **Project settings**
2. Go to **Service accounts** tab
3. Click **Generate new private key**
4. Click **Generate key** in the popup
5. A JSON file will download (e.g., `lawyer-zen-firebase-adminsdk-xxxxx.json`)

### 2.5 Save Service Account File

**Location:** `LawGPT/backend/config/firebase-service-account.json`

1. Create `config` folder in `backend` directory:
   ```bash
   cd backend
   mkdir config
   ```
2. Move the downloaded JSON file to `backend/config/`
3. Rename it to: `firebase-service-account.json`

---

## Step 3: Get Cloudinary Credentials

### 3.1 Create Cloudinary Account

1. Go to: https://cloudinary.com/
2. Click **Sign Up** (free account available)
3. Fill in your details and sign up
4. Verify your email

### 3.2 Get API Credentials

1. After login, you'll see your **Dashboard**
2. Look for **Account Details** section
3. You'll see:
   - **Cloud name** (e.g., `dxyz123abc`)
   - **API Key** (e.g., `123456789012345`)
   - **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

**⚠️ Keep API Secret secure!**

---

## Step 4: Add to `.env` File

**Location:** `LawGPT/backend/.env`

Open the `.env` file and add these values:

```env
# ============================================
# EXISTING VALUES (keep these)
# ============================================
PORT=5000
CORS_ORIGIN=http://localhost:8080
NODE_ENV=development

# ============================================
# FIREBASE CONFIGURATION
# ============================================
# Path to your Firebase service account JSON file
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

# ============================================
# CLOUDINARY CONFIGURATION
# ============================================
# Get these from: https://cloudinary.com/console
CLOUDINARY_CLOUD_NAME=your-cloud-name-here
CLOUDINARY_API_KEY=your-api-key-here
CLOUDINARY_API_SECRET=your-api-secret-here
```

### Example `.env` File:

```env
PORT=5000
CORS_ORIGIN=http://localhost:8080
NODE_ENV=development

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

# Cloudinary
CLOUDINARY_CLOUD_NAME=dxyz123abc
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
```

---

## Step 5: File Structure

Your `backend` folder should look like this:

```
backend/
├── .env                          ← Your environment variables
├── config/
│   └── firebase-service-account.json  ← Firebase credentials
├── package.json
├── index.js
└── src/
    ├── config/
    │   ├── firebase.js
    │   └── cloudinary.js
    └── ...
```

---

## Step 6: Install Dependencies

Run this command in the `backend` folder:

```bash
cd backend
npm install
```

This will install:
- `firebase-admin` (Firebase SDK)
- `cloudinary` (Cloudinary SDK)

---

## Step 7: Test Setup

Start your server:

```bash
npm run dev
```

You should see:
```
Firebase initialized successfully
API listening on port 5000
Using Firebase Firestore for database
Using Cloudinary for media storage
```

If you see errors, check:
1. ✅ `.env` file exists and has correct values
2. ✅ `config/firebase-service-account.json` exists
3. ✅ Firebase project has Authentication enabled
4. ✅ Firebase project has Firestore enabled
5. ✅ Cloudinary credentials are correct

---

## Quick Checklist

- [ ] Firebase project created
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore Database enabled
- [ ] Service account JSON downloaded
- [ ] Service account file saved to `backend/config/firebase-service-account.json`
- [ ] Cloudinary account created
- [ ] Cloudinary credentials copied
- [ ] `.env` file created with all values
- [ ] Dependencies installed (`npm install`)
- [ ] Server starts without errors

---

## Troubleshooting

### Error: "Firebase configuration not found"
- Check `.env` file has `FIREBASE_SERVICE_ACCOUNT_PATH`
- Verify the path is correct (relative to `backend` folder)
- Make sure `config/firebase-service-account.json` exists

### Error: "Invalid API credentials" (Cloudinary)
- Double-check Cloudinary credentials in `.env`
- Make sure no extra spaces before/after values
- Verify credentials in Cloudinary dashboard

### Error: "Permission denied" (Firebase)
- Check service account has proper permissions
- Verify Authentication is enabled in Firebase Console
- Verify Firestore is enabled in Firebase Console

---

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env` file to Git
- Never commit `firebase-service-account.json` to Git
- Add to `.gitignore`:
  ```
  .env
  config/firebase-service-account.json
  ```

---

## Need Help?

- Firebase Docs: https://firebase.google.com/docs
- Cloudinary Docs: https://cloudinary.com/documentation
- See `CLOUD_SETUP.md` for detailed setup guide





