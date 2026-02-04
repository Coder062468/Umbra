# Deployment Guide - E2E Encrypted Expense Tracker

## Architecture
- **Frontend**: Vercel (Static React/Vite app)
- **Backend**: Railway.app (FastAPI Python server)
- **Database**: Railway PostgreSQL (managed)

---

## Part 1: Deploy Backend (Railway)

### 1.1: Push Code to GitHub
```bash
cd C:\expense_tracker
git init
git add .
git commit -m "Initial commit - E2E expense tracker"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/expense-tracker.git
git push -u origin main
```

### 1.2: Deploy to Railway
1. Go to https://railway.app and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `expense-tracker` repository
5. Railway will auto-detect FastAPI and create a service

### 1.3: Add PostgreSQL Database
1. In your Railway project, click **"New Service"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will provision a database and auto-inject `DATABASE_URL`

### 1.4: Configure Environment Variables
In Railway's **Variables** tab, add:

```
SECRET_KEY=<GENERATE_NEW_SECRET_KEY_HERE>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
APP_NAME=Expense Tracker API
APP_VERSION=1.0.0
DEBUG=False
ALLOWED_ORIGINS=https://your-app.vercel.app
RATE_LIMIT_PER_MINUTE=60
```

**Generate a secure SECRET_KEY** (run this locally):
```python
import secrets
print(secrets.token_urlsafe(32))
```

### 1.5: Set Root Directory (Important!)
1. Go to **Settings** → **Service**
2. Set **Root Directory** to: `backend`
3. Railway will now deploy from the backend folder

### 1.6: Get Your Backend URL
After deployment completes, Railway will give you a URL like:
```
https://expense-tracker-production.up.railway.app
```

**CRITICAL**: Railway provides HTTPS by default. This is REQUIRED for Web Crypto API!

---

## Part 2: Deploy Frontend (Vercel)

### 2.1: Update API Endpoint
Update your frontend to use the production backend URL.

**File**: `frontend_new/src/services/api.ts`
Replace `http://localhost:8000` with your Railway backend URL:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://expense-tracker-production.up.railway.app'
```

### 2.2: Create Vercel Configuration
Create `frontend_new/vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "devCommand": "npm run start"
}
```

### 2.3: Deploy to Vercel
1. Go to https://vercel.com and sign in with GitHub
2. Click **"Add New Project"**
3. Select your `expense-tracker` repository
4. Configure:
   - **Root Directory**: `frontend_new`
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add environment variable:
   ```
   VITE_API_URL=https://your-railway-backend.up.railway.app
   ```
6. Click **Deploy**

### 2.4: Get Your Frontend URL
Vercel will give you a URL like:
```
https://expense-tracker.vercel.app
```

### 2.5: Update CORS on Backend
Go back to Railway → Backend Service → Variables:
Update `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://expense-tracker.vercel.app
```

---

## Part 3: Final Configuration

### 3.1: Update Frontend API Service
**File**: `frontend_new/src/services/api.ts`

Update all hardcoded `http://localhost:8000` references:
```typescript
// Replace this pattern throughout the file:
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://your-backend.up.railway.app'

// Example in axios instance:
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // ...
})
```

### 3.2: Environment-based Configuration
Create `frontend_new/.env.production`:
```
VITE_API_URL=https://your-backend.up.railway.app
```

### 3.3: Test E2EE in Production
1. Open your Vercel app: `https://expense-tracker.vercel.app`
2. Register a new account
3. Verify encryption works:
   - Check browser DevTools → Network tab
   - All transaction/account data should be encrypted blobs
   - Server never sees plaintext amounts, names, narrations

---

## Alternative Deployment Options

### Option 1: Render (Free Backend + Database)
**Backend**: https://render.com
- Free tier: 750 hours/month (enough for small-medium usage)
- Auto-sleeps after 15 min inactivity (cold starts ~30s)
- Built-in PostgreSQL free tier

**Steps**:
1. Create Web Service → Connect GitHub
2. Root Directory: `backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add PostgreSQL database (free tier)

### Option 2: DigitalOcean App Platform
**Backend + Database**: $5-12/month
- More reliable than free tiers
- No cold starts
- Better for production use

### Option 3: Self-Hosted (VPS)
**Backend + Database**: $5-10/month
- DigitalOcean Droplet / Linode / Vultr
- Full control
- Requires manual setup (Docker recommended)

---

## Security Checklist for Production

- [ ] Generated NEW `SECRET_KEY` (never use dev keys in production!)
- [ ] Set `DEBUG=False` in backend
- [ ] HTTPS enabled (Railway/Vercel provide this automatically)
- [ ] CORS configured to only allow your frontend domain
- [ ] Database uses strong password (Railway auto-generates)
- [ ] No `.env` files committed to git (check `.gitignore`)
- [ ] Rate limiting enabled
- [ ] Test E2EE in production (check Network tab - data should be encrypted)

---

## Post-Deployment Testing

### Test E2EE Integrity:
1. Register new user in production
2. Create account with name "Test Account"
3. Add transaction
4. Open Browser DevTools → Network → XHR
5. Look for POST to `/api/accounts` - payload should contain `encrypted_data` blob
6. Look for POST to `/api/transactions` - payload should contain `encrypted_data` blob
7. Database stores only encrypted blobs - server NEVER sees plaintext!

### Test Cross-Device:
1. Login from different device/browser
2. Verify master key derivation works (PBKDF2 from password + salt)
3. Verify RSA key restoration works (encrypted private key decrypted with master key)
4. Verify invitation flow works across different users

---

## Monitoring & Logs

### Railway:
- Go to project → **Deployments** → Click deployment
- View real-time logs
- Check PostgreSQL metrics

### Vercel:
- Go to project → **Deployments**
- View build logs and runtime logs
- Analytics dashboard

---

## Scaling Considerations

**Current Free Tier Limits**:
- Railway: 500 hours/month execution time
- Vercel: Unlimited static hosting
- PostgreSQL on Railway: 1GB storage

**When to Upgrade**:
- Railway Pro: $20/month (no limits, better performance)
- Database: Upgrade when approaching 1GB or need more connections
- CDN: Consider Cloudflare for global caching

---

## Troubleshooting

### "Web Crypto API not available"
- Ensure HTTPS is enabled (Railway/Vercel provide this)
- Check browser console for security errors

### "CORS error"
- Verify `ALLOWED_ORIGINS` includes your Vercel domain
- Check for trailing slashes in URLs

### "Database connection failed"
- Railway auto-injects `DATABASE_URL` - don't override it
- Check Railway logs for connection errors

### "RSA private key not found"
- Clear browser cache and re-login
- Check backend `/api/auth/encrypted-private-key` endpoint works

---

## Custom Domain (Optional)

### Vercel Frontend:
1. Go to project → **Settings** → **Domains**
2. Add your domain (e.g., `expense.yourdomain.com`)
3. Update DNS records as instructed
4. Update `ALLOWED_ORIGINS` on backend

### Railway Backend:
1. Go to service → **Settings** → **Domains**
2. Add custom domain (e.g., `api.yourdomain.com`)
3. Update DNS CNAME record
4. Update `VITE_API_URL` on frontend

---

## Support

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- FastAPI Deployment: https://fastapi.tiangolo.com/deployment/
