import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, adminDb } from '@/lib/firebase/admin';
import { Client } from 'minio';
import type { Firestore } from 'firebase-admin/firestore';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'storage.podiumclass.online';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '';

const client = new Client({
    endPoint: MINIO_ENDPOINT,
    useSSL: true,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const decoded = await getAuthenticatedUser(request);
        if (!decoded) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const kind = body?.kind as string;

        if (kind === 'profile') {
            // Delete ALL photos under the user's prefix (uploads use uid/timestamp.jpg)
            const objectStream = client.listObjectsV2('profile-pictures', `${decoded.uid}/`, true);
            const toDelete: string[] = [];
            for await (const obj of objectStream) toDelete.push(obj.name);
            // Also try the legacy flat key
            toDelete.push(`${decoded.uid}.jpg`);
            for (const key of toDelete) {
                try { await client.removeObject('profile-pictures', key); } catch { /* object may not exist */ }
            }
            return NextResponse.json({ success: true });
        }

        if (kind === 'resource') {
            const groupId = body?.groupId as string;
            const resourceId = body?.resourceId as string;
            if (!groupId || !/^[a-zA-Z0-9_-]+$/.test(groupId) || !resourceId) {
                return NextResponse.json({ error: 'Missing groupId or resourceId' }, { status: 400 });
            }

            const db = adminDb as Firestore;

            // Authorization: group owner, assigned lecturer/instructor, verified student, or admin
            const groupSnap = await db.collection('groups').doc(groupId).get();
            if (!groupSnap.exists) {
                return NextResponse.json({ error: 'Community not found' }, { status: 404 });
            }
            let allowed = groupSnap.data()?.ownerId === decoded.uid;
            if (!allowed) {
                const membership = await db.collection('group_memberships').doc(`${decoded.uid}_${groupId}`).get();
                const role = membership.exists ? membership.data()?.role : undefined;
                if (role === 'lecturer' || role === 'instructor') allowed = true;
            }
            if (!allowed) {
                const profile = await db.collection('profiles').doc(decoded.uid).get();
                const p = profile.data() || {};
                if (p.role === 'admin' || (p.role === 'student' && p.isVerified === true)) allowed = true;
            }
            if (!allowed) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const resRef = db.collection('groups').doc(groupId).collection('resources').doc(resourceId);
            const resSnap = await resRef.get();
            if (!resSnap.exists) {
                return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
            }
            const resData = resSnap.data() || {};

            // Remove the MinIO object if it lives in our bucket (skip external links)
            if (resData.url && resData.url.includes('storage.podiumclass.online')) {
                try {
                    const url = new URL(resData.url);
                    const parts = url.pathname.replace(/^\//, '').split('/');
                    const bucket = parts.shift();
                    if (bucket) {
                        await client.removeObject(bucket, parts.join('/'));
                    }
                } catch (e) {
                    console.error('[Storage:Delete] object removal failed (doc will still be removed):', e);
                }
            }

            await resRef.delete();
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unsupported kind' }, { status: 400 });
    } catch (error: any) {
        console.error('[Storage:Delete]', error);
        return NextResponse.json({ error: 'Failed to delete object' }, { status: 500 });
    }
}