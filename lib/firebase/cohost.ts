import { db } from './config';
import {
    collection,
    doc,
    setDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    serverTimestamp,
    getDoc,
} from 'firebase/firestore';
import { CoHost } from './types';

/**
 * Real-time subscription to active co-hosts for a session.
 * Returns an unsubscribe function.
 */
export const subscribeToCoHosts = (
    sessionId: string,
    onUpdate: (coHosts: CoHost[]) => void
) => {
    const coHostsRef = collection(db, 'sessions', sessionId, 'co_hosts');
    const q = query(coHostsRef, where('isActive', '==', true));

    return onSnapshot(
        q,
        (snapshot) => {
            const coHosts = snapshot.docs.map((d) => ({
                ...(d.data() as CoHost),
                userId: d.id,
            }));
            onUpdate(coHosts);
        },
        (error) => {
            console.error('[CoHosts] Error subscribing to co-hosts:', error);
            onUpdate([]);
        }
    );
};

/**
 * One-time check: is this userId an active co-host of the session?
 */
export const checkIsCoHost = async (
    sessionId: string,
    userId: string
): Promise<boolean> => {
    const coHostDocRef = doc(db, 'sessions', sessionId, 'co_hosts', userId);
    const snap = await getDoc(coHostDocRef);
    if (!snap.exists()) return false;
    const data = snap.data() as CoHost;
    return data.isActive === true;
};
