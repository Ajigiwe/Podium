import { NextRequest, NextResponse } from 'next/server';
import { EgressClient, EncodedFileOutput, EncodingOptionsPreset } from 'livekit-server-sdk';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
    try {
        const { roomId, lecturerId, classTitle } = await req.json();

        if (!roomId || !lecturerId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const LIVEKIT_API_URL = process.env.LIVEKIT_API_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace('wss://', 'https://').replace('ws://', 'http://');
        const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
        const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

        console.log('DEBUG: LiveKit Config:', {
            url: LIVEKIT_API_URL ? 'PRESENT' : 'MISSING',
            key: LIVEKIT_API_KEY ? 'PRESENT' : 'MISSING',
            secret: LIVEKIT_API_SECRET ? 'PRESENT' : 'MISSING'
        });

        if (!LIVEKIT_API_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
            return NextResponse.json({
                error: 'LiveKit credentials not configured',
                debug: {
                    url: !!LIVEKIT_API_URL,
                    key: !!LIVEKIT_API_KEY,
                    secret: !!LIVEKIT_API_SECRET
                }
            }, { status: 500 });
        }

        const egressClient = new EgressClient(LIVEKIT_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

        const EGRESS_BASE_PATH = process.env.EGRESS_BASE_PATH || '/var/recordings';
        const filename = `${roomId}-${Date.now()}.mp4`;
        const filepath = `${EGRESS_BASE_PATH}/${filename}`;

        const roomName = `podium_${roomId}`;
        console.log(`Starting recording for room ${roomName} to ${filepath}`);

        const egressInfo = await egressClient.startRoomCompositeEgress(
            roomName,
            {
                fileType: undefined,
                filepath: filepath,
            } as any,
            'grid', // layout
            EncodingOptionsPreset.H264_1080P_30, // preset
            false, // audioOnly
            false  // videoOnly
        );

        if (!egressInfo || !egressInfo.egressId) {
            throw new Error('Failed to start egress');
        }

        // Save to Firestore
        // Use a clean object for Firestore
        const recordingData = {
            roomId,
            egressId: egressInfo.egressId,
            lecturerId,
            classTitle: classTitle || 'Untitled Class',
            status: 'recording',
            filePath: filepath, // Metadata only, actual file is on VPS disk
            startedAt: new Date(), // Firestore will convert this to Timestamp
            createdAt: new Date(),
        };

        await adminDb.collection('recordings').doc(egressInfo.egressId).set(recordingData);

        return NextResponse.json({
            success: true,
            egressId: egressInfo.egressId,
            message: 'Recording started successfully'
        });

    } catch (error: any) {
        console.error('Failed to start recording:', error);
        return NextResponse.json({
            error: 'Failed to start recording',
            details: error.message,
            stack: error.stack,
            config: {
                url: process.env.LIVEKIT_API_URL ? 'PRESENT' : 'MISSING',
                key: process.env.LIVEKIT_API_KEY ? 'PRESENT' : 'MISSING',
                secret: process.env.LIVEKIT_API_SECRET ? 'PRESENT' : 'MISSING'
            }
        }, { status: 500 });
    }
}
