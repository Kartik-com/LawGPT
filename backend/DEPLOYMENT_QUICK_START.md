# ⚡ Quick Start: Backend Deployment

## 🚂 Railway (Easiest - Recommended)

### 5-Minute Setup:

1. **Go to [railway.app](https://railway.app)** and sign up with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure:**
   - Root Directory: `backend`
   - Build Command: `npm install` (auto)
   - Start Command: `npm start`

4. **Add Environment Variables:**
   ```
   PORT=5000
   NODE_ENV=production
   CORS_ORIGIN=https://your-frontend.vercel.app
   
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
   
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

5. **Deploy:**
   - Railway auto-deploys
   - Get your URL from Settings → Domains
   - Example: `https://your-app.railway.app`

6. **Update Frontend:**
   - Add `VITE_API_URL=https://your-app.railway.app` to Vercel

**Done!** ✅

---

## 🎨 Render (Alternative)

### 5-Minute Setup:

1. **Go to [render.com](https://render.com)** and sign up

2. **Create Web Service:**
   - New + → Web Service
   - Connect GitHub repo
   - Root Directory: `backend`

3. **Configure:**
   - Build: `npm install`
   - Start: `npm start`

4. **Add Environment Variables** (same as Railway above)

5. **Deploy:**
   - Click "Create Web Service"
   - Get URL: `https://your-app.onrender.com`

**Done!** ✅

---

## 📝 Getting Firebase JSON

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Your Project → Settings → Service Accounts
3. Click "Generate new private key"
4. Download JSON file
5. Copy entire JSON content
6. Paste as `FIREBASE_SERVICE_ACCOUNT` variable

---

## ☁️ Getting Cloudinary Credentials

1. Go to [Cloudinary Console](https://cloudinary.com/console)
2. Copy:
   - Cloud Name
   - API Key
   - API Secret (click "Reveal")

---

## ✅ Test Your Deployment

```bash
curl https://your-backend-url.com/api/health
```

Should return: `{"ok":true,"service":"lawyer-zen-api"}`

---

## 🔗 Next Steps

1. Update frontend `VITE_API_URL` with your backend URL
2. Update backend `CORS_ORIGIN` with your frontend URL
3. Test full application

**See `BACKEND_DEPLOYMENT.md` for detailed instructions!**

