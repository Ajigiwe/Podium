import { db } from '../firebase/config';
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
        console.error('Error checking payment status:', error);
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
        console.error('Error fetching transactions:', error);
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
        console.error('Error fetching session revenue:', error);
        return {
            totalRevenue: 0,
            transactionCount: 0,
            transactions: [],
        };
    }
}
