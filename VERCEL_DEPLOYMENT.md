# 🚀 Vercel Deployment Guide

This guide will help you deploy the Lawyer Zen application to Vercel.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub/GitLab/Bitbucket Account**: Your code should be in a repository
3. **Backend Deployment**: Backend needs to be deployed separately (see Backend Deployment section)

## 🎯 Deployment Strategy

This application uses a **separate frontend and backend** architecture:

- **Frontend**: Deploy to Vercel (this guide)
- **Backend**: Deploy separately (Railway, Render, or Vercel Serverless Functions)

## 📦 Step 1: Prepare Your Repository

1. **Push your code to GitHub/GitLab/Bitbucket**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Ensure `.env` is in `.gitignore`** (sensitive data should not be committed)

## 🌐 Step 2: Deploy Frontend to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "Add New Project"**
3. **Import your Git repository**
4. **Configure the project:**
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (root of repository)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. **Add Environment Variables:**
   - Click "Environment Variables"
   - Add: `VITE_API_URL` = `https://your-backend-url.com`
   - (Get this URL after deploying backend)

6. **Click "Deploy"**

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   cd LawGPT
   vercel
   ```

4. **Set Environment Variables:**
   ```bash
   vercel env add VITE_API_URL
   # Enter your backend URL when prompted
   ```

5. **Redeploy with environment variables:**
   ```bash
   vercel --prod
   ```

## 🔧 Step 3: Configure Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `https://your-backend-url.com` | Your backend API URL |

**Important**: 
- For **Production**: Set to your production backend URL
- For **Preview**: Can use staging backend URL
- For **Development**: Leave empty (uses Vite proxy)

## 🔄 Step 4: Backend Deployment

**📚 For detailed backend deployment instructions, see:**
- **Quick Start**: `backend/DEPLOYMENT_QUICK_START.md` (5-minute setup)
- **Complete Guide**: `backend/BACKEND_DEPLOYMENT.md` (detailed instructions)

### Quick Summary:

Your backend needs to be deployed separately. Recommended platforms:

1. **Railway** ⭐ (Easiest - Recommended)
   - Go to [railway.app](https://railway.app)
   - Deploy from GitHub repo
   - Set root directory to `backend`
   - Add environment variables
   - Auto-deploys on push

2. **Render** (Alternative)
   - Go to [render.com](https://render.com)
   - Create Web Service
   - Set root directory to `backend`
   - Add environment variables

**See `backend/BACKEND_DEPLOYMENT.md` for complete step-by-step instructions!**

## 🔐 Step 5: Backend Environment Variables

Your backend needs these environment variables:

```env
PORT=5000
CORS_ORIGIN=https://your-frontend-url.vercel.app
NODE_ENV=production

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
# OR use FIREBASE_SERVICE_ACCOUNT as JSON string

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**Important**: 
- Update `CORS_ORIGIN` to your Vercel frontend URL
- Add Firebase service account JSON file to backend
- Add Cloudinary credentials

## ✅ Step 6: Verify Deployment

1. **Frontend**: Visit `https://your-project.vercel.app`
2. **Test Features**:
   - ✅ User registration/login
   - ✅ Create cases and clients
   - ✅ Upload documents
   - ✅ View dashboard
   - ✅ All features working

## 🔄 Step 7: Update CORS on Backend

After deploying frontend, update backend `CORS_ORIGIN`:

```env
CORS_ORIGIN=https://your-project.vercel.app
```

Then redeploy backend.

## 📝 Troubleshooting

### Frontend can't connect to backend

- **Check**: `VITE_API_URL` is set correctly in Vercel
- **Check**: Backend CORS allows your Vercel domain
- **Check**: Backend is running and accessible

### Build fails

- **Check**: All dependencies are in `package.json`
- **Check**: Node version is compatible (Vercel uses Node 18+)
- **Check**: Build command is correct: `npm run build`

### Environment variables not working

- **Check**: Variables are prefixed with `VITE_` for Vite
- **Check**: Variables are set in correct environment (Production/Preview)
- **Check**: Redeploy after adding variables

### Cookies not working

- **Check**: Backend sets cookies with correct domain
- **Check**: CORS credentials are enabled
- **Check**: SameSite cookie settings

## 🎉 Success!

Once deployed, your application will be live at:
- **Frontend**: `https://your-project.vercel.app`
- **Backend**: `https://your-backend-url.com`

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Environment Variables in Vercel](https://vercel.com/docs/concepts/projects/environment-variables)

