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
const idTokenRes = await fetch(
	'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' +
		(env.FIREBASE_API_KEY || 'AIzaSyDhCc-X1SRLHE6MOPBgHWLViUzgj_y6K40'),
	{
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token: await auth.createCustomToken(user.uid), returnSecureToken: true }),
	}
);
const { idToken } = await idTokenRes.json();

// Reproduce the browser exactly: 2MB File with image/jpeg content-type, no explicit headers on PUT
const fileData = fs.readFileSync('/tmp/t2.jpg');
const blob = new Blob([fileData], { type: 'image/jpeg' });
console.log('blob size:', blob.size, 'type:', blob.type);

const presignRes = await fetch('http://localhost:3000/api/storage/presign', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
	body: JSON.stringify({ kind: 'profile', size: blob.size }),
});
const data = await presignRes.json();
console.log('presign:', presignRes.status);

// Browser fetch PUT: sets Content-Type automatically from the Blob
const putRes = await fetch(data.uploadUrl, { method: 'PUT', body: blob });
console.log('browser-style PUT:', putRes.status);
if (!putRes.ok) console.log('PUT error:', (await putRes.text()).slice(0, 300));

const getRes = await fetch(data.url);
console.log('GET back:', getRes.status, '| content-type:', getRes.headers.get('content-type'));
process.exit(0);
