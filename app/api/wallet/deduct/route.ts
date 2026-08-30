import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/deduct
 * Body: { sessionId: string, checkOnly?: boolean }
 * - checkOnly true: just checks if can join (no deduction)
 * - otherwise: deducts atomically if not already paid, idempotent rejoin.
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(idToken);
        const userId = decoded.uid;

        const body = await req.json();
        const { sessionId, checkOnly } = body;
        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        const sessionRef = adminDb.collection('sessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }
        const session: any = sessionSnap.data();
        const price: number = session.price ?? 0;
        const isFree: boolean = session.isFree === true || price === 0;

        // Moderator bypass
        const profileSnap = await adminDb.collection('profiles').doc(userId).get();
        const profile: any = profileSnap.data();
        const isModerator = session.hostId === userId || session.lecturerId === userId || profile?.role === 'lecturer' || profile?.role === 'admin';
        if (isModerator) {
            // Check co-host
            let coHost = false;
            try {
                const ch = await adminDb.collection('sessions').doc(sessionId).collection('co_hosts').doc(userId).get();
                coHost = ch.exists && ch.data()?.isActive === true;
            } catch {}
            if (coHost || isModerator) {
                return NextResponse.json({ success: true, free: true, moderator: true, alreadyPaid: false });
            }
        }

        // Group community free check
        if (session.groupId) {
            try {
                const groupSnap = await adminDb.collection('groups').doc(session.groupId).get();
                if (groupSnap.exists && groupSnap.data()?.isFreeSessions === true) {
                    return NextResponse.json({ success: true, free: true, communityFree: true });
                }
            } catch {}
        }

        if (isFree) {
            return NextResponse.json({ success: true, free: true, price: 0 });
        }

        // Wallet gate flag
        try {
            const walletSettings = await adminDb.collection('system_settings').doc('wallet').get();
            if (walletSettings.exists && walletSettings.data()?.isWalletPayToUse === false) {
                return NextResponse.json({ success: true, free: true, walletDisabled: true });
            }
        } catch {}

        // Check already paid (idempotent) — ignore enrollment markers (amount 0)
        const paidQuery = await adminDb.collection('transactions')
            .where('userId', '==', userId)
            .where('sessionId', '==', sessionId)
            .where('status', '==', 'succeeded')
            .where('type', '==', 'session_payment')
            .get();
        const hasRealPayment = paidQuery.docs.some(d => (d.data().amount || 0) > 0);
        if (hasRealPayment) {
            return NextResponse.json({ success: true, alreadyPaid: true, price });
        }
        // Also check legacy transactions without type but succeeded (backward compat) — only if amount >0
        const legacyPaid = await adminDb.collection('transactions')
            .where('userId', '==', userId)
            .where('sessionId', '==', sessionId)
            .where('status', '==', 'succeeded')
            .get();
        if (!hasRealPayment && !legacyPaid.empty) {
            const hasLegacy = legacyPaid.docs.some(d => {
                const t:any=d.data();
                return (!t.type || t.type === 'session_payment') && (t.amount||0) > 0;
            });
            if (hasLegacy) {
                return NextResponse.json({ success: true, alreadyPaid: true, price, legacy: true });
            }
        }

        if (checkOnly) {
            const balance = profile?.walletBalance ?? 0;
            if (balance < price) {
                return NextResponse.json({ success: false, insufficient: true, price, balance, required: price - balance }, { status: 402 });
            }
            return NextResponse.json({ success: true, canAfford: true, price, balance });
        }

        // Deduct atomically via transaction
        const walletBalance = profile?.walletBalance ?? 0;
        if (walletBalance < price) {
            return NextResponse.json({ error: 'Insufficient wallet balance', price, balance: walletBalance, required: price - walletBalance }, { status: 402 });
        }

        // Use Firestore transaction
        try {
            await adminDb.runTransaction(async (tx) => {
                const pRef = adminDb.collection('profiles').doc(userId);
                const pSnap = await tx.get(pRef);
                const currentBal = pSnap.data()?.walletBalance ?? 0;
                if (currentBal < price) {
                    throw new Error('INSUFFICIENT_FUNDS');
                }
                // Double-check paid inside tx via read (query not allowed in tx, so check via get of known doc not possible)
                // We'll rely on outer check + create idempotent reference; duplicate will be caught by paystackReference uniqueness via post-check
                tx.update(pRef, {
                    walletBalance: currentBal - price,
                    walletUpdatedAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
            });
        } catch (e: any) {
            if (e.message === 'INSUFFICIENT_FUNDS') {
                return NextResponse.json({ error: 'Insufficient wallet balance', price }, { status: 402 });
            }
            throw e;
        }

        // Create transaction after successful balance update (outside tx to allow query dedup)
        const ref = `wallet_${sessionId}_${userId}_${Date.now()}`;
        // Final dedup check before create — ignore amount 0 markers
        const dedup = await adminDb.collection('transactions')
            .where('userId', '==', userId)
            .where('sessionId', '==', sessionId)
            .where('type', '==', 'session_payment')
            .where('status', '==', 'succeeded')
            .get();
        const hasDedupReal = dedup.docs.some(d => (d.data().amount||0)>0);
        if (hasDedupReal) {
            // Already paid concurrently — refund the deduction
            await adminDb.collection('profiles').doc(userId).update({
                walletBalance: FieldValue.increment(price),
                walletUpdatedAt: Timestamp.now(),
            });
            return NextResponse.json({ success: true, alreadyPaid: true, price, refunded: true });
        }

        await adminDb.collection('transactions').add({
            userId,
            sessionId,
            paystackReference: ref,
            amount: price,
            currency: 'GHS',
            paymentChannel: 'wallet',
            status: 'succeeded',
            type: 'session_payment',
            createdAt: Timestamp.now(),
            paidAt: Timestamp.now(),
            isHidden: false,
        });

        const updatedProfile = await adminDb.collection('profiles').doc(userId).get();
        return NextResponse.json({ success: true, deducted: true, price, balance: updatedProfile.data()?.walletBalance ?? 0, reference: ref });
    } catch (error: any) {
        console.error('[Wallet Deduct] Error', error);
        if (error.message === 'INSUFFICIENT_FUNDS') {
            return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 402 });
        }
        return NextResponse.json({ error: error.message || 'Failed to deduct' }, { status: 500 });
    }
}
