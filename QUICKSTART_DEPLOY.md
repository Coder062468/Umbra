# Quick Deployment Guide - 3 Simple Steps

## Step 1: Deploy Backend to Railway (5 minutes)

1. **Push to GitHub:**
   ```bash
   cd C:\expense_tracker
   git init
   git add .
   git commit -m "Initial commit - E2E expense tracker"

   # Create repo on GitHub, then:
   git remote add origin https://github.com/YOUR_USERNAME/expense-tracker.git
   git push -u origin main
   ```

2. **Deploy to Railway:**
   - Go to https://railway.app and sign in with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `expense-tracker` repository
   - Railway auto-detects FastAPI

3. **Add PostgreSQL Database:**
   - In your Railway project, click "New Service" → "Database" → "PostgreSQL"
   - Railway auto-injects `DATABASE_URL` into your backend

4. **Configure Environment Variables:**
   - Go to your backend service → **Variables** tab
   - Add these variables:
     ```
     SECRET_KEY=<RUN_COMMAND_BELOW_TO_GENERATE>
     ALGORITHM=HS256
     ACCESS_TOKEN_EXPIRE_MINUTES=1440
     DEBUG=False
     ALLOWED_ORIGINS=https://your-app.vercel.app
     RATE_LIMIT_PER_MINUTE=60
     ```

5. **Generate SECRET_KEY** (run locally):
   ```bash
   cd backend
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   Copy the output and paste as `SECRET_KEY` value in Railway.

6. **Set Root Directory:**
   - Go to **Settings** → **Service**
   - Set **Root Directory** to: `backend`
   - Click **Deploy**

7. **Copy Your Backend URL:**
   After deployment completes, Railway gives you a URL like:
   ```
   https://expense-tracker-production.up.railway.app
   ```
   **SAVE THIS URL - you'll need it for Step 2!**

---

## Step 2: Update Frontend Configuration (2 minutes)

1. **Update Environment Variable:**
   Edit `frontend_new/.env.production`:
   ```
   VITE_API_BASE_URL=https://your-backend.up.railway.app
   ```
   Replace with your actual Railway backend URL from Step 1.

2. **Commit Changes:**
   ```bash
   git add frontend_new/.env.production
   git commit -m "Update production API URL"
   git push
   ```

---

## Step 3: Deploy Frontend to Vercel (3 minutes)

1. **Deploy to Vercel:**
   - Go to https://vercel.com and sign in with GitHub
   - Click "Add New Project"
   - Select your `expense-tracker` repository
   - Configure:
     - **Root Directory**: `frontend_new`
     - **Framework**: Vite
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`

2. **Add Environment Variable:**
   - In Vercel project settings, go to **Environment Variables**
   - Add:
     ```
     Name: VITE_API_BASE_URL
     Value: https://your-backend.up.railway.app
     ```

3. **Deploy:**
   - Click **Deploy**
   - Vercel will build and deploy your app

4. **Get Your Frontend URL:**
   Vercel gives you a URL like:
   ```
   https://expense-tracker.vercel.app
   ```

---

## Step 4: Final CORS Update (1 minute)

1. **Update Backend CORS:**
   - Go back to Railway → Backend Service → **Variables**
   - Update `ALLOWED_ORIGINS`:
     ```
     ALLOWED_ORIGINS=https://expense-tracker.vercel.app
     ```
     (Replace with your actual Vercel URL)
   - Railway will auto-redeploy

---

## Done! Test Your App

1. **Open Your App:**
   Go to your Vercel URL: `https://expense-tracker.vercel.app`

2. **Register a New Account:**
   - Email: `test@example.com`
   - Password: `TestPassword123!`

3. **Verify E2EE Works:**
   - Create an account
   - Add a transaction
   - Open Browser DevTools → Network tab
   - Look for POST to `/api/transactions`
   - Payload should show `encrypted_data` blob (not plaintext!)

---

## Costs

- **Railway**: FREE tier (500 hours/month)
- **Vercel**: FREE tier (unlimited static hosting)
- **PostgreSQL**: FREE tier (1GB storage)

**Total Cost: $0/month** for small-medium usage!

---

## Need Help?

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Full Deployment Guide**: See `DEPLOYMENT.md` for detailed instructions

---

## Custom Domain (Optional)

### Add Custom Domain to Vercel:
1. Go to Vercel project → **Settings** → **Domains**
2. Add your domain: `expense.yourdomain.com`
3. Update DNS as instructed
4. Update `ALLOWED_ORIGINS` on Railway backend

### Add Custom Domain to Railway:
1. Go to Railway backend service → **Settings** → **Domains**
2. Add custom domain: `api.yourdomain.com`
3. Update DNS CNAME record
4. Update `VITE_API_BASE_URL` on Vercel
