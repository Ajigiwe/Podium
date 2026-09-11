import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { RoomServiceClient } from 'livekit-server-sdk';
import { refundSession } from './refund-session';

export const dynamic = 'force-dynamic';

type LifecycleAction = 'start' | 'pause' | 'end' | 'archive';

async function notifyClassStart(sessionId: string, authToken: string) {
    try {
        const base = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
        await fetch(`${base}/api/notifications/class-start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ sessionId }),
        });
    } catch (err) {
        console.error('[Session Lifecycle] class-start notification failed:', err);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
        const caller = await adminDb.collection('profiles').doc(decoded.uid).get();
        const callerProfile = caller.data() || {};
        const { sessionId, action } = await request.json() as { sessionId?: string; action?: LifecycleAction };
        if (!sessionId || !action || !['start', 'pause', 'end', 'archive'].includes(action)) {
            return NextResponse.json({ error: 'sessionId and a valid action are required' }, { status: 400 });
        }

        const sessionRef = adminDb.collection('sessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        const session = sessionSnap.data() || {};
        const isAdmin = callerProfile.role === 'admin';
        const isHost = session.hostId === decoded.uid || session.lecturerId === decoded.uid;
        if (!isAdmin && !isHost) return NextResponse.json({ error: 'Only the session lecturer can manage this class' }, { status: 403 });

        if (action === 'start' && session.isActive === true) {
            return NextResponse.json({ error: 'This class is already live' }, { status: 409 });
        }

        const now = Timestamp.now();
        if (action === 'start') {
            if (session.isActive === true) {
                return NextResponse.json({ error: 'This class is already live' }, { status: 409 });
            }
            if (session.status === 'ended' || session.status === 'deleted' || session.isDeleted === true) {
                return NextResponse.json({ error: 'Ended or archived classes cannot be restarted' }, { status: 409 });
            }
            await sessionRef.update({
                isActive: true,
                status: 'active',
                startedAt: session.startedAt || now,
                endedAt: null,
                pausedAt: null,
                refundProcessed: false,
                notifiedAt: null,
            });
            // Fire community email alerts in the background (never blocks the class starting)
            notifyClassStart(sessionId, authHeader.slice(7)).catch(() => {});
            return NextResponse.json({ success: true, action, startedAt: session.startedAt || now });
        }

        if (action === 'pause') {
            if (!session.isActive) return NextResponse.json({ error: 'Only a live class can be paused' }, { status: 409 });
            await sessionRef.update({ isActive: false, status: 'paused', pausedAt: now });
            return NextResponse.json({ success: true, action });
        }

        if (action === 'archive') {
            await sessionRef.update({ isActive: false, status: 'deleted', isDeleted: true, deletedAt: now });
            return NextResponse.json({ success: true, action });
        }

        if (session.status === 'deleted') {
            return NextResponse.json({ success: true, action, refunded: 0, alreadyEnded: true });
        }
        if (session.status !== 'ended') {
            await sessionRef.update({ isActive: false, status: 'ended', endedAt: now });
        }
        // Session ended — allow future alerts (live + scheduled) if it is ever restarted
        try { await sessionRef.update({ notifiedAt: null, scheduledNotifiedAt: null } as any); } catch {}
        const refunded = session.refundProcessed === true ? 0 : await refundSession(sessionId);

        // End the media room server-side so every participant is disconnected even
        // when the lecturer closes the class from the dashboard or admin panel.
        try {
            const livekitUrl = process.env.LIVEKIT_API_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace('wss://', 'https://').replace('ws://', 'http://');
            if (livekitUrl && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
                const roomService = new RoomServiceClient(livekitUrl, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
                await roomService.deleteRoom(`podium_${sessionId}`);
            }
        } catch (roomError) {
            console.error('[Session Lifecycle] Failed to close LiveKit room:', roomError);
        }
        return NextResponse.json({ success: true, action, refunded });
    } catch (error: any) {
        console.error('[Session Lifecycle]', error);
        return NextResponse.json({ error: error.message || 'Session lifecycle operation failed' }, { status: 500 });
    }
}
