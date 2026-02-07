import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ egressId: string }> }
) {
    try {
        const { egressId } = await context.params;

        if (!egressId) {
            return NextResponse.json({ error: 'Missing egressId' }, { status: 400 });
        }

        const recordingDoc = await adminDb.collection('recordings').doc(egressId).get();

        if (!recordingDoc.exists) {
            return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
        }

        const data = recordingDoc.data();

        return NextResponse.json({
            success: true,
            recording: {
                id: recordingDoc.id,
                ...data,
                startedAt: data?.startedAt?.toDate?.()?.toISOString() || data?.startedAt,
                endedAt: data?.endedAt?.toDate?.()?.toISOString() || data?.endedAt,
                createdAt: data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt,
            }
        });

    } catch (error: any) {
        console.error('Failed to fetch recording status:', error);
        return NextResponse.json({
            error: 'Failed to fetch recording status',
            details: error.message
        }, { status: 500 });
    }
}
