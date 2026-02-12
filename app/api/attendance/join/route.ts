import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Records a student joining the attendance session
 * POST /api/attendance/join
 */
export async function POST(request: NextRequest) {
    try {
        const { sessionId, studentId, studentName, studentIndexNumber } = await request.json();

        if (!sessionId || !studentId || !studentName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const attendanceRef = adminDb
            .collection('sessions')
            .doc(sessionId)
            .collection('attendance')
            .doc(studentId);

        const recordSnap = await attendanceRef.get();

        if (!recordSnap.exists) {
            await attendanceRef.set({
                studentName,
                studentIndexNumber: studentIndexNumber || null,
                joinedAt: Timestamp.now(),
                leftAt: null,
                totalVerificationsSent: 0,
                totalVerificationsCompleted: 0,
                verificationPercentage: 0,
                isPresent: true
            });
        } else {
            // Already joined previously, just mark as present if they were away
            await attendanceRef.update({
                isPresent: true,
                lastSeenAt: Timestamp.now()
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error in attendance join:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
