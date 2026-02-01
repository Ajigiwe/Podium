import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendPaymentConfirmation } from '@/lib/email/send';

/**
 * Paystack Webhook Handler
 * CRITICAL: This endpoint verifies payment completion and grants classroom access
 */
export async function POST(req: NextRequest) {
    try {
        // Get the raw body for signature verification
        const body = await req.text();
        const signature = req.headers.get('x-paystack-signature');

        if (!signature) {
            return NextResponse.json(
                { error: 'No signature provided' },
                { status: 400 }
            );
        }

        // Verify webhook signature
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
            .update(body)
            .digest('hex');

        if (hash !== signature) {
            console.error('Invalid webhook signature');
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 400 }
            );
        }

        // Parse the event
        const event = JSON.parse(body);

        // Handle charge.success event
        if (event.event === 'charge.success') {
            const { reference, amount, customer, channel, metadata } = event.data;

            console.log('Payment successful:', {
                reference,
                amount,
                userId: metadata.userId,
                sessionId: metadata.sessionId,
            });

            // Create transaction record in Firestore
            await adminDb.collection('transactions').add({
                userId: metadata.userId,
                sessionId: metadata.sessionId,
                paystackReference: reference,
                amount: amount, // Amount in pesewas
                currency: 'GHS',
                paymentChannel: channel, // e.g., "mobile_money_mtn"
                status: 'succeeded',
                createdAt: Timestamp.now(),
                paidAt: Timestamp.now(),
            });

            console.log('Transaction record created successfully');

            // Send payment confirmation email
            try {
                // Fetch user profile
                const userDoc = await adminDb.collection('profiles').doc(metadata.userId).get();
                const userData = userDoc.data();

                // Fetch session details
                const sessionDoc = await adminDb.collection('sessions').doc(metadata.sessionId).get();
                const sessionData = sessionDoc.data();

                if (userData?.email && sessionData?.title) {
                    await sendPaymentConfirmation({
                        to: userData.email,
                        userName: userData.fullName || 'Student',
                        sessionTitle: sessionData.title,
                        amount: amount,
                        currency: 'GHS',
                        transactionId: reference,
                        sessionId: metadata.sessionId,
                    });
                    console.log('Payment confirmation email sent to:', userData.email);
                }
            } catch (emailError) {
                // Don't fail the webhook if email fails
                console.error('Failed to send confirmation email:', emailError);
            }
        }

        // Handle charge.failed event
        if (event.event === 'charge.failed') {
            const { reference, metadata } = event.data;

            console.log('Payment failed:', {
                reference,
                userId: metadata?.userId,
                sessionId: metadata?.sessionId,
            });

            // Optionally log failed payment attempts
            await adminDb.collection('transactions').add({
                userId: metadata?.userId || 'unknown',
                sessionId: metadata?.sessionId || 'unknown',
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
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
