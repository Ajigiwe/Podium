import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * Admin-only: recompute a user's walletBalance from their succeeded
 * transactions (mirrors app/api/wallet/reconcile/route.ts so a page-load
 * reconcile can never disagree). Also creates the profile doc when the
 * account has wallet movements but never got one (legacy static-site
 * signups).
 */
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
        const caller = await adminDb.collection('profiles').doc(decoded.uid).get();
        if (!caller.exists || caller.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
        }

        const { userId } = await req.json();
        if (!userId || typeof userId !== 'string' || !userId.trim()) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const snap = await adminDb.collection('transactions')
            .where('userId', '==', userId)
            .where('status', '==', 'succeeded')
            .get();

        let correct = 0;
        let movements = 0;
        snap.forEach((d) => {
            const t: any = d.data();
            const amt = Number(t.amount) || 0;
            if (t.type === 'top_up' || t.type === 'wallet_topup') { correct += amt; movements++; }
            else if (t.type === 'refund') { correct += amt; movements++; }
            else if (t.type === 'session_payment') { correct -= amt; movements++; }
            else if (!t.type && t.sessionId === 'wallet_topup' && amt > 0) { correct += amt; movements++; }
        });
        if (correct < 0) correct = 0;

        const profileRef = adminDb.collection('profiles').doc(userId);
        const prof = await profileRef.get();
        const exists = prof.exists;
        const previous = exists ? Number(prof.data()?.walletBalance) || 0 : null;

        if (exists && previous === correct) {
            return NextResponse.json({
                success: true,
                changed: false,
                previous,
                newBalance: correct,
                count: snap.size,
                movements,
                message: 'Balance already correct',
            });
        }

        if (!exists && correct === 0) {
            // No wallet movement ever landed — don't manufacture an empty profile.
            return NextResponse.json({
                success: true,
                changed: false,
                previous: null,
                newBalance: 0,
                count: snap.size,
                movements,
                message: 'No wallet movements found',
            });
        }

        const now = Timestamp.now();
        const walletFields = {
            walletBalance: correct,
            walletCurrency: 'GHS',
            walletUpdatedAt: now,
            updatedAt: now,
        };

        if (exists) {
            await profileRef.update(walletFields);
        } else {
            await profileRef.set({
                id: userId,
                email: null,
                fullName: 'User',
                role: 'student',
                ...walletFields,
                createdAt: now,
            });
        }

        return NextResponse.json({
            success: true,
            changed: true,
            created: !exists,
            previous,
            newBalance: correct,
            count: snap.size,
            movements,
            message: `Wallet reconciled${!exists ? ' (profile created)' : ''}`,
        });
    } catch (e: any) {
        console.error('[Admin Reconcile Wallet]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}