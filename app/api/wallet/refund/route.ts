import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

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

/**
 * Refunds all paid students for a single session. Each student is refunded
 * the exact amount they paid if their join (transaction createdAt) to the
 * session end (endedAt, or now if missing) was under 30 minutes.
 */
async function refundSession(sessionId: string): Promise<number> {
    const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get();
    const session: any = sessionSnap.data() || {};

    // Determine the session end time (fall back to now if not set yet)
    let endTime = Date.now();
    if (session.endedAt) {
        endTime = session.endedAt.toDate ? session.endedAt.toDate().getTime() : new Date(session.endedAt).getTime();
    }

    // Collect all successful session_payment transactions for this session
    const payments = await adminDb.collection('transactions')
        .where('sessionId', '==', sessionId)
        .where('type', '==', 'session_payment')
        .where('status', '==', 'succeeded')
        .get();

    // Fallback: legacy transactions without type
    let docs = payments.docs;
    if (docs.length === 0) {
        const legacy = await adminDb.collection('transactions')
            .where('sessionId', '==', sessionId)
            .where('status', '==', 'succeeded')
            .get();
        docs = legacy.docs.filter((d: any) => !d.data().type || d.data().type === 'session_payment');
    }

    let refunded = 0;
    for (const doc of docs) {
        const data: any = doc.data();

        // Skip zero-amount markers / free enrollments — nothing to refund
        const amt = Number(data.amount) || 0;
        if (amt <= 0) continue;

        const userId = data.userId;
        if (!userId || userId === 'unknown') continue;

        // Already refunded?
        const existingRefund = await adminDb.collection('transactions')
            .where('relatedTransactionId', '==', doc.id)
            .where('type', '==', 'refund')
            .get();
        if (!existingRefund.empty) continue;

        // Join time = when the student paid/joined. Fall back to session startedAt.
        let joinTime = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().getTime() : new Date(data.createdAt).getTime()) : null;
        if (!joinTime && session.startedAt) {
            joinTime = session.startedAt.toDate ? session.startedAt.toDate().getTime() : new Date(session.startedAt).getTime();
        }
        if (!joinTime) continue; // Cannot determine how long they were in

        const mins = (endTime - joinTime) / 60000;
        if (mins >= 30) continue; // They were in long enough — no refund

        // Refund the exact amount this student paid
        await adminDb.collection('profiles').doc(userId).update({
            walletBalance: FieldValue.increment(amt),
            walletUpdatedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        await adminDb.collection('transactions').add({
            userId,
            sessionId,
            paystackReference: `refund_${doc.id}_${Date.now()}`,
            amount: amt,
            currency: 'GHS',
            paymentChannel: 'wallet',
            status: 'succeeded',
            type: 'refund',
            relatedTransactionId: doc.id,
            createdAt: Timestamp.now(),
            paidAt: Timestamp.now(),
        });
        refunded++;
    }

    await adminDb.collection('sessions').doc(sessionId).update({ refundProcessed: true });
    return refunded;
}
