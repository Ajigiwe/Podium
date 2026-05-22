import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Initializes an attendance session for a class
 * POST /api/attendance/session/start
 */
export async function POST(request: NextRequest) {
    try {
        let { sessionId, durationMinutes, verificationCount, lecturerId } = await request.json();

        if (!sessionId || !lecturerId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const sessionRef = adminDb.collection('sessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();

        if (!sessionSnap.exists) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const sessionData = sessionSnap.data();

        // Fallback to session data if not provided, and then to defaults
        durationMinutes = durationMinutes || sessionData?.durationMinutes || 60;
        verificationCount = verificationCount || sessionData?.verificationCount || 3;

        // Check if user is host, lecturer, or an active co-host
        const coHostSnap = await adminDb
            .collection('sessions')
            .doc(sessionId)
            .collection('co_hosts')
            .doc(lecturerId)
            .get();
        const isCoHost = coHostSnap.exists && coHostSnap.data()?.isActive === true;
        
        const isAuthorized = 
            sessionData?.hostId === lecturerId || 
            sessionData?.lecturerId === lecturerId ||
            isCoHost;

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Unauthorized: Only the host or co-host can start attendance' }, { status: 403 });
        }

        // Calculate random verification times
        const scheduledTimes: number[] = [];
        const buffer = 2; // Start after 2 mins
        const endBuffer = 2; // End 2 mins before class ends

        if (durationMinutes > (buffer + endBuffer + verificationCount)) {
            const availableWindow = durationMinutes - buffer - endBuffer;
            const interval = availableWindow / verificationCount;

            for (let i = 0; i < verificationCount; i++) {
                // Random time within each interval slice
                const randomOffset = Math.random() * interval;
                const scheduledMinute = buffer + (i * interval) + randomOffset;
                scheduledTimes.push(Math.round(scheduledMinute));
            }
        } else {
            // Short class or too many checks, just space them out evenly
            for (let i = 0; i < verificationCount; i++) {
                scheduledTimes.push(Math.round((durationMinutes / (verificationCount + 1)) * (i + 1)));
            }
        }

        // Sort to ensure they trigger in order
        scheduledTimes.sort((a, b) => a - b);

        await sessionRef.update({
            attendanceStartedAt: Timestamp.now(),
            attendanceDurationMinutes: durationMinutes,
            expectedVerificationCount: verificationCount,
            scheduledVerifications: scheduledTimes,
            attendanceStatus: 'active'
        });

        return NextResponse.json({
            success: true,
            scheduledTimes,
            message: `Attendance started for ${durationMinutes} minutes with ${verificationCount} checks.`
        });

    } catch (error: any) {
        console.error('Error starting attendance session:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
