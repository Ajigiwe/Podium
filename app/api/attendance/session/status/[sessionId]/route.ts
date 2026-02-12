import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Retrieves the current attendance status for a session
 * GET /api/attendance/session/status/[sessionId]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { sessionId: string } }
) {
    try {
        const { sessionId } = params;

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const sessionRef = adminDb.collection('sessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();

        if (!sessionSnap.exists) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const sessionData = sessionSnap.data();

        // Get triggered verifications to see which scheduled ones are already done
        const verificationsSnap = await sessionRef.collection('verifications').get();
        const triggeredCount = verificationsSnap.size;

        // We could also map specific minutes to verification numbers if needed, 
        // but for now, just count is enough for recovery if we assume index-based matching.

        return NextResponse.json({
            success: true,
            status: sessionData?.attendanceStatus || 'inactive',
            startedAt: sessionData?.attendanceStartedAt?.toMillis() || null,
            durationMinutes: sessionData?.attendanceDurationMinutes || 0,
            expectedVerificationCount: sessionData?.expectedVerificationCount || 0,
            scheduledVerifications: sessionData?.scheduledVerifications || [],
            triggeredCount
        });

    } catch (error: any) {
        console.error('Error fetching session attendance status:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
