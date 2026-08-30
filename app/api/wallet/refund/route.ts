import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/refund
 * Body: { sessionId: string }
 * Admin or session host can trigger. Checks if session lasted <30m and not yet refunded, then refunds all session_payment to wallets.
 * Also callable via cron with CRON_SECRET.
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
            const profile = await adminDb.collection('profiles').doc(callerId).get();
            if (profile.data()?.role === 'admin') isAdmin = true;
            else {
                // check if host of session
                const { sessionId } = await req.clone().json().catch(() => ({ sessionId: null }));
                if (sessionId) {
                    const sess = await adminDb.collection('sessions').doc(sessionId).get();
                    if (sess.exists && (sess.data()?.hostId === callerId || sess.data()?.lecturerId === callerId)) isAdmin = true;
                }
                if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const { sessionId, forceParentBody } = await req.json().catch(() => ({ sessionId: null }));
        // If cron called without body, batch all short sessions
        if (!sessionId) {
            // Batch mode: find sessions ended <30m not refunded
            const toRefund = await adminDb.collection('sessions').where('refundProcessed', '==', false).limit(20).get();
            let refundedCount = 0;
            for (const doc of toRefund.docs) {
                const s: any = doc.data();
                if (!s.startedAt || !s.endedAt) continue;
                const start = s.startedAt.toDate ? s.startedAt.toDate() : new Date(s.startedAt);
                const end = s.endedAt.toDate ? s.endedAt.toDate() : new Date(s.endedAt);
                const mins = (end.getTime() - start.getTime()) / 60000;
                if (mins < 30) {
                    await refundSession(doc.id, s.price);
                    refundedCount++;
                } else {
                    await doc.ref.update({ refundProcessed: true });
                }
            }
            return NextResponse.json({ success: true, batch: true, refundedCount });
        }

        const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get();
        if (!sessionSnap.exists) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        const session: any = sessionSnap.data();
        if (session.refundProcessed) {
            return NextResponse.json({ success: true, message: 'Already refunded/processed' });
        }
        if (!session.startedAt || !session.endedAt) {
            return NextResponse.json({ error: 'Session duration not available' }, { status: 400 });
        }
        const start = session.startedAt.toDate ? session.startedAt.toDate() : new Date(session.startedAt);
        const end = session.endedAt.toDate ? session.endedAt.toDate() : new Date(session.endedAt);
        const mins = (end.getTime() - start.getTime()) / 60000;
        if (mins >= 30 && !isAdmin) {
            return NextResponse.json({ error: `Session lasted ${mins.toFixed(1)}m, no refund needed` }, { status: 400 });
        }
        if (mins < 30) {
            const count = await refundSession(sessionId, session.price);
            return NextResponse.json({ success: true, refunded: count, durationMinutes: mins });
        }
        await adminDb.collection('sessions').doc(sessionId).update({ refundProcessed: true });
        return NextResponse.json({ success: true, message: 'Session lasted >=30m, marked processed' });
    } catch (e: any) {
        console.error('[Refund]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

async function refundSession(sessionId: string, price: number) {
    const payments = await adminDb.collection('transactions')
        .where('sessionId', '==', sessionId)
        .where('type', '==', 'session_payment')
        .where('status', '==', 'succeeded')
        .get();
    // Fallback legacy without type
    let docs = payments.docs;
    if (docs.length === 0) {
        const legacy = await adminDb.collection('transactions')
            .where('sessionId', '==', sessionId)
            .where('status', '==', 'succeeded')
            .get();
        docs = legacy.docs.filter((d: any) => !d.data().type || d.data().type === 'session_payment');
        price = price || docs[0]?.data()?.amount || 0;
    }
    let count = 0;
    for (const doc of docs) {
        const data: any = doc.data();
        // Check if already refunded
        const existingRefund = await adminDb.collection('transactions')
            .where('relatedTransactionId', '==', doc.id)
            .where('type', '==', 'refund')
            .get();
        if (!existingRefund.empty) continue;
        const userId = data.userId;
        const amt = data.amount || price;
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
        count++;
    }
    await adminDb.collection('sessions').doc(sessionId).update({ refundProcessed: true });
    return count;
}
