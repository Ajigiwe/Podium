'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp,
} from 'firebase/firestore';
import { Session } from '@/lib/firebase/types';
import { getSessionRevenue } from '@/lib/payments/verifyPayment';
import ThemeToggle from '@/components/ThemeToggle';

export default function LecturerDashboard() {
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [revenueData, setRevenueData] = useState<Record<string, any>>({});

    // Form state
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [isFree, setIsFree] = useState(false);


    useEffect(() => {
        if (authLoading) return;

        if (!user || profile?.role !== 'lecturer') {
            router.push('/auth/login');
            return;
        }

        // Subscribe to lecturer's sessions
        const sessionsRef = collection(db, 'sessions');
        const q = query(sessionsRef, where('lecturerId', '==', user.uid));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const sessionsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Session[];

            console.log('Fetched sessions:', sessionsData.map(s => ({ id: s.id, lecturerId: s.lecturerId })));

            setSessions(sessionsData);

            // Fetch revenue for each session
            const revenue: Record<string, any> = {};
            for (const session of sessionsData) {
                revenue[session.id] = await getSessionRevenue(session.id);
            }
            setRevenueData(revenue);

            setLoading(false);
        }, (error) => {
            console.error("Error fetching sessions:", error);
            setLoading(false);
            if (error.code === 'permission-denied') {
                alert("Error: You do not have permission to view these sessions.");
            }
        });

        return () => unsubscribe();
    }, [user, profile, authLoading, router]);

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            const priceInPesewas = isFree ? 0 : Math.round(parseFloat(price) * 100);

            await addDoc(collection(db, 'sessions'), {
                title,
                lecturerId: user.uid,
                isActive: false,
                price: priceInPesewas,
                currency: 'GHS',
                isFree,
                createdAt: Timestamp.now(),
            });

            // Reset form
            setTitle('');
            setPrice('');
            setIsFree(false);

            setShowCreateModal(false);
        } catch (error) {
            console.error('Error creating session:', error);
            alert('Failed to create session');
        }
    };

    const handleToggleActive = async (sessionId: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, 'sessions', sessionId), {
                isActive: !currentStatus,
            });
        } catch (error) {
            console.error('Error toggling session status:', error);
        }
    };



    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to delete this session?')) return;

        console.log('Attempting to delete session:', sessionId);
        const sessionToDelete = sessions.find(s => s.id === sessionId);
        console.log('Session data:', sessionToDelete);
        console.log('Current user:', user?.uid);

        if (sessionToDelete?.lecturerId !== user?.uid) {
            console.error('Mismatch in lecturerId:', sessionToDelete?.lecturerId, 'vs', user?.uid);
            alert('Error: You do not appear to be the owner of this session.');
            return;
        }

        try {
            await deleteDoc(doc(db, 'sessions', sessionId));
            console.log('Session deleted successfully');
        } catch (error: any) {
            console.error('Error deleting session:', error);
            alert(`Failed to delete session: ${error.message} (Code: ${error.code})`);
        }
    };

    const handleCopyLink = (sessionId: string) => {
        const link = `${window.location.origin}/classroom/${sessionId}`;
        navigator.clipboard.writeText(link);
        alert("Class link copied to clipboard!");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600/30 border-t-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Header / Welcome */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                        Good afternoon, {profile?.fullName?.split(' ')[0]} 👋
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-2 font-medium">
                        Here's what's happening with your classes today.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                    <span className="text-xl leading-none">+</span>
                    Create New Class
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-6 shadow-sm border border-white/20 dark:border-white/5 flex items-center justify-between ring-1 ring-black/5">
                    <div>
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Classes</p>
                        <p className="text-5xl font-black text-gray-900 dark:text-white mt-2">{sessions.length}</p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                </div>
                <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-6 shadow-sm border border-white/20 dark:border-white/5 flex items-center justify-between ring-1 ring-black/5">
                    <div>
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Now</p>
                        <p className="text-5xl font-black text-gray-900 dark:text-white mt-2">{sessions.filter(s => s.isActive).length}</p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Sessions Grid */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Your Sessions</h2>

                {sessions.length === 0 ? (
                    <div className="text-center py-20 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No classes yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">Create your first class to start streaming to your students.</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 font-medium transition-colors"
                        >
                            Create Class
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {sessions.map((session) => {
                            const priceInCedis = session.price / 100;

                            return (
                                <div key={session.id} className="group bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 border border-white/20 dark:border-white/5 transition-all duration-300">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${session.isActive
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                            }`}>
                                            {session.isActive ? '● Live Now' : 'Offline'}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleCopyLink(session.id)}
                                                className="p-2 text-gray-400 hover:text-indigo-500 transition-colors bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"
                                                title="Copy Link"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSession(session.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"
                                                title="Delete Class"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{session.title}</h3>

                                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
                                        <span className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            Video Class
                                        </span>
                                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                        <span className={`font-medium ${session.isFree ? 'text-green-600 dark:text-green-400' : ''}`}>
                                            {session.isFree ? 'Free' : `GH₵ ${priceInCedis.toFixed(2)}`}
                                        </span>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleToggleActive(session.id, session.isActive)}
                                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-lg ${session.isActive
                                                ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                : 'bg-gradient-to-r from-gray-900 to-gray-800 dark:from-white dark:to-gray-200 text-white dark:text-gray-900 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed'
                                                }`}
                                        >
                                            {session.isActive ? 'Stop Stream' : 'Go Live'}
                                        </button>

                                        {session.isActive && (
                                            <button
                                                onClick={() => router.push(`/classroom/${session.id}`)}
                                                className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                            >
                                                Join
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Session Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                    <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Class</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreateSession} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Class Title</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                    placeholder="e.g. Advanced Mathematics"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl cursor-pointer border border-transparent hover:border-indigo-500 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={isFree}
                                        onChange={(e) => setIsFree(e.target.checked)}
                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                    />
                                    <span className="font-bold text-gray-700 dark:text-gray-300">This class is free</span>
                                </label>
                            </div>

                            {!isFree && (
                                <div className="animate-in slide-in-from-top-2 duration-200">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Price (GHS)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3.5 text-gray-400 font-bold">₵</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            required={!isFree}
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            )}



                            <button
                                type="submit"
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 transition-all text-lg"
                            >
                                Create Class
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
