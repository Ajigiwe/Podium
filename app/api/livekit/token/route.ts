import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const room = req.nextUrl.searchParams.get('room');
    const username = req.nextUrl.searchParams.get('username');
    const role = req.nextUrl.searchParams.get('role'); // 'lecturer' or 'student'

    if (!room) {
        return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
    }
    if (!username) {
        return NextResponse.json({ error: 'Missing "username" query parameter' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity: username });

    // Grant permissions
    at.addGrant({
        roomJoin: true,
        room: room,
        canPublish: role === 'lecturer', // Only lecturers can publish initially
        canSubscribe: true,
        canPublishData: true,
    });

    return NextResponse.json({ token: await at.toJwt() });
}
