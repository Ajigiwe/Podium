import { db } from './config';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, increment } from 'firebase/firestore';
import { RoomServiceClient } from 'livekit-server-sdk';

/**
 * Soft-deletes a session by setting its status to 'deleted'.
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
 * Ends a session. If it lasted less than 30 minutes (and was started),
 * refunds the per-class fee to all student wallets.
 */
export const endSession = async (sessionId: string): Promise<void> => {
    const sessionRef = doc(db, 'sessions', sessionId);

    // Fetch session to check duration
    const { getDoc } = await import('firebase/firestore');
    const sessionSnap = await getDoc(sessionRef);
    const sessionData = sessionSnap.data();

    const now = new Date();
    let shouldRefund = false;

    if (sessionData?.startedAt) {
        const startedAt = sessionData.startedAt.toDate();
        const elapsedMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);
        console.log(`[endSession] Session lasted ${elapsedMinutes.toFixed(1)} minutes`);
        if (elapsedMinutes < 30) {
            shouldRefund = true;
        }
    }

    // Mark session as ended
    await updateDoc(sessionRef, {
        status: 'ended',
        isActive: false,
        endedAt: serverTimestamp(),
    });

    // Refund wallets if session was too short
    if (shouldRefund) {
        console.log(`[endSession] Session ${sessionId} lasted < 30 min — refunding wallets`);
        try {
            // Get per-class fee from system settings
            const settingsRef = doc(db, 'system_settings', 'subscription');
            const { getDoc: getSettingsDoc } = await import('firebase/firestore');
            const settingsSnap = await getSettingsDoc(settingsRef);
            const perClassFee = settingsSnap.data()?.perClassFee ?? 600; // default GHS 6

            // Find all students who paid for this session
            const txSnap = await getDocs(
                query(
                    collection(db, 'transactions'),
                    where('sessionId', '==', sessionId),
                    where('status', '==', 'succeeded')
                )
            );

            for (const txDoc of txSnap.docs) {
                const tx = txDoc.data();
                if (!tx.userId || tx.userId === 'unknown') continue;

                // Credit wallet back
                const userRef = doc(db, 'profiles', tx.userId);
                await updateDoc(userRef, {
                    walletBalance: increment(perClassFee),
                    updatedAt: serverTimestamp(),
                });

                // Mark transaction as refunded
                await updateDoc(txDoc.ref, {
                    status: 'refunded',
                });

                console.log(`[endSession] Refunded ${perClassFee} pesewas to user ${tx.userId}`);
            }

            // Also refund students who joined but have no transaction record (enrolled via dashboard)
            const attendanceSnap = await getDocs(
                query(
                    collection(db, 'attendance_logs'),
                    where('sessionId', '==', sessionId),
                    where('role', '==', 'student')
                )
            );

            for (const logDoc of attendanceSnap.docs) {
                const log = logDoc.data();
                if (!log.userId) continue;

                // Check if already refunded via transaction
                const alreadyRefunded = txSnap.docs.some(
                    (tx) => tx.data().userId === log.userId && tx.data().status === 'refunded'
                );
                if (alreadyRefunded) continue;

                // Credit wallet
                const userRef = doc(db, 'profiles', log.userId);
                await updateDoc(userRef, {
                    walletBalance: increment(perClassFee),
                    updatedAt: serverTimestamp(),
                });

                console.log(`[endSession] Refunded ${perClassFee} pesewas to attendance user ${log.userId}`);
            }
        } catch (refundError) {
            console.error('[endSession] Error processing refunds:', refundError);
        }
    }

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
