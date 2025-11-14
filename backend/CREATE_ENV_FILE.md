# 📝 Create Your .env File

## Quick Steps:

### Option 1: Copy Template (Easiest)

1. **Copy the file:** `backend/.env.template`
2. **Rename it to:** `backend/.env`
3. **Open** `backend/.env`
4. **Replace** the placeholder text with your actual credentials

---

### Option 2: Create Manually

1. **Create a new file** named `.env` in the `backend` folder
2. **Copy and paste** the content below
3. **Replace** the placeholder values with your actual credentials

---

## 📋 Content to Paste in `.env` File:

```env
PORT=5000
CORS_ORIGIN=http://localhost:8080
NODE_ENV=development

FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

CLOUDINARY_CLOUD_NAME=PASTE_YOUR_CLOUD_NAME_HERE
CLOUDINARY_API_KEY=PASTE_YOUR_API_KEY_HERE
CLOUDINARY_API_SECRET=PASTE_YOUR_API_SECRET_HERE
```

---

## ✏️ What to Replace:

### 1. Cloudinary Cloud Name
```env
# Replace this:
CLOUDINARY_CLOUD_NAME=PASTE_YOUR_CLOUD_NAME_HERE

# With your actual value (example):
CLOUDINARY_CLOUD_NAME=dxyz123abc
```

### 2. Cloudinary API Key
```env
# Replace this:
CLOUDINARY_API_KEY=PASTE_YOUR_API_KEY_HERE

# With your actual value (example):
CLOUDINARY_API_KEY=123456789012345
```

### 3. Cloudinary API Secret
```env
# Replace this:
CLOUDINARY_API_SECRET=PASTE_YOUR_API_SECRET_HERE

# With your actual value (example):
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
```

---

## 📍 Where to Get Cloudinary Values:

1. Go to: **https://cloudinary.com/console**
2. Login to your account
3. Look at your **Dashboard**
4. Find **Account Details** section
5. You'll see:
   - **Cloud name** → Copy this
   - **API Key** → Copy this
   - **API Secret** → Click "Reveal" and copy this

---

## ✅ Final Check:

Your `.env` file should:
- ✅ Be located at: `backend/.env`
- ✅ Have all 3 Cloudinary values filled in (no "PASTE_YOUR_..." text)
- ✅ Have Firebase path pointing to your service account file
- ✅ Look like this (with YOUR actual values):

```env
PORT=5000
CORS_ORIGIN=http://localhost:8080
NODE_ENV=development

FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

CLOUDINARY_CLOUD_NAME=dxyz123abc
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
```

---

## 🚀 After Creating .env:

1. Save the `.env` file
2. Run: `npm install` (if not done already)
3. Run: `npm run dev`
4. You should see: "Firebase initialized successfully"

---

## ⚠️ Important:

- **Never commit** `.env` file to Git
- **Never share** your `.env` file
- Keep your credentials secure!





