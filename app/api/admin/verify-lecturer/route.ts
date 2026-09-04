import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
        const caller = await adminDb.collection('profiles').doc(decoded.uid).get();
        if (caller.data()?.role !== 'admin') return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });

        const { userId, approve, role } = await req.json();
        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

        const targetRef = adminDb.collection('profiles').doc(userId);
        const snap = await targetRef.get();
        if (!snap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        if (approve) {
            await targetRef.update({
                isVerified: true,
                role: role || 'lecturer',
                lecturerVerifiedAt: Timestamp.now(),
                lecturerVerifiedBy: decoded.uid,
                updatedAt: Timestamp.now(),
            });
        } else {
            await targetRef.update({
                isVerified: false,
                lecturerVerifiedAt: Timestamp.now(),
                lecturerVerifiedBy: decoded.uid,
                updatedAt: Timestamp.now(),
            });
        }
        return NextResponse.json({ success: true, approved: approve });
    } catch (e: any) {
        console.error('[Verify Lecturer]', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
        const caller = await adminDb.collection('profiles').doc(decoded.uid).get();
        if (caller.data()?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        // List pending verification requests + unverified lecturers
        const reqs = await adminDb.collection('verification_requests').limit(50).get();
        const pending = reqs.docs.map(d => ({ id: d.id, ...d.data() }));
        // Also list profiles where isVerified false but role lecturer
        const lecturers = await adminDb.collection('profiles').where('isVerified', '==', false).limit(50).get();
        const unverified = lecturers.docs.map(d => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ pending, unverified });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
