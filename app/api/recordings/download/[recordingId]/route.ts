import { NextRequest, NextResponse } from 'next/server';
import { adminDb, getAuthenticatedUser } from '@/lib/firebase/admin';
import fs from 'fs';
import path from 'path';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ recordingId: string }> }
) {
    try {
        const decoded = await getAuthenticatedUser(req);
        if (!decoded) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { recordingId } = await context.params;

        if (!recordingId) {
            return NextResponse.json({ error: 'Missing recordingId' }, { status: 400 });
        }

        const recordingDoc = await adminDb.collection('recordings').doc(recordingId).get();

        if (!recordingDoc.exists) {
            return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
        }

        const recording = recordingDoc.data();
        let filePath = recording?.filePath;

        if (!filePath) {
            return NextResponse.json({ error: 'File path not found in recording' }, { status: 404 });
        }

        if (!filePath.startsWith('/')) {
            const EGRESS_BASE_PATH = process.env.EGRESS_BASE_PATH || '/var/recordings';
            filePath = path.join(EGRESS_BASE_PATH, filePath);
        }

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'Recording file not found' }, { status: 404 });
        }

        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);

        const fileStream = fs.createReadStream(filePath);

        const stream = new ReadableStream({
            start(controller) {
                fileStream.on('data', (chunk) => controller.enqueue(chunk));
                fileStream.on('end', () => controller.close());
                fileStream.on('error', (err) => controller.error(err));
            },
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': stats.size.toString(),
            },
        });

    } catch (error: any) {
        console.error('Download failed:', error);
        return NextResponse.json({ error: 'Download failed' }, { status: 500 });
    }
}
