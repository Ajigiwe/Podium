import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { notifyCommunityClass, ClassAlertKind } from '@/lib/notifications/class-alerts';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));

        const body = await request.json().catch(() => ({})) as { sessionId?: string; kind?: string };
        const { sessionId } = body;
        if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
            return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }
        const kind: ClassAlertKind = body.kind === 'scheduled' ? 'scheduled' : 'live';

        const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get();
        if (!sessionSnap.exists) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        const session = sessionSnap.data() || {};

        // Only the host/lecturer (or an admin) can fire the alert
        const callerSnap = await adminDb.collection('profiles').doc(decoded.uid).get();
        const callerRole = callerSnap.data()?.role;
        const isHost = session.hostId === decoded.uid || session.lecturerId === decoded.uid;
        if (!isHost && callerRole !== 'admin') {
            return NextResponse.json({ error: 'Only the class lecturer can send alerts' }, { status: 403 });
        }
        // 'live' alerts require an active class; 'scheduled' alerts require it NOT to be live
        if (kind === 'live' && session.isActive !== true) {
            return NextResponse.json({ error: 'Class is not live' }, { status: 409 });
        }
        if (kind === 'scheduled' && session.isActive === true) {
            return NextResponse.json({ error: 'Class is already live' }, { status: 409 });
        }

        const result = await notifyCommunityClass({ sessionId, kind });
        return NextResponse.json({ success: true, kind, ...result });
    } catch (error: any) {
        console.error('[ClassStartNotify] failed:', error);
        return NextResponse.json({ error: error.message || 'Notification failed' }, { status: 500 });
    }
}
