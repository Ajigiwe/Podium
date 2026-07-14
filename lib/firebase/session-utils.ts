import { db } from './config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { RoomServiceClient } from 'livekit-server-sdk';

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
 * Also disconnects all participants from the LiveKit room.
 */
export const endSession = async (sessionId: string): Promise<void> => {
    const sessionRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionRef, {
        status: 'ended',
        isActive: false,
        endedAt: serverTimestamp(),
    });

    // Disconnect all participants from the LiveKit room
    try {
        const livekitUrl = process.env.LIVEKIT_API_URL || (process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace('wss://', 'https://').replace('ws://', 'http://') + ':7880');
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        if (livekitUrl && apiKey && apiSecret) {
            const client = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
            const roomName = `podium_${sessionId}`;
            await client.deleteRoom(roomName);
        }
    } catch (err) {
        console.error('[endSession] Failed to delete LiveKit room:', err);
    }
};
