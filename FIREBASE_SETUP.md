# Lite-LMS - Firebase Setup Guide

This guide will help you set up Firebase for the Lite-LMS virtual classroom platform.

## Prerequisites

- Google account
- Firebase CLI installed (`npm install -g firebase-tools`)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `lite-lms` (or your preferred name)
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Get started**
2. Enable **Email/Password** sign-in method
3. Enable **Google** sign-in method
   - Add your project support email
   - Save

## Step 3: Create Firestore Database

1. Go to **Firestore Database** → **Create database**
2. Select **Start in production mode**
3. Choose location: **us-central** (or closest to Ghana)
4. Click "Enable"

## Step 4: Create Realtime Database

1. Go to **Realtime Database** → **Create database**
2. Select location: **us-central1** (or closest to Ghana)
3. Start in **locked mode** (we'll add rules later)
4. Click "Enable"

## Step 5: Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click **Web** icon (</>) to add a web app
4. Register app name: `Lite-LMS Web`
5. Copy the `firebaseConfig` object

Example:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "lite-lms-xxxxx.firebaseapp.com",
  projectId: "lite-lms-xxxxx",
  storageBucket: "lite-lms-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456",
  measurementId: "G-XXXXXXXXXX"
};
```

## Step 6: Get Service Account Key (Admin SDK)

1. Go to **Project Settings** → **Service accounts**
2. Click **Generate new private key**
3. Download the JSON file
4. Extract these values:
   - `project_id`
   - `client_email`
   - `private_key`

## Step 7: Configure Environment Variables

Create `.env.local` file in your project root:

```bash
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----\n"

# Paystack
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important**: Replace `\n` in the private key with actual newlines when copying.

## Step 8: Deploy Security Rules

### Firestore Rules

1. Go to **Firestore Database** → **Rules**
2. Copy content from `firestore.rules` file
3. Paste and click **Publish**

### Realtime Database Rules

1. Go to **Realtime Database** → **Rules**
2. Copy content from `database.rules.json` file
3. Paste and click **Publish**

## Step 9: Create Firestore Indexes

Some queries require composite indexes. Firebase will prompt you to create them when needed, or you can create them manually:

1. Go to **Firestore Database** → **Indexes**
2. Click **Add index**
3. Create these indexes:

**Index 1: Transactions by User**
- Collection: `transactions`
- Fields:
  - `userId` (Ascending)
  - `createdAt` (Descending)

**Index 2: Transactions by Session**
- Collection: `transactions`
- Fields:
  - `sessionId` (Ascending)
  - `status` (Ascending)

**Index 3: Sessions by Lecturer**
- Collection: `sessions`
- Fields:
  - `lecturerId` (Ascending)
  - `createdAt` (Descending)

## Step 10: Test the Setup

1. Start your development server:
```bash
npm run dev
```

2. Open http://localhost:3000
3. Register a new account
4. Check Firebase Console to verify:
   - User created in **Authentication**
   - Profile created in **Firestore** → `profiles` collection

## Troubleshooting

### Error: "Firebase: Error (auth/unauthorized-domain)"
**Solution**: Add your domain to authorized domains
1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add `localhost` and your production domain

### Error: "Missing or insufficient permissions"
**Solution**: Check Firestore security rules are deployed correctly

### Error: "PERMISSION_DENIED: Permission denied"
**Solution**: Check Realtime Database rules are deployed correctly

## Production Deployment

When deploying to production (Vercel):

1. Update `NEXT_PUBLIC_APP_URL` to your production URL
2. Add environment variables in Vercel dashboard
3. Add production domain to Firebase authorized domains
4. Update Paystack webhook URL to production endpoint

## Cost Monitoring

Firebase free tier (Spark Plan):
- **Firestore**: 50K reads/day, 20K writes/day
- **Realtime Database**: 100 concurrent connections, 1GB storage
- **Authentication**: Unlimited

For 300+ concurrent users, you may need to upgrade to **Blaze Plan** (pay-as-you-go).

---

**Next Steps**: Set up Paystack account and configure webhook URL.
