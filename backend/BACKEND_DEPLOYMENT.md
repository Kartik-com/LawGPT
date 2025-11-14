# 🚀 Backend Deployment Guide

Complete guide for deploying the Lawyer Zen backend API to production.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Platform Options](#platform-options)
3. [Railway Deployment](#railway-deployment-recommended)
4. [Render Deployment](#render-deployment)
5. [Vercel Serverless Functions](#vercel-serverless-functions)
6. [Environment Variables](#environment-variables)
7. [Firebase Setup](#firebase-setup)
8. [Cloudinary Setup](#cloudinary-setup)
9. [Post-Deployment](#post-deployment)
10. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

Before deploying, ensure you have:

- [ ] **GitHub/GitLab/Bitbucket account** with your code repository
- [ ] **Firebase project** set up with Firestore enabled
- [ ] **Cloudinary account** with API credentials
- [ ] **Backend code** pushed to your repository

---

## 🎯 Platform Options

### Recommended Platforms:

1. **Railway** ⭐ (Recommended)
   - Easy setup
   - Automatic deployments
   - Free tier available
   - Great for Node.js apps

2. **Render**
   - Free tier available
   - Easy Git integration
   - Auto-deploy on push

3. **Vercel Serverless Functions**
   - Good for serverless architecture
   - Requires code restructuring

4. **Heroku**
   - Paid plans only
   - Reliable and stable

---

## 🚂 Railway Deployment (Recommended)

### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended)
3. Verify your email

### Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository
4. Railway will detect it's a Node.js project

### Step 3: Configure Project

1. **Set Root Directory:**
   - In project settings, set root directory to: `backend`
   - Or deploy from `backend` folder

2. **Configure Build Settings:**
   - Build Command: `npm install` (automatic)
   - Start Command: `npm start`
   - Node Version: `20.x` (or latest LTS)

### Step 4: Add Environment Variables

Go to **Variables** tab and add:

```env
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-url.vercel.app

# Firebase - Option 1: Service Account JSON (Recommended)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}

# OR Firebase - Option 2: Individual Credentials
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Important**: 
- For Firebase, use the **JSON string** option (Option 1) on Railway
- Copy the entire JSON from your `firebase-service-account.json` file
- Make sure to escape quotes properly

### Step 5: Deploy

1. Railway will automatically deploy
2. Wait for build to complete
3. Get your backend URL from the **Settings** → **Domains** section
4. Example: `https://your-app.railway.app`

### Step 6: Configure Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain (e.g., `api.yourdomain.com`)
3. Follow DNS configuration instructions

---

## 🎨 Render Deployment

### Step 1: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Verify your email

### Step 2: Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select your repository

### Step 3: Configure Service

**Basic Settings:**
- **Name**: `lawyer-zen-api` (or your choice)
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Advanced Settings:**
- **Node Version**: `20.x`
- **Auto-Deploy**: `Yes` (deploys on every push)

### Step 4: Add Environment Variables

Go to **Environment** tab:

```env
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-url.vercel.app

# Firebase - Use JSON string
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will build and deploy
3. Get your URL from the dashboard
4. Example: `https://lawyer-zen-api.onrender.com`

**Note**: Free tier services spin down after 15 minutes of inactivity. First request may be slow.

---

## ⚡ Vercel Serverless Functions

Vercel requires restructuring your Express app. This is more complex.

### Step 1: Create `api/index.js`

Create `backend/api/index.js`:

```javascript
import app from '../index.js';

export default app;
```

### Step 2: Create `vercel.json`

Create `backend/vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.js"
    }
  ]
}
```

### Step 3: Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `cd backend && vercel`
4. Add environment variables in Vercel dashboard

**Note**: Vercel serverless has execution time limits. For long-running processes, use Railway or Render.

---

## 🔐 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `production` |
| `CORS_ORIGIN` | Frontend URL | `https://your-app.vercel.app` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase JSON (string) | `{"type":"service_account",...}` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | `dxyz123abc` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `abc123...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT secret (if using JWT) | Auto-generated |

---

## 🔥 Firebase Setup

### Option 1: Service Account JSON (Recommended for Railway/Render)

1. **Get Service Account JSON:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project
   - Go to **Settings** → **Service Accounts**
   - Click **"Generate new private key"**
   - Download the JSON file

2. **Convert to Environment Variable:**
   - Open the JSON file
   - Copy the entire content
   - In Railway/Render, paste as `FIREBASE_SERVICE_ACCOUNT`
   - Make sure it's a valid JSON string (escape quotes if needed)

**Example:**
```json
{"type":"service_account","project_id":"lawgpt-7cb25","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@lawgpt-7cb25.iam.gserviceaccount.com",...}
```

### Option 2: Individual Credentials

If your platform doesn't support JSON strings:

```env
FIREBASE_PROJECT_ID=lawgpt-7cb25
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@lawgpt-7cb25.iam.gserviceaccount.com
```

**Important**: 
- Private key must include `\n` for newlines
- Keep the quotes around the private key

---

## ☁️ Cloudinary Setup

1. **Get Credentials:**
   - Go to [Cloudinary Console](https://cloudinary.com/console)
   - Copy your **Cloud Name**
   - Copy your **API Key**
   - Click **"Reveal"** and copy your **API Secret**

2. **Add to Environment Variables:**
   ```env
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

3. **Verify:**
   - Cloud name should be 3-27 characters, alphanumeric and hyphens only
   - API key should be numeric
   - API secret should be alphanumeric, 20+ characters

---

## ✅ Post-Deployment

### 1. Test Your Backend

```bash
# Health check
curl https://your-backend-url.com/api/health

# Should return: {"ok":true,"service":"lawyer-zen-api"}
```

### 2. Update Frontend

1. Go to your Vercel frontend project
2. Add/Update environment variable:
   ```
   VITE_API_URL=https://your-backend-url.com
   ```
3. Redeploy frontend

### 3. Update CORS

Make sure `CORS_ORIGIN` in backend matches your frontend URL:

```env
CORS_ORIGIN=https://your-frontend.vercel.app
```

### 4. Test Full Flow

1. Register a new user
2. Create a case
3. Upload a document
4. Verify file is stored in Cloudinary
5. Check Firestore for data

---

## 🔧 Troubleshooting

### Build Fails

**Issue**: `Cannot find module 'firebase-admin'`
- **Fix**: Make sure `package.json` includes all dependencies
- **Fix**: Check that `npm install` runs successfully

**Issue**: `Firebase initialization failed`
- **Fix**: Check `FIREBASE_SERVICE_ACCOUNT` JSON is valid
- **Fix**: Verify JSON string is properly escaped
- **Fix**: Try using individual credentials instead

### Runtime Errors

**Issue**: `Cloudinary configuration error`
- **Fix**: Verify all three Cloudinary variables are set
- **Fix**: Check credentials are correct (no extra spaces)
- **Fix**: Verify cloud name format is correct

**Issue**: `CORS error` in browser
- **Fix**: Check `CORS_ORIGIN` matches frontend URL exactly
- **Fix**: Include protocol (`https://`) in CORS_ORIGIN
- **Fix**: No trailing slash in CORS_ORIGIN

**Issue**: `401 Unauthorized` on all requests
- **Fix**: Check Firebase credentials are correct
- **Fix**: Verify Firestore is enabled in Firebase Console
- **Fix**: Check service account has proper permissions

### File Upload Issues

**Issue**: Files not uploading to Cloudinary
- **Fix**: Verify Cloudinary credentials
- **Fix**: Check file size limits (100MB default)
- **Fix**: Verify Cloudinary account is active

**Issue**: Files not showing in app
- **Fix**: Check `folderId` is being saved correctly
- **Fix**: Verify Firestore documents are created
- **Fix**: Check Cloudinary URL is returned correctly

### Database Issues

**Issue**: Data not saving to Firestore
- **Fix**: Verify Firestore is enabled in Firebase Console
- **Fix**: Check service account has Firestore permissions
- **Fix**: Verify Firebase project ID is correct

---

## 📊 Monitoring

### Railway

- View logs: **Deployments** → Click deployment → **View Logs**
- Monitor: **Metrics** tab shows CPU, Memory, Network

### Render

- View logs: **Logs** tab in dashboard
- Monitor: **Metrics** tab shows resource usage

### Health Check Endpoint

Your backend has a health check endpoint:

```
GET /api/health
```

Returns: `{"ok":true,"service":"lawyer-zen-api"}`

Use this for monitoring and uptime checks.

---

## 🔄 Updating Your Backend

### Automatic Updates (Recommended)

Both Railway and Render support automatic deployments:

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Update backend"
   git push origin main
   ```

2. **Platform auto-deploys:**
   - Railway: Deploys automatically
   - Render: Deploys automatically (if enabled)

### Manual Updates

1. Go to platform dashboard
2. Click **"Manual Deploy"** or **"Redeploy"**
3. Wait for deployment to complete

---

## 💰 Cost Estimates

### Railway
- **Free Tier**: $5 credit/month
- **Hobby Plan**: $5/month (after free credit)
- **Pro Plan**: $20/month

### Render
- **Free Tier**: Available (with limitations)
- **Starter Plan**: $7/month
- **Standard Plan**: $25/month

### Vercel
- **Hobby Plan**: Free (with limitations)
- **Pro Plan**: $20/month

---

## 🎯 Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **Secrets Management**: Use platform's secret management
3. **Monitoring**: Set up health checks
4. **Logging**: Review logs regularly
5. **Backups**: Firestore has automatic backups
6. **Security**: Keep dependencies updated
7. **CORS**: Only allow your frontend domain

---

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Cloudinary Documentation](https://cloudinary.com/documentation)

---

## ✅ Deployment Checklist

- [ ] Backend code pushed to GitHub
- [ ] Firebase project created
- [ ] Firestore enabled
- [ ] Service account JSON downloaded
- [ ] Cloudinary account created
- [ ] Cloudinary credentials obtained
- [ ] Platform account created (Railway/Render)
- [ ] Project created on platform
- [ ] Environment variables added
- [ ] Backend deployed successfully
- [ ] Health check endpoint working
- [ ] CORS configured correctly
- [ ] Frontend updated with backend URL
- [ ] Full application tested

---

## 🆘 Need Help?

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review platform logs
3. Verify all environment variables are set
4. Test endpoints with `curl` or Postman
5. Check Firebase and Cloudinary dashboards

---

**🎉 Congratulations!** Your backend is now deployed and ready to serve your frontend application!

