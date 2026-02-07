import { NextRequest, NextResponse } from 'next/server';
import { EgressClient } from 'livekit-server-sdk';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
    try {
        const { egressId } = await req.json();

        if (!egressId) {
            return NextResponse.json({ error: 'Missing egressId' }, { status: 400 });
        }

        const LIVEKIT_API_URL = process.env.LIVEKIT_API_URL;
        const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
        const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

        if (!LIVEKIT_API_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
            return NextResponse.json({ error: 'LiveKit credentials not configured' }, { status: 500 });
        }

        const egressClient = new EgressClient(LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

        console.log(`Stopping recording for egressId: ${egressId}`);

        const egressInfo = await egressClient.stopEgress(egressId);

        // Calculate duration and file size if available immediately
        // Note: Webhooks are more reliable for this, but we'll try to get it from the response
        const fileResult = egressInfo.fileResults?.[0];

        const updateData: any = {
            status: 'finished',
            endedAt: new Date(),
        };

        if (fileResult) {
            const filename = fileResult.filename;
            const EGRESS_BASE_PATH = process.env.EGRESS_BASE_PATH || '/var/recordings';

            // Ensure we store the absolute path
            updateData.filePath = filename.startsWith('/')
                ? filename
                : `${EGRESS_BASE_PATH}/${filename}`;

            updateData.fileSizeBytes = Number(fileResult.size);
            updateData.durationSeconds = Number(fileResult.duration) / 1e9;
        }

        await adminDb.collection('recordings').doc(egressId).update(updateData);

        return NextResponse.json({
            success: true,
            message: 'Recording stopped successfully'
        });

    } catch (error: any) {
        console.error('Failed to stop recording:', error);
        return NextResponse.json({
            error: 'Failed to stop recording',
            details: error.message
        }, { status: 500 });
    }
}
