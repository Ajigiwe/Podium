import { NextRequest, NextResponse } from 'next/server';
import { initializeTransaction } from '@/lib/paystack/initialize';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * API endpoint to initialize a Paystack payment
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
        const { sessionId, callbackUrl } = await req.json();

        if (!sessionId) {
            return NextResponse.json(
                { error: 'Session ID is required' },
                { status: 400 }
            );
        }

        // Get session details
        const sessionDoc = await adminDb.collection('sessions').doc(sessionId).get();

        if (!sessionDoc.exists) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        const session = sessionDoc.data();

        // Check if session data exists
        if (!session) {
            return NextResponse.json(
                { error: 'Session data not found' },
                { status: 404 }
            );
        }

        // Check if session is free
        if (session.isFree) {
            return NextResponse.json(
                { error: 'This session is free, no payment required' },
                { status: 400 }
            );
        }

        // Get user profile for email
        const userDoc = await adminDb.collection('profiles').doc(userId).get();
        const user = userDoc.data();

        if (!user?.email) {
            return NextResponse.json(
                { error: 'User email not found' },
                { status: 400 }
            );
        }

        // Initialize Paystack transaction
        const paystackResponse = await initializeTransaction({
            email: user.email,
            amount: session.price, // Already in pesewas
            userId,
            sessionId,
            sessionTitle: session.title,
            callbackUrl,
        });

        return NextResponse.json({
            authorizationUrl: paystackResponse.data.authorization_url,
            reference: paystackResponse.data.reference,
        });
    } catch (error: any) {
        console.error('Payment initialization error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to initialize payment' },
            { status: 500 }
        );
    }
}
