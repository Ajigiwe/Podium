import { db, handleFirestoreError } from '../firebase/config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

/**
 * Check if a user has already paid for a specific session
 */
export async function hasUserPaid(
    userId: string,
    sessionId: string
): Promise<boolean> {
    try {
        const transactionsRef = collection(db, 'transactions');
        const q = query(
            transactionsRef,
            where('userId', '==', userId),
            where('sessionId', '==', sessionId),
            where('status', '==', 'succeeded')
        );

        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error('[Payments:Verify] Error checking payment status:', error);
        // Attempt to handle Firestore error and retry
        const handled = await handleFirestoreError(db, error);
        if (handled) {
            try {
                const transactionsRef = collection(db, 'transactions');
                const q = query(
                    transactionsRef,
                    where('userId', '==', userId),
                    where('sessionId', '==', sessionId),
                    where('status', '==', 'succeeded')
                );

                const snapshot = await getDocs(q);
                return !snapshot.empty;
            } catch (retryError) {
                console.error('[Payments:Verify:Retry] Retry failed to check payment status:', retryError);
                return false;
            }
        }
        return false;
    }
}

/**
 * Get user's payment history
 */
export async function getUserTransactions(userId: string) {
    try {
        const transactionsRef = collection(db, 'transactions');
        const q = query(
            transactionsRef,
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error('[Payments:History] Error fetching transactions:', error);
        // Attempt to handle Firestore error and retry
        const handled = await handleFirestoreError(db, error);
        if (handled) {
            try {
                const transactionsRef = collection(db, 'transactions');
                const q = query(
                    transactionsRef,
                    where('userId', '==', userId)
                );

                const snapshot = await getDocs(q);
                return snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
            } catch (retryError) {
                console.error('[Payments:History:Retry] Retry failed to fetch transactions:', retryError);
                return [];
            }
        }
        return [];
    }
}

/**
 * Get session's revenue (lecturer view)
 */
export async function getSessionRevenue(sessionId: string) {
    try {
        const transactionsRef = collection(db, 'transactions');
        const q = query(
            transactionsRef,
            where('sessionId', '==', sessionId),
            where('status', '==', 'succeeded')
        );

        const snapshot = await getDocs(q);
        const transactions = snapshot.docs.map((doc) => doc.data());
        console.log(`Revenue for session ${sessionId}:`, transactions.length, 'transactions');

        const totalRevenue = transactions.reduce(
            (sum, transaction) => sum + (transaction.amount || 0),
            0
        );

        return {
            totalRevenue: totalRevenue / 100, // Convert pesewas to cedis
            transactionCount: transactions.length,
            transactions,
        };
    } catch (error) {
        console.error('[Payments:Revenue] Error fetching session revenue:', error);
        // Attempt to handle Firestore error and retry
        const handled = await handleFirestoreError(db, error);
        if (handled) {
            try {
                const transactionsRef = collection(db, 'transactions');
                const q = query(
                    transactionsRef,
                    where('sessionId', '==', sessionId),
                    where('status', '==', 'succeeded')
                );

                const snapshot = await getDocs(q);
                const transactions = snapshot.docs.map((doc) => doc.data());
                console.log(`Revenue for session ${sessionId}:`, transactions.length, 'transactions');

                const totalRevenue = transactions.reduce(
                    (sum, transaction) => sum + (transaction.amount || 0),
                    0
                );

                return {
                    totalRevenue: totalRevenue / 100, // Convert pesewas to cedis
                    transactionCount: transactions.length,
                    transactions,
                };
            } catch (retryError) {
                console.error('[Payments:Revenue:Retry] Retry failed to fetch session revenue:', retryError);
                return {
                    totalRevenue: 0,
                    transactionCount: 0,
                    transactions: [],
                };
            }
        }
        return {
            totalRevenue: 0,
            transactionCount: 0,
            transactions: [],
        };
    }
}
