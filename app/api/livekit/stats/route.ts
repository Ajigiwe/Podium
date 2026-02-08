import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

        if (!apiKey || !apiSecret || !livekitUrl) {
            return NextResponse.json(
                { error: 'LiveKit credentials not configured' },
                { status: 500 }
            );
        }

        const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
        const rooms = await svc.listRooms();

        // Create a map of roomName -> participantCount
        const stats: Record<string, number> = {};

        rooms.forEach(room => {
            stats[room.name] = room.numParticipants;
        });

        return NextResponse.json({ stats });

    } catch (error) {
        console.error('Error fetching LiveKit stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch room stats' },
            { status: 500 }
        );
    }
}
