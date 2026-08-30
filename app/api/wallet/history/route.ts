import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(idToken);
        const userId = decoded.uid;

        const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || '50'), 100);

        // Avoid composite index: fetch without orderBy, sort in memory
        const snap = await adminDb.collection('transactions')
            .where('userId', '==', userId)
            .limit(limit)
            .get();
        const sorted = snap.docs.sort((a,b)=>{
            const av = (a.data().createdAt?.toMillis?.() || a.data().createdAt?._seconds*1000 || 0);
            const bv = (b.data().createdAt?.toMillis?.() || b.data().createdAt?._seconds*1000 || 0);
            return bv - av;
        });
        // Filter out non-monetary enrollment markers (amount 0, direct) — only show real wallet movements
        const filtered = sorted.filter(d => {
            const t:any = d.data();
            // Keep only transactions with amount > 0 ; legacy 0-amount hide unless it's a refund (shouldn't be 0)
            return typeof t.amount === 'number' && t.amount !== 0;
        });
        const data = filtered.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() ?? null, paidAt: d.data().paidAt?.toDate?.()?.toISOString?.() ?? null }));
        return NextResponse.json({ success: true, data });
    } catch (e: any) {
        console.error('[Wallet History] error', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
