# Deployment Guide - Render.com + Vercel + GitHub

Complete guide to deploy the Imposter Artist multiplayer game.

## Architecture

- **Frontend (Vercel)**: React app on `https://your-app.vercel.app`
- **Backend (Render.com)**: Socket.IO server on `https://your-backend.onrender.com`
- **GitHub**: Source code repository

---

## Step 1: Push to GitHub

### 1.1 Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `imposter-artist-game`)
3. Don't initialize with README (your code already has one)

### 1.2 Push Code

```bash
# In your project directory
git init
git add .
git commit -m "Initial commit: Multiplayer Imposter Artist game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/imposter-artist-game.git
git push -u origin main
```

---

## Step 2: Deploy Backend to Render.com

### 2.1 Create Render Account

1. Go to https://render.com
2. Sign up with GitHub (easier)

### 2.2 Create New Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `imposter-artist-backend`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for better performance)

### 2.3 Environment Variables

Add in Render dashboard → Environment:
- `PORT` = `3001` (optional, Render sets this automatically)

### 2.4 Get Backend URL

After deployment, your backend will be at:
```
https://imposter-artist-backend.onrender.com
```

**Save this URL!** You'll need it for the frontend.

---

## Step 3: Update Frontend for Production

### 3.1 Update Socket Service

Edit `services/socketService.ts`:

```typescript
// Change this line:
const SOCKET_URL = 'http://localhost:3001';

// To:
const SOCKET_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3001';
```

### 3.2 Create Environment File

Create `.env.production`:

```bash
VITE_BACKEND_URL=https://imposter-artist-backend.onrender.com
```

### 3.3 Commit Changes

```bash
git add .
git commit -m "Configure production backend URL"
git push
```

---

## Step 4: Deploy Frontend to Vercel

### 4.1 Create Vercel Account

1. Go to https://vercel.com
2. Sign up with GitHub

### 4.2 Import Project

1. Click "Add New..." → "Project"
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave as is)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)

### 4.3 Environment Variables

Add in Vercel → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_BACKEND_URL` | `https://imposter-artist-backend.onrender.com` |

(Replace with your actual Render backend URL)

### 4.4 Deploy

Click "Deploy" - Vercel will:
1. Build your app
2. Deploy to CDN
3. Give you a URL like: `https://imposter-artist.vercel.app`

---

## Step 5: Update Backend CORS

After frontend deployment, update backend CORS settings.

Edit `server/server.js`:

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://imposter-artist.vercel.app", // Add your Vercel URL
      "https://your-custom-domain.com"      // If you have one
    ],
    methods: ["GET", "POST"]
  }
});
```

Commit and push:
```bash
git add server/server.js
git commit -m "Update CORS for production"
git push
```

Render will auto-redeploy your backend.

---

## Step 6: Test Production Deployment

1. Open your Vercel URL: `https://imposter-artist.vercel.app`
2. Create a room
3. Open in another device/browser
4. Join with room code
5. Test full gameplay

---

## Troubleshooting

### Backend Not Connecting

1. Check Render logs: Dashboard → Logs
2. Verify backend URL in Vercel environment variables
3. Check CORS settings in `server/server.js`

### Render Free Tier Spins Down

Render free tier sleeps after 15 min inactivity:
- First connection takes ~30 seconds
- Consider upgrading for production use
- Or use a cron job to ping every 10 minutes

### WebSocket Connection Fails

1. Ensure HTTPS on frontend (Vercel does this automatically)
2. Backend must support WSS (Render does this automatically)
3. Check browser console for errors

---

## Custom Domain (Optional)

### For Vercel (Frontend)

1. Go to Vercel → Project → Settings → Domains
2. Add your domain (e.g., `imposterartist.com`)
3. Follow DNS configuration instructions

### For Render (Backend)

1. Render → Web Service → Settings → Custom Domain
2. Add domain (e.g., `api.imposterartist.com`)
3. Update frontend `VITE_BACKEND_URL`

---

## Continuous Deployment

Both Render and Vercel auto-deploy when you push to GitHub:

```bash
# Make changes
git add .
git commit -m "New feature"
git push

# Render redeploys backend automatically
# Vercel redeploys frontend automatically
```

---

## Production Checklist

- [ ] Backend deployed to Render
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set correctly
- [ ] CORS configured with production URLs
- [ ] Tested on multiple devices
- [ ] Custom domain configured (optional)
- [ ] Error monitoring set up (optional)

---

## Monitoring & Analytics (Optional)

### Add Error Tracking

**Sentry** (recommended):
```bash
npm install @sentry/react @sentry/vite-plugin
```

### Add Analytics

**Vercel Analytics** (built-in):
```bash
npm install @vercel/analytics
```

---

## Cost Estimate

- **GitHub**: Free (public repo)
- **Render.com**: $0/month (Free tier) or $7/month (Starter)
- **Vercel**: Free (Hobby plan)

**Total**: $0-7/month for full deployment!

---

## Need Help?

- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- Socket.IO Deployment: https://socket.io/docs/v4/
