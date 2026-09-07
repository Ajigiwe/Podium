import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/ensure-profile
 * Auth: Bearer ID token
 *
 * Idempotently creates the user's profile document (via the Admin SDK, which
 * bypasses the client-side rules that block profile writes touching wallet
 * fields). Some accounts — notably static-site Google signups — were created
 * without a profiles/{uid} doc, which silently breaks wallet credits.
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(idToken);
        const uid = decoded.uid;

        const profileRef = adminDb.collection('profiles').doc(uid);
        const snap = await profileRef.get();

        if (!snap.exists) {
            const email = decoded.email || null;
            await profileRef.set({
                id: uid,
                email,
                fullName: email ? email.split('@')[0] : 'User',
                role: 'student',
                walletBalance: 0,
                walletCurrency: 'GHS',
                walletUpdatedAt: Timestamp.now(),
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            return NextResponse.json({ success: true, created: true });
        }

        return NextResponse.json({ success: true, created: false });
    } catch (error: any) {
        console.error('[EnsureProfile] error', error);
        return NextResponse.json({ error: error.message || 'Failed to ensure profile' }, { status: 500 });
    }
}