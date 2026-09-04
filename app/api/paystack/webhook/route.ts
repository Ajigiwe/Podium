import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * Paystack Webhook Handler
 * Handles:
 *  - wallet_topup: credits student's virtual wallet
 *  - charge.success (legacy): records transaction + subscription activation
 *  - charge.failed: logs failed attempt
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.text();
        const signature = req.headers.get('x-paystack-signature');

        if (!signature) {
            return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
        }

        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) {
            console.error('Paystack secret key not configured');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const hash = crypto
            .createHmac('sha512', secretKey)
            .update(body)
            .digest('hex');

        if (hash !== signature) {
            console.error('Invalid webhook signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        const event = JSON.parse(body);

        if (event.event === 'charge.success') {
            const { reference, amount, channel, metadata } = event.data;

            if (!reference || typeof reference !== 'string' || !reference.trim()) {
                console.warn('Rejecting charge.success webhook: invalid reference', { event: event.event });
                return NextResponse.json({ received: true, rejected: 'invalid reference' }, { status: 200 });
            }
            if (!metadata?.userId || typeof metadata.userId !== 'string' || !metadata.userId.trim()) {
                console.warn('Rejecting charge.success webhook: invalid userId', { reference, userId: metadata?.userId });
                return NextResponse.json({ received: true, rejected: 'invalid userId' }, { status: 200 });
            }

            console.log('Payment successful:', {
                reference,
                amount,
                userId: metadata.userId,
                sessionId: metadata.sessionId,
                type: metadata.type,
            });

            // Deduplicate transaction writes so replayed payment confirmations
            // cannot create duplicate transaction rows.
            const existingTransactionRef = adminDb.collection('transaction_credits').doc(reference);
            const existingTransaction = await existingTransactionRef.get();
            if (existingTransaction.exists) {
                console.log('Duplicate charge.success webhook skipped:', { reference, userId: metadata.userId });
                return NextResponse.json({ received: true, skipped_duplicate: true }, { status: 200 });
            }

            await adminDb.runTransaction(async (transaction) => {
                const txRef = adminDb.collection('transactions').doc();
                transaction.set(txRef, {
                    userId: metadata.userId,
                    sessionId: metadata.sessionId || 'wallet_topup',
                    paystackReference: reference,
                    amount,
                    currency: 'GHS',
                    paymentChannel: channel || 'unknown',
                    status: 'succeeded',
                    createdAt: Timestamp.now(),
                    paidAt: Timestamp.now(),
                });
                transaction.set(existingTransactionRef, {
                    userId: metadata.userId,
                    reference,
                    status: 'succeeded',
                    createdAt: Timestamp.now(),
                });
            });

            // === WALLET TOP-UP ===
            if (metadata.type === 'wallet_topup' || metadata.type === 'top_up') {
                const topUpAmount = metadata.topUpAmount || amount;
                const userRef = adminDb.collection('profiles').doc(metadata.userId);
                const userSnap = await userRef.get();
                const currentBalance = userSnap.data()?.walletBalance || 0;

                const existingTopupRef = adminDb.collection('topup_credits').doc(reference);
                const existingTopup = await existingTopupRef.get();
                if (existingTopup.exists) {
                    console.log('Duplicate wallet topup webhook skipped:', { reference, userId: metadata.userId });
                    return NextResponse.json({ received: true, skipped_duplicate: true }, { status: 200 });
                }

                await adminDb.runTransaction(async (transaction) => {
                    const userDoc = await transaction.get(userRef);
                    const balanceAtStart = userDoc.data()?.walletBalance || 0;
                    transaction.update(userRef, {
                        walletBalance: balanceAtStart + topUpAmount,
                        updatedAt: Timestamp.now(),
                    });
                    transaction.set(existingTopupRef, {
                        userId: metadata.userId,
                        reference,
                        amount: topUpAmount,
                        channel: channel || 'unknown',
                        status: 'succeeded',
                        createdAt: Timestamp.now(),
                    });
                });

                console.log('Wallet credited:', {
                    userId: metadata.userId,
                    topUpAmount,
                    newBalance: currentBalance + topUpAmount,
                    reference,
                });
            }

            // === LEGACY SUBSCRIPTION (backward compat) ===
            if (metadata.type === 'subscription') {
                console.log('Activating subscription for user:', metadata.userId);
                try {
                    const now = new Date();
                    const expiryDate = new Date(now);
                    expiryDate.setMonth(now.getMonth() + 4);

                    await adminDb.collection('profiles').doc(metadata.userId).update({
                        subscriptionStatus: 'active',
                        subscriptionExpiresAt: Timestamp.fromDate(expiryDate),
                        updatedAt: Timestamp.now()
                    });
                    console.log('Subscription activated until:', expiryDate);
                } catch (subError) {
                    console.error('Error activating subscription:', subError);
                }
            }
        }

        // Handle charge.failed
        if (event.event === 'charge.failed') {
            const { reference, channel, metadata } = event.data;

            if (!reference || typeof reference !== 'string' || !reference.trim()) {
                console.warn('Rejecting charge.failed webhook: invalid reference', { event: event.event });
                return NextResponse.json({ received: true, rejected: 'invalid reference' }, { status: 200 });
            }
            if (!metadata?.userId || typeof metadata.userId !== 'string' || !metadata.userId.trim()) {
                console.warn('Rejecting charge.failed webhook: invalid userId', { reference, userId: metadata?.userId });
                return NextResponse.json({ received: true, rejected: 'invalid userId' }, { status: 200 });
            }

            console.log('Payment failed:', { reference, userId: metadata.userId });

            const existingFailedRef = adminDb.collection('transaction_credits').doc(reference);
            const existingFailed = await existingFailedRef.get();
            if (existingFailed.exists) {
                console.log('Duplicate charge.failed webhook skipped:', { reference, userId: metadata.userId });
                return NextResponse.json({ received: true, skipped_duplicate: true }, { status: 200 });
            }

            await adminDb.collection('transactions').add({
                userId: metadata.userId,
                sessionId: metadata.sessionId || 'wallet_topup',
                paystackReference: reference,
                amount: 0,
                currency: 'GHS',
                paymentChannel: channel || 'unknown',
                status: 'failed',
                createdAt: Timestamp.now(),
                paidAt: null,
            });

            await adminDb.collection('transaction_credits').doc(reference).set({
                userId: metadata.userId,
                reference,
                status: 'failed',
                createdAt: Timestamp.now(),
            });
        }

        return NextResponse.json({ received: true }, { status: 200 });
    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
