import { db } from './config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Soft-deletes a session by setting its status to 'deleted'.
 * The document is NOT physically removed so history can still reference it.
 * All participants will be ejected by the ClassroomContext listener.
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
    const sessionRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionRef, {
        status: 'deleted',
        isDeleted: true,
        isActive: false,
        deletedAt: serverTimestamp(),
    });
};

/**
 * Ends a session by setting isActive to false and status to 'ended'.
 * This kicks all participants but preserves the session record.
 */
export const endSession = async (sessionId: string): Promise<void> => {
    const sessionRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionRef, {
        status: 'ended',
        isActive: false,
        endedAt: serverTimestamp(),
    });
};
