'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc, getDocs } from 'firebase/firestore'; // Removed addDoc as student doesn't create
import { Session, Transaction } from '@/lib/firebase/types';
import { initializePayment } from '@/lib/payments/initializePayment';
import { Trash2 } from 'lucide-react';
// Imports updated

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
                // Note: unique sessionIDs in case of duplicate payments
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

    const [joinLink, setJoinLink] = useState('');
    const [joining, setJoining] = useState(false);

    const handleJoinByLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinLink.trim()) return;

        setJoining(true);
        try {
            // Extract ID from link or use ID directly
            let sessionId = joinLink.trim();
            if (joinLink.includes('/classroom/')) {
                sessionId = joinLink.split('/classroom/')[1].split('?')[0];
            }

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

                // Check if Free -> Join immediately
                if (sessionData.isFree) {
                    router.push(`/classroom/${sessionId}`);
                } else {
                    // Paid -> Trigger Payment
                    // Check if user has ANY successful transaction for this session (even if hidden)
                    // We query Firestore directly to be sure, as local state 'payments' filters out hidden ones.
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
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600/30 border-t-indigo-600"></div>
            </div>
        );
    }

    const activeSessions = sessions.filter(s => s.isActive);

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Header / Welcome */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                        Welcome back, {profile?.fullName?.split(' ')[0]} 🚀
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-2 font-medium">
                        Enter a class link to join or view your enrolled classes.
                    </p>
                </div>
            </div>

            {/* Join by Link Section */}
            <div className="bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 p-8 rounded-3xl shadow-xl">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Join a Class</h2>
                <form onSubmit={handleJoinByLink} className="flex flex-col sm:flex-row gap-4">
                    <input
                        type="text"
                        value={joinLink}
                        onChange={(e) => setJoinLink(e.target.value)}
                        placeholder="Paste class link or ID here..."
                        className="flex-1 px-6 py-4 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-lg"
                    />
                    <button
                        type="submit"
                        disabled={joining || !joinLink}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {joining ? 'Checking...' : 'Join Class'}
                    </button>
                </form>
            </div>

            {/* Enrolled Classes List (Restricted View) */}
            {sessions.length > 0 && (
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Your Enrolled Classes</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {sessions.map((session) => {
                            // Logic for Enrolled Classes (User has access)
                            return (
                                <div key={session.id} className="group bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 border border-white/20 dark:border-white/5 transition-all duration-300 flex flex-col hover:-translate-y-1 relative">
                                    <button
                                        onClick={(e) => handleRemoveClass(session.id, e)}
                                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                                        title="Remove class"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>

                                    <div className="flex justify-between items-start mb-6 pr-8">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${session.isActive
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                            }`}>
                                            {session.isActive ? '● Live Now' : 'Scheduled'}
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center shadow-sm">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{session.title}</h3>

                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
                                        <span>Video Class</span>
                                        <span>•</span>
                                        <span className="text-green-600 dark:text-green-400 font-medium">Enrolled</span>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/5">
                                        <button
                                            onClick={() => router.push(`/classroom/${session.id}`)}
                                            className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${session.isActive
                                                ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-700 hover:to-pink-700 shadow-red-500/25'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/25'
                                                }`}
                                        >
                                            {session.isActive ? 'Join Live Class' : 'Enter Classroom'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty State if no enrolled classes */}
            {sessions.length === 0 && !loading && (
                <div className="text-center py-20 opacity-50">
                    <p className="text-gray-500">You haven't enrolled in any classes yet.</p>
                </div>
            )}
        </div>
    );
}
