import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Load .env.local file variables manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value.replace(/\\n/g, '\n');
    }
  });
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin variables in .env.local");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const db = admin.firestore();
const auth = admin.auth();

const targetEmail = process.argv[2] || 'minatoflash82@gmail.com';

async function grantAdminRole(email) {
  try {
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;
    
    // Update Firestore profile
    const profileRef = db.collection('profiles').doc(uid);
    await profileRef.set({
      role: 'admin',
      email: email,
      fullName: userRecord.displayName || 'Administrator',
    }, { merge: true });

    console.log(`Successfully made ${email} (UID: ${uid}) an admin in Firestore!`);
  } catch (error) {
    console.error('Error setting admin role:', error);
  }
}

grantAdminRole(targetEmail);
