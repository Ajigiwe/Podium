import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { closeStaleCommunityClasses, DEFAULT_STALE_HOURS } from '@/lib/sessions/close-stale-classes';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/close-stale-classes   (GET also works, for curl in a timer)
 *
 * Ends community classes that were created but never started. Kick off with the
 * `x-cron-secret` header (same convention as /api/wallet/refund), or as an admin.
 *
 * Optional: ?olderThanHours=24 (1..720, default 24) and ?dryRun=1 to preview.
 */
async function handle(request: NextRequest) {
    try {
        const params = request.nextUrl.searchParams;
        let body: { olderThanHours?: number; dryRun?: boolean } = {};
        if (request.method === 'POST') {
            body = await request.json().catch(() => ({})) as typeof body;
        }

        const cronSecret = request.headers.get('x-cron-secret');
        if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
            const authHeader = request.headers.get('authorization');
            if (!authHeader?.startsWith('Bearer ')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
            const profile = await adminDb.collection('profiles').doc(decoded.uid).get();
            if (profile.data()?.role !== 'admin') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const rawHours = body.olderThanHours ?? params.get('olderThanHours');
        const olderThanHours = rawHours === null || rawHours === undefined || rawHours === '' ? DEFAULT_STALE_HOURS : Number(rawHours);
        const dryRun = body.dryRun === true || params.get('dryRun') === '1' || params.get('dryRun') === 'true';

        const result = await closeStaleCommunityClasses({ olderThanHours, dryRun });
        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        console.error('[Cron] close-stale-classes failed:', error);
        return NextResponse.json({ error: error.message || 'Sweep failed' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return handle(request);
}

export async function GET(request: NextRequest) {
    return handle(request);
}
