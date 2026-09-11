import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { generateMeetingCode } from '@/lib/meetingCode';
import { resolveSessionFee } from '@/lib/payments/fee';
import { notifyCommunityClass } from '@/lib/notifications/class-alerts';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get('authorization');
        if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
        const profileSnap = await adminDb.collection('profiles').doc(decoded.uid).get();
        const profile = profileSnap.data() || {};
        const isAdmin = profile.role === 'admin';
        const canTeach = isAdmin || profile.role === 'lecturer' || profile.isVerified === true;
        if (!canTeach) return NextResponse.json({ error: 'Lecturer verification is required' }, { status: 403 });

        const body = await request.json();
        const title = String(body.title || '').trim();
        const course = String(body.course || '').trim();
        const program = String(body.program || '').trim();
        const groupId = body.groupId ? String(body.groupId).trim() : null;
        const durationMinutes = Math.min(Math.max(Number(body.durationMinutes) || 60, 5), 480);
        const verificationCount = Math.min(Math.max(Number(body.verificationCount) || 2, 0), 20);
        if (title.length < 2 || title.length > 160) return NextResponse.json({ error: 'Class title must be between 2 and 160 characters' }, { status: 400 });
        if (course.length > 80 || program.length > 120) return NextResponse.json({ error: 'Course or program is too long' }, { status: 400 });

        if (groupId && !isAdmin) {
            const membership = await adminDb.collection('group_memberships').doc(`${decoded.uid}_${groupId}`).get();
            const role = membership.data()?.role;
            const group = await adminDb.collection('groups').doc(groupId).get();
            const canManageGroup = group.exists && group.data()?.ownerId === decoded.uid;
            if (!membership.exists || (!canManageGroup && role !== 'lecturer' && role !== 'instructor')) {
                return NextResponse.json({ error: 'You do not have teaching access to this community' }, { status: 403 });
            }
        }

        const subscriptionSnap = await adminDb.collection('system_settings').doc('subscription').get();
        const walletSnap = await adminDb.collection('system_settings').doc('wallet').get();
        const requestedPrice = isAdmin && body.price !== undefined ? Number(body.price) : undefined;
        const fee = resolveSessionFee(
            { price: requestedPrice, isFree: isAdmin && body.isFree === true },
            subscriptionSnap.exists ? subscriptionSnap.data() : undefined,
            walletSnap.exists ? walletSnap.data() : undefined,
        );
        if (!fee.isFree && fee.amount <= 0) return NextResponse.json({ error: 'A paid class must have a positive fee' }, { status: 400 });

        const sessionRef = adminDb.collection('sessions').doc();
        const scheduledStartTime = body.scheduledStartTime ? new Date(body.scheduledStartTime) : null;
        if (scheduledStartTime && Number.isNaN(scheduledStartTime.getTime())) {
            return NextResponse.json({ error: 'Invalid scheduled start time' }, { status: 400 });
        }
        const session = {
            id: sessionRef.id,
            title,
            course,
            program,
            durationMinutes,
            verificationCount,
            groupId,
            hostId: decoded.uid,
            lecturerId: decoded.uid,
            lecturerName: profile.fullName || decoded.name || decoded.email || 'Faculty',
            isActive: false,
            status: 'active',
            price: fee.amount,
            currency: 'GHS',
            isFree: fee.isFree,
            meetingCode: generateMeetingCode(sessionRef.id),
            youtubeVideoId: null,
            requireGuestDetails: true,
            isDeleted: false,
            participantCount: 0,
            createdAt: Timestamp.now(),
            ...(scheduledStartTime ? { scheduledStartTime: Timestamp.fromDate(scheduledStartTime) } : {}),
        };
        await sessionRef.create(session);

        // Community members get a "class scheduled" email — fire-and-forget, never blocks creation.
        // Re-alerts on restart are prevented by the scheduledNotifiedAt dedup field.
        if (groupId) {
            notifyCommunityClass({ sessionId: sessionRef.id, kind: 'scheduled' })
                .catch((err) => console.error('[Sessions API] scheduled alert failed:', err));
        }

        return NextResponse.json({ success: true, session });
    } catch (error: any) {
        console.error('[Sessions API] create failed:', error);
        return NextResponse.json({ error: error.message || 'Failed to create class' }, { status: 500 });
    }
}
