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

        // Handle charge.success
        if (event.event === 'charge.success') {
            const { reference, amount, customer, channel, metadata } = event.data;

            console.log('Payment successful:', {
                reference,
                amount,
                userId: metadata.userId,
                sessionId: metadata.sessionId,
                type: metadata.type,
            });

            // Record transaction
            await adminDb.collection('transactions').add({
                userId: metadata.userId,
                sessionId: metadata.sessionId || 'wallet_topup',
                paystackReference: reference,
                amount,
                currency: 'GHS',
                paymentChannel: channel,
                status: 'succeeded',
                createdAt: Timestamp.now(),
                paidAt: Timestamp.now(),
            });

            // === WALLET TOP-UP ===
            if (metadata.type === 'wallet_topup') {
                const topUpAmount = metadata.topUpAmount || amount;
                const userRef = adminDb.collection('profiles').doc(metadata.userId);
                const userSnap = await userRef.get();
                const currentBalance = userSnap.data()?.walletBalance || 0;

                await userRef.update({
                    walletBalance: currentBalance + topUpAmount,
                    updatedAt: Timestamp.now(),
                });

                console.log('Wallet credited:', {
                    userId: metadata.userId,
                    topUpAmount,
                    newBalance: currentBalance + topUpAmount,
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
            const { reference, metadata } = event.data;
            console.log('Payment failed:', { reference, userId: metadata?.userId });

            await adminDb.collection('transactions').add({
                userId: metadata?.userId || 'unknown',
                sessionId: metadata?.sessionId || 'wallet_topup',
                paystackReference: reference,
                amount: 0,
                currency: 'GHS',
                paymentChannel: 'unknown',
                status: 'failed',
                createdAt: Timestamp.now(),
                paidAt: null,
            });
        }

        return NextResponse.json({ received: true }, { status: 200 });
    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
