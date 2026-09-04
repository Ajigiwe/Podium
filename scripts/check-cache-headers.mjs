import * as minio from 'minio';
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

const mc = new minio.Client({
	endPoint: env.MINIO_ENDPOINT,
	useSSL: true,
	accessKey: env.MINIO_ACCESS_KEY,
	secretKey: env.MINIO_SECRET_KEY,
});

// List a few objects and check their metadata
const stream = mc.listObjectsV2('profile-pictures', '', true);
for await (const obj of stream) {
	console.log(obj.name, obj.size, 'bytes, lastModified:', obj.lastModified?.toISOString());
}

// Check bucket versioning
try {
	const versioning = await mc.getBucketVersioning('profile-pictures');
	console.log('bucket versioning:', versioning.status || 'not enabled');
} catch (e) {
	console.log('versioning check:', e.message);
}
process.exit(0);
