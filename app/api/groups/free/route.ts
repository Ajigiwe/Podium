import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error:'Unauthorized'}, {status:401});
    const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    const caller = await adminDb.collection('profiles').doc(decoded.uid).get();
    if (caller.data()?.role !== 'admin') return NextResponse.json({ error:'Admin only'}, {status:403});
    const { groupId, isFreeSessions } = await req.json();
    if (!groupId) return NextResponse.json({ error:'groupId required'}, {status:400});
    await adminDb.collection('groups').doc(groupId).update({ isFreeSessions: !!isFreeSessions });
    return NextResponse.json({ success:true });
}
