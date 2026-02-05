'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { Session, Transaction, AttendanceLog } from '@/lib/firebase/types';
import { initializePayment } from '@/lib/payments/initializePayment';
import { isMeetingCode, normalizeCode } from '@/lib/meetingCode';
import { Trash2, Video, ArrowRight, History, X } from 'lucide-react';

export default function StudentDashboard() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<Transaction[]>([]);
    const [processingPayment, setProcessingPayment] = useState<string | null>(null);

    // 1. Listen to Payments to determine Enrolled Classes
    useEffect(() => {
        if (!user || profile?.role !== 'student') return;

        const paymentsRef = collection(db, 'transactions');
        const qPayments = query(
            paymentsRef,
            where('userId', '==', user.uid),
            where('status', '==', 'succeeded')
        );

        const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
            // Filter out hidden payments client-side
            const paymentsData = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Transaction))
                .filter(p => !p.isHidden);

            setPayments(paymentsData);
            if (snapshot.empty) setLoading(false);
        });

        return () => unsubscribePayments();
    }, [user, profile]);

    // 2. Fetch Sessions corresponding to Payments (Enrolled Classes)
    useEffect(() => {
        const fetchEnrolledSessions = async () => {
            if (payments.length === 0) {
                setSessions([]);
                return;
            }

            try {
                // Fetch details for each session the user has paid for
                const sessionIds = Array.from(new Set(payments.map(p => p.sessionId)));

                const sessionPromises = sessionIds.map(id => getDoc(doc(db, 'sessions', id)));
                const sessionSnaps = await Promise.all(sessionPromises);

                const enrolledSessions = sessionSnaps
                    .filter(snap => snap.exists())
                    .map(snap => ({
                        id: snap.id,
                        ...snap.data(),
                    })) as Session[];

                // Sort by desc createdAt if available
                setSessions(enrolledSessions.sort((a, b) => {
                    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return timeB - timeA;
                }));
            } catch (error) {
                console.error("Error fetching enrolled sessions:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEnrolledSessions();
    }, [payments]);

    // New Function: Remove (Hide) Class
    const handleRemoveClass = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        if (!confirm('Are you sure you want to remove this class from your dashboard? You can rejoin later via link.')) return;

        try {
            // Find the transaction(s) for this session
            const transaction = payments.find(p => p.sessionId === sessionId);
            if (!transaction) return;

            // Update transaction to hidden
            await updateDoc(doc(db, 'transactions', transaction.id), {
                isHidden: true
            });

            // UI will update automatically via listener
        } catch (error) {
            console.error('Error removing class:', error);
            alert('Failed to remove class');
        }
    };


    const handlePayment = async (session: Session) => {
        if (!user) return;

        if (session.isFree) {
            router.push(`/classroom/${session.id}`);
            return;
        }

        setProcessingPayment(session.id);
        try {
            // Initialize Paystack transaction
            const paystackUrl = await initializePayment(user.uid, session.id, session.price, user.email!);
            if (paystackUrl) {
                window.location.href = paystackUrl;
            } else {
                alert('Failed to initialize payment');
            }
        } catch (error) {
            console.error('Payment error:', error);
            alert('Something went wrong with payment');
        } finally {
            setProcessingPayment(null);
        }
    };

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyData, setHistoryData] = useState<AttendanceLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const handleOpenHistory = async () => {
        setShowHistoryModal(true);
        setLoadingHistory(true);
        try {
            const logsRef = collection(db, 'attendance_logs');
            const q = query(
                logsRef,
                where('userId', '==', user?.uid),
                orderBy('joinedAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceLog));
            setHistoryData(logs);
        } catch (error) {
            console.error("Error fetching history:", error);
            alert("Failed to load attendance history.");
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDeleteHistory = async (id: string) => {
        if (!confirm('Are you sure you want to remove this record from your history?')) return;
        try {
            await deleteDoc(doc(db, 'attendance_logs', id));
            setHistoryData(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            console.error('Error deleting history:', error);
            alert('Failed to delete history record.');
        }
    };

    const [joinLink, setJoinLink] = useState('');
    const [joining, setJoining] = useState(false);

    const handleJoinByLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinLink.trim()) return;

        // Ensure user is authenticated before querying
        if (!user) {
            alert('Please sign in to join a class.');
            router.push('/auth/login');
            return;
        }

        setJoining(true);
        try {
            let sessionId = joinLink.trim();

            // Check if input is a meeting code (pod-xxxx-xxxx format)
            if (isMeetingCode(sessionId)) {
                console.log('Detected meeting code format:', sessionId);

                // Query Firestore to find session by meeting code
                const sessionsRef = collection(db, 'sessions');
                const normalizedInput = normalizeCode(sessionId);

                // Format the code properly for exact match
                const formattedCode = `pod-${normalizedInput.slice(0, 4)}-${normalizedInput.slice(4, 8)}`;
                console.log('Searching for meetingCode:', formattedCode);

                // Try exact match with formatted code
                let q = query(sessionsRef, where('meetingCode', '==', formattedCode));
                let querySnapshot = await getDocs(q);

                // If not found, also try the raw input
                if (querySnapshot.empty && sessionId !== formattedCode) {
                    console.log('Trying raw input:', sessionId);
                    q = query(sessionsRef, where('meetingCode', '==', sessionId.toLowerCase()));
                    querySnapshot = await getDocs(q);
                }

                // If still not found, do a scan of all sessions (fallback)
                if (querySnapshot.empty) {
                    console.log('Falling back to scanning all sessions...');
                    const allSessionsSnap = await getDocs(sessionsRef);
                    console.log('Total sessions found:', allSessionsSnap.docs.length);

                    const matchingSession = allSessionsSnap.docs.find(doc => {
                        const data = doc.data();
                        if (data.meetingCode) {
                            const storedNormalized = normalizeCode(data.meetingCode);
                            console.log('Comparing:', normalizedInput, 'with', storedNormalized);
                            return storedNormalized === normalizedInput;
                        }
                        return false;
                    });

                    if (matchingSession) {
                        sessionId = matchingSession.id;
                        console.log('Found session via scan:', sessionId);
                    } else {
                        console.log('No matching session found');
                        alert('Class not found. Please check the meeting code.');
                        setJoining(false);
                        return;
                    }
                } else {
                    sessionId = querySnapshot.docs[0].id;
                    console.log('Found session via query:', sessionId);
                }
            } else if (joinLink.includes('/classroom/')) {
                // Extract ID from full link
                sessionId = joinLink.split('/classroom/')[1].split('?')[0];
            }
            // Otherwise, assume it's a direct session ID

            // 1. Check if already enrolled (in local state)
            const enrolledSession = sessions.find(s => s.id === sessionId);
            if (enrolledSession) {
                router.push(`/classroom/${sessionId}`);
                return;
            }

            // 2. Fetch from DB if not enrolled
            const sessionRef = doc(db, 'sessions', sessionId);
            const sessionSnap = await getDoc(sessionRef);

            if (sessionSnap.exists()) {
                const sessionData = { id: sessionSnap.id, ...sessionSnap.data() } as Session;

                // Check if Free -> Join immediately (and enroll if needed)
                if (sessionData.isFree) {
                    // Create enrollment transaction if it doesn't exist
                    // This ensures it shows up in "Enrolled Classes" immediately
                    const transactionsRef = collection(db, 'transactions');
                    const qExisting = query(
                        transactionsRef,
                        where('userId', '==', user!.uid),
                        where('sessionId', '==', sessionId)
                    );
                    const existingSnap = await getDocs(qExisting);

                    if (existingSnap.empty) {
                        try {
                            await addDoc(collection(db, 'transactions'), {
                                userId: user!.uid,
                                sessionId: sessionId,
                                amount: 0,
                                currency: 'GHS',
                                paystackReference: `free_${sessionId}_${user!.uid}_${Date.now()}`,
                                paymentChannel: 'auto_enroll',
                                status: 'succeeded',
                                email: user!.email || '',
                                createdAt: new Date(), // Using native Date, firebase will convert
                                paidAt: new Date(),
                                isHidden: false
                            });
                            console.log('Auto-enrolled in free class via dashboard');
                        } catch (e) {
                            console.error('Error auto-enrolling:', e);
                        }
                    } else {
                        // Unhide if it was hidden
                        const hiddenDoc = existingSnap.docs.find(d => d.data().isHidden);
                        if (hiddenDoc) {
                            await updateDoc(hiddenDoc.ref, { isHidden: false });
                        }
                    }

                    router.push(`/classroom/${sessionId}`);
                } else {
                    // Paid -> Trigger Payment
                    // Check if user has ANY successful transaction for this session (even if hidden)
                    const transactionsRef = collection(db, 'transactions');
                    const qExisting = query(
                        transactionsRef,
                        where('userId', '==', user!.uid),
                        where('sessionId', '==', sessionId),
                        where('status', '==', 'succeeded')
                    );

                    const querySnapshot = await getDocs(qExisting);

                    if (!querySnapshot.empty) {
                        // User has paid before.
                        // If it was hidden, unhide it so it shows up in dashboard again
                        const docRef = querySnapshot.docs[0].ref;
                        await updateDoc(docRef, { isHidden: false }); // Optional: auto-unhide on rejoin

                        router.push(`/classroom/${sessionId}`);
                    } else {
                        // Really needs to pay
                        await handlePayment(sessionData);
                    }
                }
            } else {
                alert("Class not found. Please check the link.");
            }

        } catch (err) {
            console.error(err);
            alert("Invalid link or session");
        } finally {
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600/30 border-t-blue-600"></div>
            </div>
        );
    }

    const activeSessions = sessions.filter(s => s.isActive);

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Header / Welcome */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Welcome back, {profile?.fullName?.split(' ')[0]}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Enter a meeting code or link to join a class.
                </p>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleOpenHistory}
                    className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold transition-colors flex items-center gap-2"
                >
                    <History className="w-5 h-5" />
                    Class History
                </button>
            </div>

            {/* Join by Link Section */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Join a Class</h2>
                <form onSubmit={handleJoinByLink} className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={joinLink}
                            onChange={(e) => setJoinLink(e.target.value)}
                            placeholder="Enter meeting code (pod-xxxx-xxxx) or link..."
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        />
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                            Example: pod-ab3k-9xmz
                        </p>
                    </div>
                    <button
                        type="submit"
                        disabled={joining || !joinLink}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {joining ? 'Checking...' : 'Join Class'}
                        {!joining && <ArrowRight className="w-4 h-4" />}
                    </button>
                </form>
            </div>

            {/* Enrolled Classes List */}
            {sessions.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Your Enrolled Classes</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {sessions.map((session) => (
                            <div key={session.id} className="group bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors relative">
                                <button
                                    onClick={(e) => handleRemoveClass(session.id, e)}
                                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    title="Remove class"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>

                                <div className="flex justify-between items-start mb-4 pr-8">
                                    <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${session.isActive
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                        }`}>
                                        {session.isActive ? '● Live' : 'Scheduled'}
                                    </div>
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                        <Video className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">{session.title}</h3>

                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    <span>Video Class</span>
                                    <span>•</span>
                                    <span className="text-green-600 dark:text-green-400 font-medium">Enrolled</span>
                                </div>

                                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                    <button
                                        onClick={() => router.push(`/classroom/${session.id}`)}
                                        className={`w-full py-2.5 rounded-lg font-semibold transition-colors ${session.isActive
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                    >
                                        {session.isActive ? 'Join Live Class' : 'Enter Classroom'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State if no enrolled classes */}
            {sessions.length === 0 && !loading && (
                <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Video className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">You haven't enrolled in any classes yet.</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Use the form above to join a class with a meeting code.</p>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowHistoryModal(false)} />
                    <div className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 flex-shrink-0">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <History className="w-6 h-6 text-blue-600" />
                                Class History
                            </h2>
                            <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0">
                            {loadingHistory ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600/30 border-t-blue-600"></div>
                                </div>
                            ) : historyData.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    No class history found.
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                        <tr>
                                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Class</th>
                                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Date Joined</th>
                                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Time</th>
                                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {historyData.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <td className="p-4">
                                                    <div className="font-medium text-gray-900 dark:text-white">
                                                        {item.sessionTitle || 'Unknown Class'}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-gray-700 dark:text-gray-300">
                                                    {item.joinedAt?.toDate ? item.joinedAt.toDate().toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                                                    {item.joinedAt?.toDate ? item.joinedAt.toDate().toLocaleTimeString() : 'N/A'}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => handleDeleteHistory(item.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Delete from history"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
