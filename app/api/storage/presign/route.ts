import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/firebase/admin';
import { Client } from 'minio';

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
            return { bucket: 'profile-pictures', key: `${uid}.jpg` };
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

export async function POST(request: NextRequest) {
    try {
        const decoded = await getAuthenticatedUser(request);
        if (!decoded) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const kind = body?.kind as string;
        const target = resolveTarget(kind, decoded.uid, body);

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