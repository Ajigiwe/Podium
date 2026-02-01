import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/paystack/initialize';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Verify Paystack payment via API
 * This is a fallback if the webhook fails or is delayed
 */
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const reference = searchParams.get('reference');

    if (!reference) {
        return NextResponse.json(
            { error: 'Transaction reference is required' },
            { status: 400 }
        );
    }

    try {
        // 1. Verify with Paystack
        const response = await verifyTransaction(reference);

        if (!response.status || response.data.status !== 'success') {
            return NextResponse.json(
                { error: 'Transaction verification failed or payment not successful' },
                { status: 400 }
            );
        }

        const { amount, metadata, channel } = response.data;

        // 2. Check if transaction already exists in Firestore to avoid duplicates
        const existingTxDocs = await adminDb
            .collection('transactions')
            .where('paystackReference', '==', reference)
            .get();

        if (!existingTxDocs.empty) {
            return NextResponse.json({
                success: true,
                message: 'Transaction already recorded',
                data: existingTxDocs.docs[0].data()
            });
        }

        // 3. Create transaction record if it doesn't exist
        const transactionData = {
            userId: metadata.userId || 'unknown',
            sessionId: metadata.sessionId || 'unknown',
            paystackReference: reference,
            amount: amount, // Amount in pesewas
            currency: 'GHS',
            paymentChannel: channel,
            status: 'succeeded',
            createdAt: Timestamp.now(),
            paidAt: Timestamp.now(),
            verifiedVia: 'api_fallback' // Mark as verified via client fallback
        };

        await adminDb.collection('transactions').add(transactionData);

        return NextResponse.json({
            success: true,
            message: 'Transaction verified and recorded',
            data: transactionData
        });

    } catch (error: any) {
        console.error('Payment verification error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to verify payment' },
            { status: 500 }
        );
    }
}
