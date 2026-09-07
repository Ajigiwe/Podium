import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/paystack/initialize';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { creditWalletTopUp } from '@/lib/payments/creditWalletTopUp';

export const dynamic = 'force-dynamic';

function isWalletTopUp(metadata: any, transaction?: any) {
    return metadata?.type === 'top_up' ||
        metadata?.type === 'wallet_topup' ||
        metadata?.sessionId === 'wallet_topup' ||
        transaction?.type === 'top_up' ||
        transaction?.type === 'wallet_topup' ||
        transaction?.sessionId === 'wallet_topup';
}

async function handleVerify(reference: string) {
    if (!reference) {
        return NextResponse.json({ error: 'Transaction reference is required' }, { status: 400 });
    }

    try {
        const response = await verifyTransaction(reference);
        if (!response.status || response.data.status !== 'success') {
            return NextResponse.json(
                { error: 'Transaction verification failed or payment not successful' },
                { status: 400 }
            );
        }

        const { amount, metadata, channel, customer } = response.data;
        const existingSnap = await adminDb.collection('transactions')
            .where('paystackReference', '==', reference)
            .limit(1)
            .get();
        const existing = existingSnap.empty ? null : existingSnap.docs[0].data() as any;

        if (isWalletTopUp(metadata, existing)) {
            const userId = existing?.userId || metadata?.userId;
            const result = await creditWalletTopUp({
                userId,
                reference,
                amount: Number(amount),
                paymentChannel: channel,
                email: customer?.email,
                verifiedVia: 'api_fallback',
            });
            return NextResponse.json({
                success: true,
                message: result.credited
                    ? 'Top-up verified and wallet credited'
                    : 'Transaction already recorded',
                data: existing || {
                    userId,
                    sessionId: 'wallet_topup',
                    paystackReference: reference,
                    amount,
                    currency: 'GHS',
                    paymentChannel: channel,
                    status: 'succeeded',
                    type: 'top_up',
                },
                newBalance: result.balance,
            });
        }

        if (existing) {
            return NextResponse.json({
                success: true,
                message: 'Transaction already recorded',
                data: existing,
            });
        }

        const transactionData = {
            userId: metadata?.userId || 'unknown',
            sessionId: metadata?.sessionId || 'unknown',
            paystackReference: reference,
            amount,
            currency: 'GHS',
            paymentChannel: channel,
            status: 'succeeded',
            type: metadata?.type || 'session_payment',
            createdAt: Timestamp.now(),
            paidAt: Timestamp.now(),
            verifiedVia: 'api_fallback',
        };
        await adminDb.collection('transactions').add(transactionData);

        return NextResponse.json({
            success: true,
            message: 'Transaction verified and recorded',
            data: transactionData,
        });
    } catch (error: any) {
        console.error('Payment verification error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to verify payment' },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const reference = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('trRef');
    return handleVerify(reference || '');
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        return handleVerify(body.reference || '');
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
