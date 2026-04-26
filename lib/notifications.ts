import { db } from './firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { GroupMembership, Session } from './firebase/types';

/**
 * Trigger notification to all members of a group when a session starts
 */
export const notifyGroupSessionStart = async (session: Session) => {
    if (!session.groupId) return;

    try {
        // 1. Fetch group details
        const groupSnap = await getDoc(doc(db, 'groups', session.groupId));
        if (!groupSnap.exists()) return;
        const group = groupSnap.data();

        // 2. Fetch all approved members
        const membersQuery = query(
            collection(db, 'group_memberships'), 
            where('groupId', '==', session.groupId)
        );
        const membersSnap = await getDocs(membersQuery);
        const members = membersSnap.docs.map(d => d.data() as GroupMembership);
        
        const emails = members.map(m => m.userEmail).filter(e => !!e);
        
        console.log(`[NOTIFY] Session "${session.title}" started in group "${group.name}".`);
        console.log(`[NOTIFY] Sending alerts to ${emails.length} members:`, emails);

        // TODO: Integrate with Resend/SendGrid API
        // await fetch('/api/notify', {
        //     method: 'POST',
        //     body: JSON.stringify({
        //         emails,
        //         subject: `Class Started: ${session.title}`,
        //         content: `The session "${session.title}" in ${group.name} is now live! Join here: ${window.location.origin}/classroom/${session.id}`
        //     })
        // });

    } catch (error) {
        console.error('Failed to trigger notifications:', error);
    }
};
