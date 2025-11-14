# ✅ Pre-Deployment Checklist

## 🔍 Feature Verification

Before deploying to Vercel, verify all features are working:

### Authentication
- [ ] User registration
- [ ] User login
- [ ] User logout
- [ ] Session persistence
- [ ] Protected routes

### Case Management
- [ ] Create case
- [ ] Update case
- [ ] Delete case
- [ ] View case details
- [ ] Case search/filter

### Client Management
- [ ] Create client
- [ ] Update client
- [ ] Delete client
- [ ] View client list

### Document Management
- [ ] Create folder
- [ ] Upload files to folder
- [ ] View files
- [ ] Download files
- [ ] Delete files
- [ ] Files stored in Cloudinary

### Hearing Management
- [ ] Create hearing
- [ ] Update hearing
- [ ] Delete hearing
- [ ] View hearings by case

### Invoice Management
- [ ] Create invoice
- [ ] Update invoice
- [ ] Delete invoice
- [ ] Send invoice

### Time Tracking
- [ ] Add time entry
- [ ] View time entries

### Alerts
- [ ] Create alert
- [ ] Mark alert as read
- [ ] Delete alert

### Dashboard
- [ ] View statistics
- [ ] View recent activity
- [ ] View notifications

## 🔧 Configuration Check

### Frontend
- [ ] `VITE_API_URL` environment variable configured
- [ ] All API calls use `getApiUrl()` utility
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`

### Backend
- [ ] Firebase credentials configured
- [ ] Cloudinary credentials configured
- [ ] CORS origin set to frontend URL
- [ ] Environment variables set

## 📦 Deployment Steps

1. **Push code to Git repository**
2. **Deploy backend first** (Railway/Render)
3. **Get backend URL**
4. **Set `VITE_API_URL` in Vercel**
5. **Deploy frontend to Vercel**
6. **Update backend CORS with Vercel URL**
7. **Test all features**

## 🐛 Common Issues

- **CORS errors**: Check backend CORS_ORIGIN
- **API not found**: Check VITE_API_URL
- **Cookies not working**: Check cookie domain settings
- **File upload fails**: Check Cloudinary credentials

