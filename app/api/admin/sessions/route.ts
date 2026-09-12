import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const MIN_REFUND_MINUTES = 30;

function tsMillis(value: any): number | null {
    if (!value) return null;
    if (typeof value.toMillis === 'function') {
        try { return value.toMillis(); } catch { /* fallthrough */ }
    }
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * GET /api/admin/sessions?filter=all|active|ended
 *
 * Admin-only sessions list for the control panel. Reads happen through the
 * Admin SDK because the client-side security rules cannot prove list access
 * for session queries whose groupId is unconstrained, which made the Sessions
 * tab fail with permission-denied. Durations are computed server-side so the
 * UI can badge classes that ran under the 30-minute refund threshold.
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
        const caller = await adminDb.collection('profiles').doc(decoded.uid).get();
        if (!caller.exists || caller.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
        }

        const filter = req.nextUrl.searchParams.get('filter') || 'all';
        let snap;
        if (filter === 'active') {
            snap = await adminDb.collection('sessions').where('isActive', '==', true).limit(100).get();
        } else if (filter === 'ended') {
            // Deliberately no where('status') + orderBy composite (index-free):
            // take recent sessions and filter ended ones in code.
            const recent = await adminDb.collection('sessions').orderBy('createdAt', 'desc').limit(200).get();
            const endedDocs = recent.docs.filter((d) => (d.data()?.status) === 'ended').slice(0, 50);
            snap = { docs: endedDocs, empty: endedDocs.length === 0, size: endedDocs.length };
        } else {
            snap = await adminDb.collection('sessions').orderBy('createdAt', 'desc').limit(50).get();
        }

        const sessions = snap.docs.map((d) => {
            const s: any = d.data() || {};
            const startedMillis = tsMillis(s.startedAt) ?? tsMillis(s.createdAt);
            const endedMillis = tsMillis(s.endedAt) ?? (s.isActive === true ? Date.now() : null);
            const durationMinutes = startedMillis && endedMillis
                ? Math.max(0, Math.round((endedMillis - startedMillis) / 60000))
                : null;
            return {
                id: d.id,
                title: s.title || 'Untitled class',
                lecturerName: s.lecturerName || null,
                lecturerId: s.lecturerId || s.hostId || null,
                isActive: s.isActive === true,
                status: s.status || (s.isActive ? 'active' : 'unknown'),
                isDeleted: s.isDeleted === true,
                participantCount: Number(s.participantCount) || 0,
                refundProcessed: s.refundProcessed === true,
                createdAt: tsMillis(s.createdAt) ? new Date(tsMillis(s.createdAt) as number).toISOString() : null,
                startedAt: tsMillis(s.startedAt) ? new Date(tsMillis(s.startedAt) as number).toISOString() : null,
                endedAt: tsMillis(s.endedAt) ? new Date(tsMillis(s.endedAt) as number).toISOString() : null,
                durationMinutes,
                metThreshold: durationMinutes !== null && durationMinutes >= MIN_REFUND_MINUTES,
            };
        });

        return NextResponse.json({ sessions });
    } catch (error: any) {
        console.error('[Admin Sessions List]', error);
        return NextResponse.json({ error: error.message || 'Failed to list sessions' }, { status: 500 });
    }
}
