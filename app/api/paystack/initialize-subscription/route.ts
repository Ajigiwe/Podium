import { NextRequest, NextResponse } from 'next/server';
import { initializeTransaction } from '@/lib/paystack/initialize';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * API endpoint to initialize a Paystack Subscription payment
 */
export async function POST(req: NextRequest) {
    try {
        // Verify user authentication
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Get request body
        const body = await req.json();
        const callbackUrl = body.callbackUrl;

        // Fetch System Settings to get current Semester Fee
        const settingsDoc = await adminDb.collection('system_settings').doc('subscription').get();
        let semesterFee = 200; // Default fallback
        let currency = 'GHS';

        if (settingsDoc.exists) {
            const data = settingsDoc.data();
            semesterFee = data?.semesterFee || 200;
            currency = data?.currency || 'GHS';
        }

        // Get user profile for email
        const userDoc = await adminDb.collection('profiles').doc(userId).get();
        const user = userDoc.data();

        let email = user?.email;
        if (!email) {
            const authUser = await adminAuth.getUser(userId);
            email = authUser.email;
        }
        if (!email) {
            return NextResponse.json(
                { error: 'User email not found' },
                { status: 400 }
            );
        }

        // Convert fee to pesewas
        const amountInPesewas = semesterFee * 100;

        // Initialize Paystack transaction
        const paystackResponse = await initializeTransaction({
            email: email,
            amount: amountInPesewas,
            userId,
            sessionId: 'subscription_payment', // Placeholder for session ID requirement
            sessionTitle: 'Semester Subscription',
            callbackUrl,
            customMetadata: {
                type: 'subscription',
                semesterFee,
                currency
            }
        });

        return NextResponse.json({
            authorizationUrl: paystackResponse.data.authorization_url,
            reference: paystackResponse.data.reference,
        });
    } catch (error: any) {
        console.error('Subscription payment initialization error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to initialize payment' },
            { status: 500 }
        );
    }
}
