import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ lecturerId: string }> }
) {
    try {
        const { lecturerId } = await context.params;

        if (!lecturerId) {
            return NextResponse.json({ error: 'Missing lecturerId' }, { status: 400 });
        }

        const recordingsSnapshot = await adminDb
            .collection('recordings')
            .orderBy('createdAt', 'desc')
            .get();

        const recordings = recordingsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Convert timestamps to ISO strings for JSON
                startedAt: data.startedAt?.toDate?.()?.toISOString() || data.startedAt,
                endedAt: data.endedAt?.toDate?.()?.toISOString() || data.endedAt,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            };
        });

        // Sort manually if index is missing to avoid initial errors
        recordings.sort((a: any, b: any) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return NextResponse.json({
            success: true,
            recordings
        });

    } catch (error: any) {
        console.error('Failed to fetch recordings:', error);
        return NextResponse.json({
            error: 'Failed to fetch recordings',
            details: error.message
        }, { status: 500 });
    }
}
