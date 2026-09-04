import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, adminDb } from '@/lib/firebase/admin';
import { Client } from 'minio';
import type { Firestore } from 'firebase-admin/firestore';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'storage.podiumclass.online';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '';
const MINIO_PUBLIC_BASE = process.env.MINIO_PUBLIC_BASE || 'https://storage.podiumclass.online';

const client = new Client({
    endPoint: MINIO_ENDPOINT,
    useSSL: true,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
});

const MAX_SIZES: Record<string, number> = {
    profile: 5 * 1024 * 1024,
    material: 50 * 1024 * 1024,
    resource: 20 * 1024 * 1024,
};

function sanitizeFileName(fileName: string): string {
    const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return cleaned || 'file';
}

function assertId(id: string, label: string): string {
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        throw new Error(`Invalid ${label}`);
    }
    return id;
}

interface ObjectTarget {
    bucket: string;
    key: string;
}

function resolveTarget(kind: string, uid: string, body: any): ObjectTarget {
    switch (kind) {
        case 'profile':
            // Unique key per upload so the photoURL changes and caches bust naturally
            return { bucket: 'profile-pictures', key: `${uid}/${Date.now()}.jpg` };
        case 'material': {
            const sessionId = assertId(body?.sessionId, 'sessionId');
            const fileName = sanitizeFileName(body?.fileName);
            return { bucket: 'lms-materials', key: `sessions/${sessionId}/materials/${Date.now()}_${fileName}` };
        }
        case 'resource': {
            const groupId = assertId(body?.groupId, 'groupId');
            const fileName = sanitizeFileName(body?.fileName);
            return { bucket: 'lms-materials', key: `group-resources/${groupId}/${Date.now()}_${fileName}` };
        }
        default:
            throw new Error('Invalid kind');
    }
}

/**
 * Authorization for uploads beyond the caller's own profile:
 * - material: only the session host/lecturer, a co-host, or an admin
 * - resource: only the group owner, an assigned lecturer, a verified-student
 *   manager, or an admin
 */
async function isAuthorizedForTarget(
    kind: string,
    uid: string,
    target: ObjectTarget
): Promise<boolean> {
    const db = adminDb as Firestore;
    try {
        if (kind === 'material') {
            const sessionId = target.key.split('/')[1];
            const sessionSnap = await db.collection('sessions').doc(sessionId).get();
            if (!sessionSnap.exists) return false;
            const session = sessionSnap.data() || {};
            if (session.hostId === uid || session.lecturerId === uid) return true;
            const coHost = await db.collection('sessions').doc(sessionId).collection('co_hosts').doc(uid).get();
            if (coHost.exists && coHost.data()?.isActive === true) return true;
            const profile = await db.collection('profiles').doc(uid).get();
            return profile.exists && profile.data()?.role === 'admin';
        }

        if (kind === 'resource') {
            const groupId = target.key.split('/')[1];
            const groupSnap = await db.collection('groups').doc(groupId).get();
            if (!groupSnap.exists) return false;
            if (groupSnap.data()?.ownerId === uid) return true;
            const membership = await db.collection('group_memberships').doc(`${uid}_${groupId}`).get();
            if (membership.exists) {
                const role = membership.data()?.role;
                if (role === 'lecturer' || role === 'instructor') return true;
            }
            const profile = await db.collection('profiles').doc(uid).get();
            if (profile.exists) {
                const p = profile.data() || {};
                if (p.role === 'admin') return true;
                if (p.role === 'student' && p.isVerified === true) return true;
            }
            return false;
        }

        // profile uploads are always self-scoped by the key
        return true;
    } catch (e) {
        console.error('[Storage:Presign:Authz]', e);
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        const decoded = await getAuthenticatedUser(request);
        if (!decoded) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const kind = body?.kind as string;
        const target = resolveTarget(kind, decoded.uid, body);

        // Self-scoped profile uploads pass; shared targets require membership/moderator rights
        if (kind !== 'profile') {
            const allowed = await isAuthorizedForTarget(kind, decoded.uid, target);
            if (!allowed) {
                return NextResponse.json({ error: 'Forbidden: you do not have permission to upload here' }, { status: 403 });
            }
        }

        const declaredSize = Number(body?.size);
        const maxSize = MAX_SIZES[kind];
        if (maxSize && declaredSize && declaredSize > maxSize) {
            return NextResponse.json({ error: 'File too large' }, { status: 413 });
        }

        const uploadUrl = await client.presignedPutObject(target.bucket, target.key, 900);
        const url = `${MINIO_PUBLIC_BASE}/${target.bucket}/${target.key}`;

        return NextResponse.json({ uploadUrl, url, bucket: target.bucket, key: target.key });
    } catch (error: any) {
        const status = error.message?.includes('Invalid') || error.message?.includes('kind') ? 400 : 500;
        console.error('[Storage:Presign]', error);
        return NextResponse.json({ error: error.message || 'Failed to create upload' }, { status });
    }
}