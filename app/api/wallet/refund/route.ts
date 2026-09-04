import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { refundSession } from './refund-session';

// TODO: remove duplicate import once repository history is reconciled

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/refund
 * Body: { sessionId: string }
 *
 * Refunds every student who was charged for a session if that student's
 * join-time-to-session-end was under 30 minutes. The money is deducted at
 * join time (per student, via /api/wallet/deduct), so the refund is computed
 * per transaction using the transaction's createdAt as the join time and the
 * session's endedAt as the end time. No reliance on a session-level startedAt.
 *
 * Callable by a session host / admin, or via cron with x-cron-secret.
 */
export async function POST(req: NextRequest) {
    try {
        // Allow cron secret
        const cronSecret = req.headers.get('x-cron-secret');
        let isAdmin = false;
        let callerId: string | null = null;

        if (cronSecret && cronSecret === process.env.CRON_SECRET) {
            isAdmin = true;
        } else {
            const authHeader = req.headers.get('authorization');
            if (!authHeader?.startsWith('Bearer ')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
            callerId = decoded.uid;
            const { sessionId: sid } = await req.clone().json().catch(() => ({ sessionId: null }));
            const profile = await adminDb.collection('profiles').doc(callerId).get();
            if (profile.data()?.role === 'admin') isAdmin = true;
            else if (sid) {
                const sess = await adminDb.collection('sessions').doc(sid).get();
                if (sess.exists && (sess.data()?.hostId === callerId || sess.data()?.lecturerId === callerId)) isAdmin = true;
            }
            if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { sessionId } = await req.json().catch(() => ({ sessionId: null }));

        // Batch mode (no sessionId): process sessions that ended but weren't refunded
        if (!sessionId) {
            const toRefund = await adminDb.collection('sessions')
                .where('refundProcessed', '==', false)
                .limit(20)
                .get();
            let refundedCount = 0;
            for (const doc of toRefund.docs) {
                await refundSession(doc.id);
                refundedCount++;
            }
            return NextResponse.json({ success: true, batch: true, refundedCount });
        }

        const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get();
        if (!sessionSnap.exists) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        const count = await refundSession(sessionId);
        return NextResponse.json({ success: true, refunded: count, sessionId });
    } catch (e: any) {
        console.error('[Refund]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
