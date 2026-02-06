'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // Added useSearchParams
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { Session, Transaction, AttendanceLog, SystemSettings } from '@/lib/firebase/types';
import { initializeSubscription } from '@/lib/payments/initializeSubscription';
import { isMeetingCode, normalizeCode } from '@/lib/meetingCode';
import { Trash2, Video, ArrowRight, History, X, CreditCard, Lock, CheckCircle } from 'lucide-react';

import { Suspense } from 'react';

function StudentDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, profile } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<Transaction[]>([]); // "Enrolled" classes
    const [joining, setJoining] = useState(false);
    const [joinLink, setJoinLink] = useState('');

    // Subscription State
    const [semesterFee, setSemesterFee] = useState<number>(200);
    const [currency, setCurrency] = useState('GHS');
    const [initializingSub, setInitializingSub] = useState(false);

    // Check for success param from redirect
    useEffect(() => {
        if (searchParams.get('subscription') === 'success') {
            // Ideally we show a success message or confetti
            // The profile update happens via webhook, so we rely on AuthContext to reflect the change eventually
            // Use window.location to force a reload if needed, but onSnapshot in AuthContext should handle it
            router.replace('/dashboard/student');
        }
    }, [searchParams, router]);

    // 1. Fetch System Settings (Fee)
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'system_settings', 'subscription'));
                if (docSnap.exists()) {
                    const data = docSnap.data() as SystemSettings;
                    setSemesterFee(data.semesterFee);
                    setCurrency(data.currency);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        };
        fetchSettings();
    }, []);

    // 2. Listen to "Enrolled" Classes (Transactions table, but now just tracks list)
    useEffect(() => {
        if (!user || profile?.role !== 'student') return;

        const paymentsRef = collection(db, 'transactions');
        // We still use 'transactions' to track "My Classes", looking for amount 0 or 'subscription_access'
        // Or just ALL transactions for this user that are not hidden
        const qPayments = query(
            paymentsRef,
            where('userId', '==', user.uid),
            where('isHidden', '==', false)
            // We don't filter by status='succeeded' strictly if we use amount 0, but good practice
        );

        const unsubscribe = onSnapshot(qPayments, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
            setPayments(data);
            if (snapshot.empty) setLoading(false);
        });

        return () => unsubscribe();
    }, [user, profile]);

    // 3. Fetch Session Details for Enrolled Classes
    useEffect(() => {
        const fetchEnrolledSessions = async () => {
            if (payments.length === 0) {
                setSessions([]);
                setLoading(false);
                return;
            }

            try {
                const sessionIds = Array.from(new Set(payments.map(p => p.sessionId)));
                const sessionPromises = sessionIds.map(id => getDoc(doc(db, 'sessions', id)));
                const sessionSnaps = await Promise.all(sessionPromises);

                const enrolledSessions = sessionSnaps
                    .filter(snap => snap.exists())
                    .map(snap => ({ id: snap.id, ...snap.data() })) as Session[];

                setSessions(enrolledSessions.sort((a, b) => {
                    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return timeB - timeA;
                }));
            } catch (error) {
                console.error("Error fetching sessions:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEnrolledSessions();
    }, [payments]);

    // === Handlers ===

    const handlePaySubscription = async () => {
        if (!user || !user.email) return;
        setInitializingSub(true);
        try {
            // Call our new helper
            const url = await initializeSubscription(user.uid, user.email);
            if (url) {
                window.location.href = url;
            } else {
                alert("Failed to initialize payment. Please try again.");
            }
        } catch (error) {
            console.error("Subscription error:", error);
            alert("An error occurred.");
        } finally {
            setInitializingSub(false);
        }
    };

    const handleJoinByLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinLink.trim()) return;
        if (!user) {
            router.push('/auth/login');
            return;
        }

        // BLOCKER: Check Subscription
        if (profile?.subscriptionStatus !== 'active') {
            alert("You must activate your semester subscription to join classes.");
            return;
        }

        setJoining(true);
        try {
            let sessionId = joinLink.trim();

            // Resolve Meeting Code / Link (Same logic as before)
            if (isMeetingCode(sessionId)) {
                const sessionsRef = collection(db, 'sessions');
                const normalizedInput = normalizeCode(sessionId);
                const formattedCode = `pod-${normalizedInput.slice(0, 4)}-${normalizedInput.slice(4, 8)}`;

                let q = query(sessionsRef, where('meetingCode', '==', formattedCode));
                let querySnapshot = await getDocs(q);

                if (querySnapshot.empty && sessionId !== formattedCode) {
                    q = query(sessionsRef, where('meetingCode', '==', sessionId.toLowerCase()));
                    querySnapshot = await getDocs(q);
                }

                if (querySnapshot.empty) {
                    // Scan fallback
                    const allSessionsSnap = await getDocs(sessionsRef);
                    const matchingSession = allSessionsSnap.docs.find(doc => {
                        const data = doc.data();
                        return data.meetingCode && normalizeCode(data.meetingCode) === normalizedInput;
                    });
                    if (matchingSession) {
                        sessionId = matchingSession.id;
                    } else {
                        alert('Class not found. Please check the meeting code.');
                        setJoining(false);
                        return;
                    }
                } else {
                    sessionId = querySnapshot.docs[0].id;
                }
            } else if (joinLink.includes('/classroom/')) {
                sessionId = joinLink.split('/classroom/')[1].split('?')[0];
            }

            // Check details
            const sessionRef = doc(db, 'sessions', sessionId);
            const sessionSnap = await getDoc(sessionRef);

            if (!sessionSnap.exists()) {
                alert("Class not found.");
                return;
            }

            // === ENROLLMENT LOGIC (Simplified) ===
            // Since subscription is active, we just add them to "My Classes" (transactions) if not already there
            const alreadyEnrolled = payments.some(p => p.sessionId === sessionId);
            if (!alreadyEnrolled) {
                try {
                    await addDoc(collection(db, 'transactions'), {
                        userId: user.uid,
                        sessionId: sessionId,
                        amount: 0,
                        currency: 'GHS',
                        paystackReference: `sub_access_${sessionId}_${user.uid}_${Date.now()}`,
                        paymentChannel: 'subscription_access',
                        status: 'succeeded', // Auto-success
                        email: user.email || '',
                        isHidden: false,
                        createdAt: new Date(),
                        paidAt: new Date()
                    });
                } catch (err) {
                    console.error("Error creating enrollment record:", err);
                }
            } else {
                // If hidden, unhide
                const hiddenTx = payments.find(p => p.sessionId === sessionId && p.isHidden); // wait payments state filters out hidden...
                // Only if we fetched ALL including hidden. 
                // Let's do a quick DB check to be safe if local state excludes hidden
                const qExisting = query(
                    collection(db, 'transactions'),
                    where('userId', '==', user.uid),
                    where('sessionId', '==', sessionId)
                );
                const existingSnap = await getDocs(qExisting);
                const hiddenDoc = existingSnap.docs.find(d => d.data().isHidden);
                if (hiddenDoc) {
                    await updateDoc(hiddenDoc.ref, { isHidden: false });
                }
            }

            // Redirect
            router.push(`/classroom/${sessionId}`);

        } catch (err) {
            console.error(err);
            alert("Invalid link or session");
        } finally {
            setJoining(false);
        }
    };

    const handleRemoveClass = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Remove this class from your dashboard?')) return;
        try {
            // Find transaction in local state (filtered) or DB
            const q = query(collection(db, 'transactions'), where('userId', '==', user!.uid), where('sessionId', '==', sessionId));
            const snap = await getDocs(q);
            snap.forEach(async (d) => {
                await updateDoc(d.ref, { isHidden: true });
            });
        } catch (error) {
            console.error('Error removing class:', error);
        }
    };

    // Use local helper for history logic (same as before, omitted detail for brevity but keeping implementation)
    // ... Actually I need to keep the full implementation to avoid breaking it.

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyData, setHistoryData] = useState<AttendanceLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const handleOpenHistory = async () => {
        setShowHistoryModal(true);
        setLoadingHistory(true);
        try {
            const logsRef = collection(db, 'attendance_logs');
            const q = query(logsRef, where('userId', '==', user?.uid), orderBy('joinedAt', 'desc'));
            const snapshot = await getDocs(q);
            setHistoryData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceLog)));
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDeleteHistory = async (id: string) => {
        if (!confirm('Remove record?')) return;
        try {
            await deleteDoc(doc(db, 'attendance_logs', id));
            setHistoryData(prev => prev.filter(item => item.id !== id));
        } catch (e) {
            console.error(e);
        }
    };


    // === RENDER ===

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600/30 border-t-blue-600"></div>
            </div>
        );
    }

    const isSubscribed = profile?.subscriptionStatus === 'active';

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Welcome back, {profile?.fullName?.split(' ')[0]}
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${isSubscribed
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                            {isSubscribed ? <CheckCircle className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            {isSubscribed ? 'Semester Active' : 'Subscription Required'}
                        </span>
                    </div>
                </div>

                <button
                    onClick={handleOpenHistory}
                    className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold transition-colors flex items-center gap-2"
                >
                    <History className="w-5 h-5" />
                    Class History
                </button>
            </div>

            {/* SUBSCRIPTION BANNER (Blocked State) */}
            {!isSubscribed && (
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <CreditCard className="w-64 h-64" />
                    </div>

                    <div className="relative z-10 max-w-2xl">
                        <h2 className="text-2xl font-bold mb-4">Activate Your Semester Access</h2>
                        <p className="text-blue-100 text-lg mb-8 leading-relaxed">
                            To join classes, please activate your subscription for this semester.
                            This one-time payment grants you unlimited access to all your courses for 4 months.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <button
                                onClick={handlePaySubscription}
                                disabled={initializingSub}
                                className="w-full sm:w-auto px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg disabled:opacity-75 flex items-center justify-center gap-2"
                            >
                                {initializingSub ? (
                                    <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                                ) : (
                                    <>
                                        Pay {currency} {semesterFee}
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                            <p className="text-sm text-blue-200 font-medium">
                                Secure payment via Paystack
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* JOIN CLASS (Only visible if subscribed) */}
            {isSubscribed && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-xl shadow-sm transition-all">
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
            )}

            {/* ENROLLED CLASSES (Always visible if they have history, but maybe grayed out? No, keep visible) */}
            {sessions.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Your Recent Classes</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {sessions.map((session) => (
                            <div key={session.id} className={`group bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors relative ${!isSubscribed ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                                <button
                                    onClick={(e) => handleRemoveClass(session.id, e)}
                                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    title="Remove from list"
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

                                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                                    <button
                                        onClick={() => {
                                            if (!isSubscribed) {
                                                alert("Please activate your subscription first.");
                                                return;
                                            }
                                            router.push(`/classroom/${session.id}`);
                                        }}
                                        className={`w-full py-2.5 rounded-lg font-semibold transition-colors ${session.isActive
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                            } ${!isSubscribed ? 'cursor-not-allowed opacity-50' : ''}`}
                                    >
                                        {session.isActive ? 'Join Live Class' : 'Enter Classroom'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* History Modal (Same as before) */}
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

export default function StudentDashboard() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600/30 border-t-blue-600"></div>
            </div>
        }>
            <StudentDashboardContent />
        </Suspense>
    );
}
