import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { RoomServiceClient } from 'livekit-server-sdk';
import { refundSession } from './refund-session';
import { resolveSessionFee } from '@/lib/payments/fee';

export const dynamic = 'force-dynamic';

/**
 * POST /api/smoke/session-flow
 * Admin-only end-to-end smoke test for the community → session → refund loop.
 *
 * Flow:
 * 1. Create a temporary community
 * 2. Request to join it
 * 3. Approve the request
 * 4. Assign a lecturer to the community
 * 5. Create a paid session linked to the community
 * 6. Start the session
 * 7. End the session
 * 8. Verify refund execution
 * 9. Clean up the temporary data
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
        const callerDoc = await adminDb.collection('profiles').doc(decoded.uid).get();
        const caller = callerDoc.data() || {};
        if (caller.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { userId, lecturerId, sessionTitle } = await request.json() as {
            userId?: string;
            lecturerId?: string;
            sessionTitle?: string;
        };

        if (!userId || ! lecturerId) {
            return NextResponse.json({ error: 'userId and lecturerId are required for the smoke flow' }, { status: 400 });
        }

        const ns = `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const communityId = `${ns}_community`;
        const sessionId = `${ns}_session`;
        const created: Record<string, any> = {
            communityId,
            sessionId,
            cleanup: []
        };

        try {
            const communityRef = adminDb.collection('groups').doc(communityId);
            await communityRef.set({
                name: `Smoke community ${ns}`,
                description: 'Temporary community for payment lifecycle smoke test',
                createdAt: Timestamp.now(),
                createdBy: decoded.uid,
            });
            created.communityRef = communityRef.path;
            created.cleanup.push(() => communityRef.delete());

            const memberRef = adminDb.collection('group_memberships').doc(`${communityId}_${userId}`);
            await memberRef.set({
                groupId: communityId,
                userId,
                role: 'student',
                joinedAt: Timestamp.now(),
                requestStatus: 'pending',
            });
            created.cleanup.push(() => memberRef.delete());

            const memberDoc = await memberRef.get();
            if (!memberDoc.exists) {
                return NextResponse.json({ error: 'Smoke join request was not created' }, { status: 500 });
            }

            await memberRef.update({ requestStatus: 'approved', role: 'student' });
            const approvedDoc = await memberRef.get();
            if (approvedDoc.data()?.requestStatus !== 'approved') {
                return NextResponse.json({ error: 'Smoke member approval failed' }, { status: 500 });
            }

            const lecturerMembershipRef = adminDb.collection('group_memberships').doc(`${communityId}_${lecturerId}`);
            await lecturerMembershipRef.set({
                groupId: communityId,
                userId: lecturerId,
                role: 'lecturer',
                joinedAt: Timestamp.now(),
                requestStatus: 'approved',
            });
            created.cleanup.push(() => lecturerMembershipRef.delete());

            const lecturerMembershipDoc = await lecturerMembershipRef.get();
            if (!lecturerMembershipDoc.exists) {
                return NextResponse.json({ error: 'Smoke lecturer membership was not created' }, { status: 500 });
            }

            const fee = resolveSessionFee({}, { perClassFee: 10000 }, {}).amount;

            const sessionRef = adminDb.collection('sessions').doc(sessionId);
            await sessionRef.set({
                title: sessionTitle || `Smoke session ${ns}`,
                hostId: lecturerId,
                lecturerId,
                groupId: communityId,
                status: 'scheduled',
                isActive: false,
                isPayToUse: true,
                price: fee,
                startedAt: null,
                endedAt: null,
                refundProcessed: false,
                createdAt: Timestamp.now(),
            });
            created.cleanup.push(() => sessionRef.delete());

            const startResponse = await fetch(new URL('/api/sessions/lifecycle', request.url), {
                method: 'POST',
                headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, action: 'start' }),
            });
            const startBody = await startResponse.json();
            if (!startResponse.ok) {
                return NextResponse.json({ error: 'Smoke start failed', details: startBody }, { status: 500 });
            }
            created.startedAt = startBody.startedAt;

            const endedAt = Timestamp.now();
            await sessionRef.update({
                isActive: false,
                status: 'ended',
                endedAt,
                refundProcessed: false,
            });

            const refundResponse = await fetch(new URL('/api/wallet/refund', request.url), {
                method: 'POST',
                headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });
            const refundBody = await refundResponse.json();
            if (!refundResponse.ok) {
                return NextResponse.json({ error: 'Smoke refund failed', details: refundBody }, { status: 500 });
            }

            created.refundResult = refundBody;

            return NextResponse.json({
                success: true,
                flow: {
                    communityCreated: true,
                    joinRequestCreated: true,
                    memberApproved: true,
                    lecturerAssigned: true,
                    sessionCreated: true,
                    sessionStarted: true,
                    sessionEnded: true,
                    refundProcessed: refundBody.success || refundBody.refunded ? true : false,
                },
                cleanup: created.cleanup.length,
                sessionId,
                communityId,
            });
        } finally {
            for (const cleanup of created.cleanup) {
                try {
                    await cleanup();
                } catch (err) {
                    console.error('[Smoke Session Flow] Cleanup error:', err);
                }
            }
        }
    } catch (error: any) {
        console.error('[Smoke Session Flow]', error);
        return NextResponse.json({ error: error.message || 'Smoke session flow failed' }, { status: 500 });
    }
}
