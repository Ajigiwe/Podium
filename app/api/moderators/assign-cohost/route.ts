import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
    try {
        const { sessionId, hostUserId, targetUserId, targetUserName } = await request.json();

        if (!sessionId || !hostUserId || !targetUserId || !targetUserName) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Verify requester is the main host (server-side enforcement)
        const sessionRef = adminDb.collection('sessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();

        if (!sessionSnap.exists) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const sessionData = sessionSnap.data()!;
        const isHost =
            sessionData.hostId === hostUserId ||
            sessionData.lecturerId === hostUserId;

        if (!isHost) {
            return NextResponse.json(
                { error: 'Only the main host can assign co-hosts' },
                { status: 403 }
            );
        }

        // Prevent assigning yourself
        if (targetUserId === hostUserId) {
            return NextResponse.json(
                { error: 'Host cannot assign themselves as co-host' },
                { status: 400 }
            );
        }

        // Create / re-activate the co-host document
        const coHostRef = adminDb
            .collection('sessions')
            .doc(sessionId)
            .collection('co_hosts')
            .doc(targetUserId);

        await coHostRef.set(
            {
                userId: targetUserId,
                userName: targetUserName,
                assignedBy: hostUserId,
                assignedAt: FieldValue.serverTimestamp(),
                isActive: true,
            },
            { merge: true }
        );

        return NextResponse.json({
            success: true,
            message: `${targetUserName} is now a co-host`,
        });
    } catch (error) {
        console.error('[API:assign-cohost] Error:', error);
        return NextResponse.json(
            { error: 'Failed to assign co-host' },
            { status: 500 }
        );
    }
}
