import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import Papa from 'papaparse';

/**
 * Generates a CSV report for session attendance
 * GET /api/attendance/download/[sessionId]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const sessionRef = adminDb.collection('sessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();

        if (!sessionSnap.exists) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const sessionData = sessionSnap.data();
        if (!sessionData) return NextResponse.json({ error: 'Session data missing' }, { status: 500 });

        const attendanceSnap = await sessionRef.collection('attendance').get();

        const attendanceData = attendanceSnap.docs.map(doc => {
            const data = doc.data();
            return {
                Name: data.studentName,
                IndexNumber: data.studentIndexNumber || 'N/A',
                JoinedAt: data.joinedAt?.toDate?.()?.toLocaleString() || 'N/A',
                TotalVerifications: data.totalVerificationsSent || 0,
                CompletedVerifications: data.totalVerificationsCompleted || 0,
                Percentage: `${data.verificationPercentage || 0}%`,
                Status: (data.verificationPercentage || 0) >= 50 ? 'PRESENT' : 'ABSENT'
            };
        });

        const csv = Papa.unparse(attendanceData);

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename=attendance_${sessionData?.title || sessionId}.csv`
            }
        });

    } catch (error: any) {
        console.error('Error generating attendance report:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
