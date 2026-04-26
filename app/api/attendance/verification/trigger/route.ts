import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { RoomServiceClient } from 'livekit-server-sdk';

/**
 * Triggers a verification event for all students in a room
 * POST /api/attendance/verification/trigger
 */
export async function POST(request: NextRequest) {
    try {
        const { sessionId, triggeredBy, timeLimitSeconds = 30 } = await request.json();

        if (!sessionId || !triggeredBy) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

        if (!apiKey || !apiSecret || !livekitUrl) {
            return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
        }

        const roomName = `podium_${sessionId}`;

        // 1. Create verification document
        const sessionRef = adminDb.collection('sessions').doc(sessionId);
        const verificationsRef = sessionRef.collection('verifications');

        const verifCountSnap = await verificationsRef.count().get();
        const verificationNumber = verifCountSnap.data().count + 1;

        const verificationId = verificationsRef.doc().id;
        const now = Timestamp.now();
        const expiresAt = new Timestamp(now.seconds + timeLimitSeconds, now.nanoseconds);

        const verificationData = {
            id: verificationId,
            verificationNumber,
            triggeredBy,
            triggeredAt: now,
            expiresAt,
            timeLimitSeconds
        };

        await verificationsRef.doc(verificationId).set(verificationData);

        // 2. Increment totalVerificationsSent for all active students
        const attendanceRef = sessionRef.collection('attendance');
        const studentsSnap = await attendanceRef.where('isPresent', '==', true).get();

        const batch = adminDb.batch();
        studentsSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                totalVerificationsSent: FieldValue.increment(1)
            });
            // Also update flat log for reports
            const logRef = adminDb.collection('attendance_logs').doc(`${sessionId}_${doc.id}`);
            batch.update(logRef, {
                totalVerificationsSent: FieldValue.increment(1)
            });
        });
        await batch.commit();

        // 3. Broadcast to LiveKit room
        const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({
            type: 'VERIFICATION_TRIGGERED',
            payload: {
                verificationId,
                verificationNumber,
                expiresAt: expiresAt.toMillis(),
                timeLimitSeconds
            }
        }));

        // DataPacket_Kind.RELIABLE corresponds to 0
        await svc.sendData(roomName, data, 0);

        return NextResponse.json({
            success: true,
            verificationId
        });

    } catch (error: any) {
        console.error('Error triggering verification:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
