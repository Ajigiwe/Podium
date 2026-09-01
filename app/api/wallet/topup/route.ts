import { NextRequest, NextResponse } from 'next/server';
import { initializeTransaction } from '@/lib/paystack/initialize';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * API endpoint to initialize a wallet top-up via Paystack.
 * Student specifies an amount, gets redirected to Paystack checkout.
 * On success, the webhook credits their walletBalance.
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const { amount } = await req.json(); // amount in pesewas

        if (!amount || amount < 100) {
            return NextResponse.json({ error: 'Minimum top-up is GHS 1' }, { status: 400 });
        }

        // Get user profile for email
        const userDoc = await adminDb.collection('profiles').doc(userId).get();
        const user = userDoc.data();

        let email = user?.email || decodedToken.email;
        if (!email) {
            const authUser = await adminAuth.getUser(userId);
            email = authUser.email;
        }
        if (!email) {
            return NextResponse.json({ error: 'User email not found' }, { status: 400 });
        }

        // Initialize Paystack transaction
        const paystackResponse = await initializeTransaction({
            email: user.email,
            amount,
            userId,
            sessionId: 'wallet_topup',
            sessionTitle: 'Wallet Top-Up',
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard.html?topup=success`,
            customMetadata: {
                type: 'wallet_topup',
                topUpAmount: amount,
            },
        });

        return NextResponse.json({
            authorizationUrl: paystackResponse.data.authorization_url,
            reference: paystackResponse.data.reference,
        });
    } catch (error: any) {
        console.error('Wallet top-up error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to initialize top-up' },
            { status: 500 }
        );
    }
}
