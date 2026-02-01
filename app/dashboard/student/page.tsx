'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'; // Removed addDoc as student doesn't create
import { Session } from '@/lib/firebase/types';
import { initializePayment } from '@/lib/payments/initializePayment';
// Imports updated

export default function StudentDashboard() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<any[]>([]);
    const [processingPayment, setProcessingPayment] = useState<string | null>(null);

    useEffect(() => {
        if (!user || profile?.role !== 'student') {
            // allow redirect to handle
            return;
        }

        // 1. Listen to Sessions
        const sessionsRef = collection(db, 'sessions');
        // We want all sessions
        const q = query(sessionsRef, orderBy('createdAt', 'desc'));

        const unsubscribeSessions = onSnapshot(q, (snapshot) => {
            const sessionsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Session[];
            setSessions(sessionsData);
        });

        // 2. Listen to User's Payments
        const paymentsRef = collection(db, 'transactions');
        const qPayments = query(
            paymentsRef,
            where('userId', '==', user.uid),
            where('status', '==', 'succeeded')
        );

        const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
            const paymentsData = snapshot.docs.map(doc => doc.data());
            setPayments(paymentsData);
            setLoading(false);
        });

        return () => {
            unsubscribeSessions();
            unsubscribePayments();
        };
    }, [user, profile, router]);


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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600/30 border-t-indigo-600"></div>
            </div>
        );
    }

    const activeSessions = sessions.filter(s => s.isActive);

    return (
        <div className="space-y-8">
            {/* Header / Welcome */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Welcome back, {profile?.fullName?.split(' ')[0]} 🚀
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Ready to continue your learning journey?
                </p>
            </div>

            {/* Featured / Continue Learning */}
            {activeSessions.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-black/10 rounded-full blur-3xl"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-sm font-medium backdrop-blur-md mb-4 border border-white/20">
                                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                                Live Now
                            </div>
                            <h2 className="text-3xl font-bold mb-2">{activeSessions[0].title}</h2>
                            <p className="text-white/80 max-w-lg text-lg">
                                Your class is currently in session. Join now to participate in the live lecture.
                            </p>
                        </div>
                        <button
                            onClick={() => router.push(`/classroom/${activeSessions[0].id}`)}
                            className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-bold text-lg hover:bg-gray-50 transform hover:scale-105 transition-all shadow-xl"
                        >
                            Join Class
                        </button>
                    </div>
                </div>
            )}

            {/* Browse Classes */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Available Classes</h2>

                {sessions.length === 0 ? (
                    <div className="text-center py-20 bg-white/50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No classes found</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Check back later for new scheduled sessions.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {sessions.map((session) => {
                            const priceInCedis = session.price / 100;
                            const isEnrolled = payments.some(p => p.sessionId === session.id);

                            return (
                                <div key={session.id} className="group bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-xl border border-gray-100 dark:border-gray-800 transition-all duration-300 flex flex-col">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${session.isActive
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                                            : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                                            }`}>
                                            {session.isActive ? '● Live Now' : 'Scheduled'}
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 flex items-center justify-center">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">{session.title}</h3>

                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
                                        <span>Video Class</span>
                                        <span>•</span>
                                        <span className={`font-medium ${session.isFree ? 'text-green-600 dark:text-green-400' : ''}`}>
                                            {session.isFree ? 'Free' : `GH₵ ${priceInCedis.toFixed(2)}`}
                                        </span>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/50">
                                        {isEnrolled ? (
                                            <button
                                                onClick={() => router.push(`/classroom/${session.id}`)}
                                                disabled={!session.isActive}
                                                className={`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${session.isActive
                                                    ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-700 hover:to-pink-700 shadow-red-500/25'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                                    }`}
                                            >
                                                {session.isActive ? 'Join Class' : 'Waiting for host...'}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handlePayment(session)}
                                                disabled={processingPayment === session.id}
                                                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {processingPayment === session.id
                                                    ? 'Processing...'
                                                    : session.isFree ? 'Join for Free' : 'Pay to Join'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
