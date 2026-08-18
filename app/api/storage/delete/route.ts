import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/firebase/admin';
import { Client } from 'minio';

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
            const bucket = 'profile-pictures';
            const key = `${decoded.uid}.jpg`;
            await client.removeObject(bucket, key);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unsupported kind' }, { status: 400 });
    } catch (error: any) {
        console.error('[Storage:Delete]', error);
        return NextResponse.json({ error: 'Failed to delete object' }, { status: 500 });
    }
}