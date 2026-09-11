import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const raw = fs.readFileSync('/opt/podium/.env.local', 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const i = line.indexOf('=');
  const key = line.slice(0, i).trim();
  let val = line.slice(i + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

initializeApp({
  credential: cert({
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.split('\\n').join('\n'),
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
  }),
});

const db = getFirestore();
const snap = await db.collection('profiles').where('role', 'in', ['admin', 'superadmin']).limit(10).get();
snap.forEach(d => {
  const v = d.data();
  console.log([v.email, v.name || v.displayName || '', v.role].join(' | '));
});
console.log('TOTAL:', snap.size);
