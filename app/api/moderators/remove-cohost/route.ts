import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
    try {
        const { sessionId, hostUserId, coHostUserId } = await request.json();

        if (!sessionId || !hostUserId || !coHostUserId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Verify requester is the main host
        const sessionRef = adminDb.collection('sessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();

        if (!sessionSnap.exists) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const sessionData = sessionSnap.data()!;
        const isHost =
            sessionData.hostId === hostUserId ||
            sessionData.lecturerId === hostUserId;

        if (!isHost) {
            return NextResponse.json(
                { error: 'Only the main host can remove co-hosts' },
                { status: 403 }
            );
        }

        // Verify target is actually a co-host
        const coHostRef = adminDb
            .collection('sessions')
            .doc(sessionId)
            .collection('co_hosts')
            .doc(coHostUserId);

        const coHostSnap = await coHostRef.get();
        if (!coHostSnap.exists || coHostSnap.data()?.isActive !== true) {
            return NextResponse.json(
                { error: 'User is not an active co-host' },
                { status: 400 }
            );
        }

        // Deactivate (soft-delete)
        await coHostRef.update({ isActive: false });

        return NextResponse.json({
            success: true,
            message: 'Co-host removed',
        });
    } catch (error) {
        console.error('[API:remove-cohost] Error:', error);
        return NextResponse.json(
            { error: 'Failed to remove co-host' },
            { status: 500 }
        );
    }
}
