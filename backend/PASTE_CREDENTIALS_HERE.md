# 📋 Paste Your Credentials Here

## Step 1: Get Your Cloudinary Credentials

1. Go to: https://cloudinary.com/console
2. Login to your account
3. You'll see your **Dashboard**
4. Look for **Account Details** section
5. You'll see 3 values:

---

## Step 2: Copy and Paste to `.env` File

Open: `backend/.env`

Find these lines and replace with your actual values:

```env
# Replace this line:
CLOUDINARY_CLOUD_NAME=PASTE_YOUR_CLOUD_NAME_HERE

# With your actual Cloud Name (example):
CLOUDINARY_CLOUD_NAME=dxyz123abc
```

```env
# Replace this line:
CLOUDINARY_API_KEY=PASTE_YOUR_API_KEY_HERE

# With your actual API Key (example):
CLOUDINARY_API_KEY=123456789012345
```

```env
# Replace this line:
CLOUDINARY_API_SECRET=PASTE_YOUR_API_SECRET_HERE

# With your actual API Secret (example):
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
```

---

## Step 3: Verify Firebase File

Make sure this file exists:
- `backend/config/firebase-service-account.json`

The path in `.env` should be:
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
```

---

## Step 4: Example of Final `.env` File

After pasting, your `.env` should look like this:

```env
PORT=5000
CORS_ORIGIN=http://localhost:8080
NODE_ENV=development

FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

CLOUDINARY_CLOUD_NAME=dxyz123abc
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
```

**⚠️ Important:** Replace the example values above with YOUR actual values!

---

## ✅ Checklist

- [ ] Opened `backend/.env` file
- [ ] Replaced `PASTE_YOUR_CLOUD_NAME_HERE` with actual Cloud Name
- [ ] Replaced `PASTE_YOUR_API_KEY_HERE` with actual API Key
- [ ] Replaced `PASTE_YOUR_API_SECRET_HERE` with actual API Secret
- [ ] Verified `firebase-service-account.json` exists in `backend/config/`
- [ ] Saved the `.env` file
- [ ] Ready to run `npm install` and `npm run dev`

---

## 🎯 Quick Copy-Paste Template

Copy this and fill in your values:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Then paste your values after each `=` sign (no spaces).





