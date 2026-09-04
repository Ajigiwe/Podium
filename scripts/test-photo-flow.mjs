import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const raw = fs.readFileSync('/opt/podium/.env.local', 'utf8');
const env = Object.fromEntries(
	raw
		.split('\n')
		.filter((l) => l.includes('=') && !l.startsWith('#'))
		.map((l) => {
			const i = l.indexOf('=');
			return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/"/g, '')];
		})
);

const app = initializeApp({
	credential: cert({
		projectId: env.FIREBASE_ADMIN_PROJECT_ID,
		clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
		privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.split('\\n').join('\n'),
	}),
});

const auth = getAuth(app);
const users = await auth.listUsers(5);
const user = users.users.find((u) => !u.disabled);
if (!user) {
	console.log('no users found');
	process.exit(1);
}
console.log('test user:', user.uid, user.email);

// Mint custom token and exchange it for a real ID token
const customToken = await auth.createCustomToken(user.uid);
const keyRes = await fetch(
	'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + env.FIREBASE_API_KEY,
	{
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token: customToken, returnSecureToken: true }),
	}
);
const keyData = await keyRes.json();
if (!keyData.idToken) {
	console.log('TOKEN EXCHANGE FAILED', JSON.stringify(keyData).slice(0, 200));
	process.exit(1);
}
const idToken = keyData.idToken;
console.log('got id token: yes');

// 1. Presign
const presignRes = await fetch('http://localhost:3000/api/storage/presign', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
	body: JSON.stringify({ kind: 'profile', size: 5000 }),
});
const presignData = await presignRes.json();
console.log('presign status:', presignRes.status, '| uploadUrl?', !!presignData.uploadUrl);
if (!presignData.uploadUrl) {
	console.log('PRESIGN FAILED', JSON.stringify(presignData));
	process.exit(1);
}

// 2. PUT the file to MinIO (simulate a 5KB JPEG)
const fakeJpeg = Buffer.alloc(5000, 1);
const putRes = await fetch(presignData.uploadUrl, {
	method: 'PUT',
	body: fakeJpeg,
	headers: { 'Content-Type': 'image/jpeg' },
});
console.log('minio PUT status:', putRes.status);
if (!putRes.ok) console.log('PUT error body:', (await putRes.text()).slice(0, 300));

// 3. Anonymous GET back (this is what the avatar <img> tag does)
const getRes = await fetch(presignData.url);
console.log('anon GET status:', getRes.status);
process.exit(0);
