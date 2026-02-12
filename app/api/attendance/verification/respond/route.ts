import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * Records a student's response to a verification prompt
 * POST /api/attendance/verification/respond
 */
export async function POST(request: NextRequest) {
    try {
        const { sessionId, verificationId, studentId } = await request.json();

        if (!sessionId || !verificationId || !studentId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const sessionRef = adminDb.collection('sessions').doc(sessionId);
        const verifRef = sessionRef.collection('verifications').doc(verificationId);
        const verifSnap = await verifRef.get();

        if (!verifSnap.exists) {
            return NextResponse.json({ error: 'Verification not found' }, { status: 404 });
        }

        const verifData = verifSnap.data();
        if (!verifData) {
            return NextResponse.json({ error: 'Verification data missing' }, { status: 500 });
        }
        const now = Timestamp.now();

        if (now.seconds > verifData.expiresAt.seconds) {
            return NextResponse.json({ error: 'Verification has expired' }, { status: 410 });
        }

        // 1. Record response
        const responseRef = verifRef.collection('responses').doc(studentId);
        await responseRef.set({
            attendanceRecordId: studentId,
            respondedAt: now,
            responseTimeSeconds: now.seconds - verifData.triggeredAt.seconds
        });

        // 2. Update student's summary stats
        const attendanceRef = sessionRef.collection('attendance').doc(studentId);
        const recordSnap = await attendanceRef.get();

        if (recordSnap.exists) {
            const data = recordSnap.data();
            if (!data) return NextResponse.json({ error: 'Attendance record data missing' }, { status: 500 });

            const completed = (data.totalVerificationsCompleted || 0) + 1;
            const sent = data.totalVerificationsSent || 1;

            await attendanceRef.update({
                totalVerificationsCompleted: completed,
                verificationPercentage: Math.round((completed / sent) * 100),
                lastRespondedAt: now
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error recording verification response:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
