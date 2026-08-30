import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { initializeTransaction } from '@/lib/paystack/initialize';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/topup/initialize
 * Body: { amount: number (pesewas), callbackUrl?: string }
 * Creates Paystack transaction for wallet top-up.
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
        const { amount, callbackUrl } = body;

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return NextResponse.json({ error: 'Valid amount (pesewas) required' }, { status: 400 });
        }

        // Fetch wallet settings for minTopUpAmount
        let minTopUp = 500; // GHS 5 default
        try {
            const walletDoc = await adminDb.collection('system_settings').doc('wallet').get();
            if (walletDoc.exists) {
                minTopUp = walletDoc.data()?.minTopUpAmount ?? 500;
            }
        } catch {}
        if (amount < minTopUp) {
            return NextResponse.json({ error: `Minimum top-up is GHS ${(minTopUp / 100).toFixed(2)}` }, { status: 400 });
        }
        if (amount > 1000000) { // GHS 10,000 cap
            return NextResponse.json({ error: 'Maximum top-up exceeded' }, { status: 400 });
        }

        const userDoc = await adminDb.collection('profiles').doc(userId).get();
        const userData = userDoc.data();
        const email = userData?.email || decoded.email;
        if (!email) {
            return NextResponse.json({ error: 'User email not found' }, { status: 400 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        // Support both Next (/dashboard) and legacy static (/dashboard.html, /wallet.html)
        let cb = callbackUrl;
        if (!cb) {
            // Choose a callback that works for both: wallet.html is public static, dashboard is Next
            // Default to public wallet page so legacy dashboard users land correctly and verify still works everywhere
            cb = `${appUrl}/wallet.html?topup=success`;
        }

        const paystackResponse = await initializeTransaction({
            email,
            amount,
            userId,
            sessionId: 'wallet_topup',
            sessionTitle: 'Wallet Top-up',
            callbackUrl: cb,
            customMetadata: { type: 'top_up' },
        });

        return NextResponse.json({
            authorizationUrl: paystackResponse.data.authorization_url,
            reference: paystackResponse.data.reference,
            accessCode: paystackResponse.data.access_code,
        });
    } catch (error: any) {
        console.error('[Wallet Topup Init] Error', error);
        return NextResponse.json({ error: error.message || 'Failed to initialize top-up' }, { status: 500 });
    }
}
