import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/firebase/admin';
import { 
    sendCommunityJoinRequestEmail, 
    sendCommunityApprovalEmail, 
    sendCommunityAnnouncementEmail,
    sendCommunitySessionStartEmail
} from '@/lib/email/send';

export async function POST(request: Request) {
    try {
        const decoded = await getAuthenticatedUser(request as any);
        if (!decoded) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { type, data } = body;

        switch (type) {
            case 'JOIN_REQUEST':
                if (!data.ownerEmail) return NextResponse.json({ error: 'Missing ownerEmail' }, { status: 400 });
                await sendCommunityJoinRequestEmail({
                    to: data.ownerEmail,
                    ownerName: data.ownerName,
                    requesterName: data.requesterName,
                    communityName: data.communityName
                });
                break;

            case 'JOIN_APPROVAL':
                if (!data.userEmail) return NextResponse.json({ error: 'Missing userEmail' }, { status: 400 });
                await sendCommunityApprovalEmail({
                    to: data.userEmail,
                    userName: data.userName,
                    communityName: data.communityName
                });
                break;

            case 'ANNOUNCEMENT':
                const recipientsA = Array.isArray(data.to) ? data.to : [data.to];
                const validRecipientsA = recipientsA.filter((e: string) => e && e.includes('@'));
                if (validRecipientsA.length === 0) return NextResponse.json({ error: 'No valid recipients' }, { status: 400 });
                const emailPromisesA = validRecipientsA.map((email: string) => 
                    sendCommunityAnnouncementEmail({
                        to: email,
                        communityName: data.communityName,
                        authorName: data.authorName,
                        content: (data.content || '').substring(0, 5000)
                    })
                );
                await Promise.all(emailPromisesA);
                break;

            case 'SESSION_START':
                const recipientsS = Array.isArray(data.to) ? data.to : [data.to];
                const validRecipientsS = recipientsS.filter((e: string) => e && e.includes('@'));
                if (validRecipientsS.length === 0) return NextResponse.json({ error: 'No valid recipients' }, { status: 400 });
                const emailPromisesS = validRecipientsS.map((email: string) => 
                    sendCommunitySessionStartEmail({
                        to: email,
                        communityName: data.communityName,
                        lecturerName: data.lecturerName,
                        sessionTitle: data.sessionTitle,
                        sessionId: data.sessionId
                    })
                );
                await Promise.all(emailPromisesS);
                break;

            default:
                return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Community Notification Error:', error);
        return NextResponse.json(
            { error: 'Failed to send notification' },
            { status: 500 }
        );
    }
}
