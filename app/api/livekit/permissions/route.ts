import { RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { room, identity, permissions } = body;

        if (!room || !identity || !permissions) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

        if (!apiKey || !apiSecret || !wsUrl) {
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
        }

        const svc = new RoomServiceClient(wsUrl, apiKey, apiSecret);

        await svc.updateParticipant(room, identity, undefined, {
            canPublish: permissions.canPublish,
            canSubscribe: true,
            canPublishData: true,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating permissions:", error);
        return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
    }
}
