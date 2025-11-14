# 🔧 Fix Cloudinary Configuration Issue

## ❌ Current Problem

Your Cloudinary cloud name is invalid: `mediaflows_ec117893-8c9a-4fe0-88ba-b2c0869ce089`

This appears to be from a different service (MediaFlows) rather than Cloudinary.

## ✅ Solution: Get Correct Cloudinary Credentials

### Step 1: Sign Up for Cloudinary (if you don't have an account)

1. Go to: **https://cloudinary.com/users/register/free**
2. Sign up for a **free account** (no credit card required)
3. Verify your email

### Step 2: Get Your Cloudinary Credentials

1. After login, go to: **https://cloudinary.com/console**
2. You'll see your **Dashboard**
3. Look for the **Account Details** section
4. You'll see three values:
   - **Cloud name** (e.g., `dxyz123abc`) - This is what you need!
   - **API Key** (e.g., `123456789012345`)
   - **API Secret** (click "Reveal" to see it)

### Step 3: Update Your `.env` File

**Location:** `LawGPT/backend/.env`

Open the file and find these lines:

```env
CLOUDINARY_CLOUD_NAME=mediaflows_ec117893-8c9a-4fe0-88ba-b2c0869ce089
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Replace them with your actual Cloudinary values:**

```env
CLOUDINARY_CLOUD_NAME=your-actual-cloud-name-here
CLOUDINARY_API_KEY=your-actual-api-key-here
CLOUDINARY_API_SECRET=your-actual-api-secret-here
```

### Step 4: Example of Correct Format

Your `.env` file should look like this (with YOUR actual values):

```env
PORT=5000
CORS_ORIGIN=http://localhost:8080
NODE_ENV=development

FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

CLOUDINARY_CLOUD_NAME=dxyz123abc
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
```

**⚠️ Important:**
- Cloud name should be **3-27 characters**, **alphanumeric and hyphens only** (no underscores, no UUIDs)
- API Key should be **numeric** (10-15 digits)
- API Secret should be **alphanumeric** (20-40 characters)

### Step 5: Restart Your Server

After updating the `.env` file:

1. **Stop** your backend server (Ctrl+C)
2. **Restart** it:
   ```bash
   cd LawGPT/backend
   npm start
   ```

### Step 6: Test File Upload

1. Go to the Documents page in your app
2. Try uploading a file
3. It should now work! ✅

## 🆘 Still Having Issues?

If you're still getting errors:

1. **Double-check** your credentials are correct (no extra spaces, no quotes)
2. **Verify** you're using Cloudinary credentials, not from another service
3. **Check** the server logs for specific error messages
4. **Make sure** you saved the `.env` file after editing

## 📝 Quick Checklist

- [ ] Signed up for Cloudinary account
- [ ] Got Cloud name from Cloudinary dashboard
- [ ] Got API Key from Cloudinary dashboard
- [ ] Got API Secret from Cloudinary dashboard (clicked "Reveal")
- [ ] Updated `CLOUDINARY_CLOUD_NAME` in `.env` file
- [ ] Updated `CLOUDINARY_API_KEY` in `.env` file
- [ ] Updated `CLOUDINARY_API_SECRET` in `.env` file
- [ ] Saved the `.env` file
- [ ] Restarted the backend server
- [ ] Tested file upload

---

**Need help?** Visit: https://cloudinary.com/console

