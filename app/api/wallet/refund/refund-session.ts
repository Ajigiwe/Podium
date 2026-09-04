import { adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * Refunds all paid students for a single session. Each student is refunded
 * the exact amount they paid if their join (transaction createdAt) to the
 * session end (endedAt, or now if missing) was under 30 minutes.
 */
export async function refundSession(sessionId: string): Promise<number> {
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
