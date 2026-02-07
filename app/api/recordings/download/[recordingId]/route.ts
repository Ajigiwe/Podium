import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import fs from 'fs';
import path from 'path';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ recordingId: string }> }
) {
    try {
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

        // Handle relative paths if the stop API script bug affected this record
        if (!filePath.startsWith('/')) {
            const EGRESS_BASE_PATH = process.env.EGRESS_BASE_PATH || '/var/recordings';
            filePath = path.join(EGRESS_BASE_PATH, filePath);
        }

        // Verify file exists
        if (!fs.existsSync(filePath)) {
            console.error(`File missing at path: ${filePath}`);
            return NextResponse.json({
                error: 'File not found on server',
                debug: { path: filePath }
            }, { status: 404 });
        }

        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);

        // Create a stream
        const fileStream = fs.createReadStream(filePath);

        // Convert Node stream to Web Stream for Next.js
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
        return NextResponse.json({
            error: 'Download failed',
            details: error.message
        }, { status: 500 });
    }
}
