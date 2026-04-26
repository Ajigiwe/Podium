import { NextResponse } from 'next/server';
import { 
    sendCommunityJoinRequestEmail, 
    sendCommunityApprovalEmail, 
    sendCommunityAnnouncementEmail,
    sendCommunitySessionStartEmail
} from '@/lib/email/send';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, data } = body;

        switch (type) {
            case 'JOIN_REQUEST':
                await sendCommunityJoinRequestEmail({
                    to: data.ownerEmail,
                    ownerName: data.ownerName,
                    requesterName: data.requesterName,
                    communityName: data.communityName
                });
                break;

            case 'JOIN_APPROVAL':
                await sendCommunityApprovalEmail({
                    to: data.userEmail,
                    userName: data.userName,
                    communityName: data.communityName
                });
                break;

            case 'ANNOUNCEMENT':
                // For announcements, 'to' might be an array or a single string
                const recipientsA = Array.isArray(data.to) ? data.to : [data.to];
                const emailPromisesA = recipientsA.map((email: string) => 
                    sendCommunityAnnouncementEmail({
                        to: email,
                        communityName: data.communityName,
                        authorName: data.authorName,
                        content: data.content
                    })
                );
                await Promise.all(emailPromisesA);
                break;

            case 'SESSION_START':
                const recipientsS = Array.isArray(data.to) ? data.to : [data.to];
                const emailPromisesS = recipientsS.map((email: string) => 
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
            { error: error.message || 'Failed to send notification' },
            { status: 500 }
        );
    }
}
