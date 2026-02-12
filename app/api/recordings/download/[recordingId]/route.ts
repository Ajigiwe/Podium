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
        console.log(`[DOWNLOAD] Request for recordingId: ${recordingId}`);

        if (!recordingId) {
            return NextResponse.json({ error: 'Missing recordingId' }, { status: 400 });
        }

        const recordingDoc = await adminDb.collection('recordings').doc(recordingId).get();

        if (!recordingDoc.exists) {
            console.error(`[DOWNLOAD] Recording doc not found in Firestore: ${recordingId}`);
            return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
        }

        const recording = recordingDoc.data();
        let filePath = recording?.filePath;
        console.log(`[DOWNLOAD] Firestore filePath: ${filePath}`);

        if (!filePath) {
            return NextResponse.json({ error: 'File path not found in recording' }, { status: 404 });
        }

        // Handle relative paths if the stop API script bug affected this record
        if (!filePath.startsWith('/')) {
            const EGRESS_BASE_PATH = process.env.EGRESS_BASE_PATH || '/var/recordings';
            filePath = path.join(EGRESS_BASE_PATH, filePath);
            console.log(`[DOWNLOAD] Resolved relative path to: ${filePath}`);
        }

        // Verify file exists
        if (!fs.existsSync(filePath)) {
            console.warn(`[DOWNLOAD] Exact file MISSING at: ${filePath}. Trying fuzzy match...`);

            const roomId = recording?.roomId;
            const dir = path.dirname(filePath);

            if (roomId && fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                // Look for any file that starts with the roomId and ends with .mp4
                const match = files.find(f => f.startsWith(roomId) && f.endsWith('.mp4'));

                if (match) {
                    const newPath = path.join(dir, match);
                    console.log(`[DOWNLOAD] Fuzzy match found! Using: ${newPath}`);
                    filePath = newPath;
                } else {
                    console.error(`[DOWNLOAD] No fuzzy match found for roomId: ${roomId} in ${dir}`);
                    return NextResponse.json({
                        error: 'File not found on server',
                        debug: {
                            requestedPath: filePath,
                            dirContents: files.slice(0, 10)
                        }
                    }, { status: 404 });
                }
            } else {
                return NextResponse.json({
                    error: 'File not found on server',
                    debug: { requestedPath: filePath }
                }, { status: 404 });
            }
        }

        console.log(`[DOWNLOAD] Final path being served: ${filePath}`);
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
