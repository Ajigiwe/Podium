# Deployment Guide - Lite-LMS

This guide covers deploying Lite-LMS to Vercel with Firebase and Paystack integration.

## Prerequisites

- GitHub account
- Vercel account (free tier)
- Firebase project configured
- Paystack account verified

## Step 1: Prepare for Deployment

### 1.1 Update Environment Variables

Create `.env.production` file (do not commit):

```bash
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Paystack (LIVE keys for production)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxx

# Production URL (update after deployment)
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### 1.2 Update `.gitignore`

Ensure sensitive files are not committed:

```
# Environment variables
.env
.env.local
.env.production
.env.development

# Firebase service account
firebase-adminsdk-*.json
```

## Step 2: Push to GitHub

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Lite-LMS virtual classroom"

# Create GitHub repository and push
git remote add origin https://github.com/yourusername/lite-lms.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

### 3.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Select `lite-lms` repository

### 3.2 Configure Build Settings

Vercel will auto-detect Next.js. Verify:
- **Framework Preset**: Next.js
- **Root Directory**: `./` (or `lite-lms` if in subdirectory)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 3.3 Add Environment Variables

In Vercel project settings:

1. Go to **Settings** → **Environment Variables**
2. Add all variables from `.env.production`
3. Select **Production** environment
4. Click **Save**

**Important**: For `FIREBASE_ADMIN_PRIVATE_KEY`, paste the entire key including `\n` characters.

### 3.4 Deploy

1. Click **Deploy**
2. Wait for build to complete (~2-3 minutes)
3. Copy your deployment URL (e.g., `https://lite-lms.vercel.app`)

## Step 4: Update Firebase Configuration

### 4.1 Add Authorized Domain

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Click **Add domain**
5. Add your Vercel domain: `lite-lms.vercel.app`

### 4.2 Update Realtime Database URL

If using a different region, update the database URL in:
- `lib/firebase/config.ts`
- `lib/firebase/admin.ts`

## Step 5: Update Paystack Webhook

1. Go to [Paystack Dashboard](https://dashboard.paystack.com/)
2. Go to **Settings** → **API Keys & Webhooks**
3. Update **Webhook URL** to:
   ```
   https://your-domain.vercel.app/api/paystack/webhook
   ```
4. Click **Save**

## Step 6: Update App URL

1. Go back to Vercel project settings
2. Update `NEXT_PUBLIC_APP_URL` environment variable
3. Set to your production URL: `https://lite-lms.vercel.app`
4. Redeploy (Vercel will auto-redeploy on env var change)

## Step 7: Test Production Deployment

### 7.1 Test Authentication
- [ ] Register new account
- [ ] Login with email/password
- [ ] Login with Google OAuth
- [ ] Verify role-based routing

### 7.2 Test Lecturer Flow
- [ ] Create session with pricing
- [ ] Add YouTube video ID
- [ ] Start class
- [ ] View classroom

### 7.3 Test Student Flow
- [ ] View available sessions
- [ ] Click "Pay & Join"
- [ ] Complete mobile money payment
- [ ] Verify access granted
- [ ] Send chat message

### 7.4 Test Webhook
- [ ] Make a payment
- [ ] Check Paystack dashboard for webhook delivery
- [ ] Verify transaction created in Firestore
- [ ] Check Vercel logs for webhook execution

## Step 8: Custom Domain (Optional)

### 8.1 Add Custom Domain

1. In Vercel project, go to **Settings** → **Domains**
2. Add your custom domain (e.g., `litelms.com`)
3. Follow DNS configuration instructions

### 8.2 Update Configurations

After adding custom domain:
1. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars
2. Add domain to Firebase authorized domains
3. Update Paystack webhook URL

## Step 9: Monitoring & Analytics

### 9.1 Vercel Analytics

1. Go to **Analytics** tab in Vercel project
2. Enable **Web Analytics** (free)
3. Monitor:
   - Page views
   - Performance metrics
   - Error rates

### 9.2 Firebase Monitoring

1. Go to Firebase Console → **Performance**
2. Monitor:
   - Database reads/writes
   - Authentication usage
   - Realtime Database connections

### 9.3 Paystack Dashboard

Monitor:
- Transaction success rate
- Revenue trends
- Failed payment reasons

## Step 10: Production Checklist

- [ ] All environment variables configured
- [ ] Firebase authorized domains updated
- [ ] Paystack webhook URL updated to production
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Test complete user flow
- [ ] Monitor error logs
- [ ] Set up uptime monitoring (optional)

## Scaling Considerations

### Firebase Limits (Free Tier)

If you exceed free tier limits:
- **Firestore**: 50K reads/day → Upgrade to Blaze Plan
- **Realtime Database**: 100 connections → Upgrade to Blaze Plan
- **Authentication**: Unlimited (always free)

### Vercel Limits (Hobby Tier)

- **Bandwidth**: 100GB/month
- **Build Minutes**: 6000 minutes/month
- **Serverless Function Execution**: 100GB-hours

For 300+ concurrent users, consider **Pro Plan** ($20/month).

## Troubleshooting

### Build Fails on Vercel
**Solution**: Check build logs for errors. Common issues:
- Missing environment variables
- TypeScript errors
- Dependency conflicts

### Webhook Not Receiving Events
**Solution**:
1. Check webhook URL is correct
2. Verify Vercel function is deployed
3. Check Vercel function logs
4. Test webhook with Paystack test event

### "Firebase: Error (auth/unauthorized-domain)"
**Solution**: Add Vercel domain to Firebase authorized domains

### Database Connection Errors
**Solution**: Verify Firebase credentials in environment variables

## Rollback

If deployment has issues:

1. Go to Vercel project → **Deployments**
2. Find previous working deployment
3. Click **⋯** → **Promote to Production**

## Support

- **Vercel Support**: https://vercel.com/support
- **Firebase Support**: https://firebase.google.com/support
- **Paystack Support**: support@paystack.com

---

**Congratulations!** Your Lite-LMS platform is now live! 🎉
