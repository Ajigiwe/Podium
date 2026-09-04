import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

type GroupAction =
    | 'create'
    | 'request'
    | 'requestDecision'
    | 'grantLecturer'
    | 'removeMember'
    | 'leave'
    | 'postAnnouncement'
    | 'addResource';

async function authenticate(request: NextRequest) {
    const header = request.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) return null;
    try {
        const decoded = await adminAuth.verifyIdToken(header.slice(7));
        const profile = await adminDb.collection('profiles').doc(decoded.uid).get();
        return { decoded, profile: profile.data() || {} };
    } catch {
        return null;
    }
}

function isPrivileged(profile: Record<string, any>) {
    return profile.role === 'admin' || profile.role === 'lecturer' || profile.isVerified === true;
}

function makeJoinCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(request: NextRequest) {
    const identity = await authenticate(request);
    if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { decoded, profile } = identity;
    const body = await request.json().catch(() => ({}));
    const action = body.action as GroupAction;

    try {
        if (action === 'create') {
            if (!isPrivileged(profile)) {
                return NextResponse.json({ error: 'Only verified users can create communities' }, { status: 403 });
            }
            const name = String(body.name || '').trim();
            const description = String(body.description || '').trim();
            if (name.length < 2 || name.length > 100 || description.length > 500) {
                return NextResponse.json({ error: 'Provide a valid community name and description' }, { status: 400 });
            }

            const groupRef = adminDb.collection('groups').doc();
            const membershipRef = adminDb.collection('group_memberships').doc(`${decoded.uid}_${groupRef.id}`);
            const ownerName = profile.fullName || decoded.name || decoded.email || 'Community owner';
            const group = {
                id: groupRef.id,
                name,
                description,
                ownerId: decoded.uid,
                ownerName,
                ownerEmail: profile.email || decoded.email || null,
                isPublic: body.isPublic !== false,
                joinCode: makeJoinCode(),
                memberCount: 1,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };
            await adminDb.runTransaction(async (transaction) => {
                transaction.create(groupRef, group);
                transaction.create(membershipRef, {
                    id: membershipRef.id,
                    userId: decoded.uid,
                    groupId: groupRef.id,
                    role: 'owner',
                    joinedAt: Timestamp.now(),
                    userName: ownerName,
                    userEmail: profile.email || decoded.email || null,
                });
            });
            return NextResponse.json({ success: true, group });
        }

        const groupId = String(body.groupId || '').trim();
        if (!groupId) return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
        const groupRef = adminDb.collection('groups').doc(groupId);
        const groupSnap = await groupRef.get();
        if (!groupSnap.exists) return NextResponse.json({ error: 'Community not found' }, { status: 404 });
        const group = groupSnap.data() as Record<string, any>;
        const isOwner = group.ownerId === decoded.uid;
        const isAdmin = profile.role === 'admin';

        if (action === 'request') {
            const membershipRef = adminDb.collection('group_memberships').doc(`${decoded.uid}_${groupId}`);
            if ((await membershipRef.get()).exists) {
                return NextResponse.json({ error: 'You are already a member' }, { status: 409 });
            }
            const requestRef = adminDb.collection('group_requests').doc(`${decoded.uid}_${groupId}`);
            const existing = await requestRef.get();
            if (existing.exists && existing.data()?.status === 'pending') {
                return NextResponse.json({ error: 'Request already pending' }, { status: 409 });
            }
            await requestRef.set({
                id: requestRef.id,
                groupId,
                userId: decoded.uid,
                userName: profile.fullName || decoded.name || decoded.email || 'Student',
                userEmail: profile.email || decoded.email || '',
                status: 'pending',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            return NextResponse.json({ success: true, requestId: requestRef.id });
        }

        if (action === 'requestDecision') {
            if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Only the community owner can manage requests' }, { status: 403 });
            const requestId = String(body.requestId || '').trim();
            const status = body.status === 'approved' ? 'approved' : body.status === 'rejected' ? 'rejected' : null;
            if (!requestId || !status) return NextResponse.json({ error: 'requestId and valid status are required' }, { status: 400 });
            const requestRef = adminDb.collection('group_requests').doc(requestId);
            await adminDb.runTransaction(async (transaction) => {
                const requestSnap = await transaction.get(requestRef);
                if (!requestSnap.exists) throw new Error('REQUEST_NOT_FOUND');
                const joinRequest = requestSnap.data() as Record<string, any>;
                if (joinRequest.groupId !== groupId) throw new Error('REQUEST_MISMATCH');
                if (joinRequest.status !== 'pending') throw new Error('REQUEST_ALREADY_PROCESSED');
                if (status === 'approved') {
                    const membershipRef = adminDb.collection('group_memberships').doc(`${joinRequest.userId}_${groupId}`);
                    const membershipSnap = await transaction.get(membershipRef);
                    if (!membershipSnap.exists) {
                        transaction.create(membershipRef, {
                            id: membershipRef.id,
                            userId: joinRequest.userId,
                            groupId,
                            role: 'student',
                            joinedAt: Timestamp.now(),
                            userName: joinRequest.userName,
                            userEmail: joinRequest.userEmail,
                        });
                        transaction.update(groupRef, { memberCount: FieldValue.increment(1), updatedAt: Timestamp.now() });
                    }
                }
                transaction.update(requestRef, { status, updatedAt: Timestamp.now(), processedBy: decoded.uid });
            });
            return NextResponse.json({ success: true, status });
        }

        if (action === 'grantLecturer') {
            if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Only the community owner can grant lecturer access' }, { status: 403 });
            const email = String(body.email || '').trim().toLowerCase();
            if (!email || !email.includes('@')) return NextResponse.json({ error: 'Valid lecturer email is required' }, { status: 400 });
            const lecturerSnap = await adminDb.collection('profiles').where('email', '==', email).limit(1).get();
            if (lecturerSnap.empty) return NextResponse.json({ error: 'Lecturer not found' }, { status: 404 });
            const lecturer = lecturerSnap.docs[0];
            const lecturerProfile = lecturer.data();
            if (lecturerProfile.role !== 'lecturer' && lecturerProfile.isVerified !== true) {
                return NextResponse.json({ error: 'User is not an approved lecturer' }, { status: 400 });
            }
            const membershipRef = adminDb.collection('group_memberships').doc(`${lecturer.id}_${groupId}`);
            const existing = await membershipRef.get();
            await membershipRef.set({
                id: membershipRef.id,
                userId: lecturer.id,
                groupId,
                role: 'lecturer',
                joinedAt: existing.exists ? (existing.data()?.joinedAt || Timestamp.now()) : Timestamp.now(),
                userName: lecturerProfile.fullName || email,
                userEmail: email,
                grantedBy: decoded.uid,
                updatedAt: Timestamp.now(),
            }, { merge: true });
            if (!existing.exists) await groupRef.update({ memberCount: FieldValue.increment(1), updatedAt: Timestamp.now() });
            return NextResponse.json({ success: true, userId: lecturer.id });
        }

        if (action === 'postAnnouncement') {
            const membership = await adminDb.collection('group_memberships').doc(`${decoded.uid}_${groupId}`).get();
            const isLecturer = ['lecturer', 'instructor'].includes(membership.data()?.role);
            if (!isOwner && !isAdmin && !isLecturer) return NextResponse.json({ error: 'Only community managers can post announcements' }, { status: 403 });
            const content = String(body.content || '').trim();
            if (!content || content.length > 5000) return NextResponse.json({ error: 'Announcement must be between 1 and 5000 characters' }, { status: 400 });
            await groupRef.collection('announcements').add({
                content,
                authorId: decoded.uid,
                authorName: profile.fullName || decoded.name || decoded.email || 'Community manager',
                createdAt: Timestamp.now(),
            });
            return NextResponse.json({ success: true });
        }

        if (action === 'addResource') {
            const membership = await adminDb.collection('group_memberships').doc(`${decoded.uid}_${groupId}`).get();
            const isLecturer = ['lecturer', 'instructor'].includes(membership.data()?.role);
            if (!isOwner && !isAdmin && !isLecturer) return NextResponse.json({ error: 'Only community managers can share resources' }, { status: 403 });
            const title = String(body.title || '').trim();
            const url = String(body.url || '').trim();
            const type = String(body.type || 'link').trim();
            if (!title || title.length > 200 || !url || url.length > 2000) return NextResponse.json({ error: 'Valid resource title and URL are required' }, { status: 400 });
            await groupRef.collection('resources').add({
                title,
                url,
                type: type === 'file' ? 'file' : 'link',
                createdAt: Timestamp.now(),
                addedBy: decoded.uid,
            });
            return NextResponse.json({ success: true });
        }

        if (action === 'removeMember' || action === 'leave') {
            const targetUserId = action === 'leave' ? decoded.uid : String(body.userId || '').trim();
            const targetRef = adminDb.collection('group_memberships').doc(`${targetUserId}_${groupId}`);
            const targetSnap = await targetRef.get();
            if (!targetSnap.exists) return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
            const target = targetSnap.data() as Record<string, any>;
            if (target.role === 'owner') return NextResponse.json({ error: 'The owner cannot leave or be removed' }, { status: 400 });
            const canRemove = action === 'leave'
                ? targetUserId === decoded.uid
                : isAdmin || isOwner || target.grantedBy === decoded.uid;
            if (!canRemove) return NextResponse.json({ error: 'You cannot manage this membership' }, { status: 403 });
            await adminDb.runTransaction(async (transaction) => {
                transaction.delete(targetRef);
                transaction.update(groupRef, { memberCount: FieldValue.increment(-1), updatedAt: Timestamp.now() });
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid group action' }, { status: 400 });
    } catch (error: any) {
        const code = error?.message;
        if (code === 'REQUEST_NOT_FOUND') return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        if (code === 'REQUEST_MISMATCH') return NextResponse.json({ error: 'Request does not belong to this community' }, { status: 400 });
        if (code === 'REQUEST_ALREADY_PROCESSED') return NextResponse.json({ error: 'Request already processed' }, { status: 409 });
        console.error('[Groups API]', error);
        return NextResponse.json({ error: 'Community operation failed' }, { status: 500 });
    }
}
