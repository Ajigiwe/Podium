'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, addDoc, updateDoc, collection, Timestamp } from 'firebase/firestore';
import { Session } from '@/lib/firebase/types';
import { hasUserPaid } from '@/lib/payments/verifyPayment';
import ClassroomContent from '@/components/ClassroomContent';
import { useClassroom } from '@/contexts/ClassroomContext';

export default function ClassroomPage() {
    const params = useParams();
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const { joinClass, sessionId: currentSessionId } = useClassroom();
    const sessionId = params.id as string;

    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [canAccess, setCanAccess] = useState(false);

    // Profile Modal State (Only for joining)
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [studentName, setStudentName] = useState('');
    const [studentIndex, setStudentIndex] = useState('');
    const [submittingProfile, setSubmittingProfile] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        if (!user || !profile) {
            const currentPath = window.location.pathname + window.location.search;
            router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
            return;
        }

        const loadSession = async () => {
            try {
                // Get session details
                const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
                if (!sessionDoc.exists()) {
                    alert('Session not found');
                    router.push('/');
                    return;
                }

                const sessionData = { id: sessionDoc.id, ...sessionDoc.data() } as Session;
                setSession(sessionData);

                // Check access
                const isLecturer = profile.role === 'lecturer' && sessionData.lecturerId === user.uid;
                let hasPaidAccess = sessionData.isFree || (await hasUserPaid(user.uid, sessionId));

                // If it's a free class and user hasn't "paid" (enrolled), create a $0 transaction so it shows on dashboard
                if (sessionData.isFree && !hasPaidAccess && profile.role === 'student' && !isLecturer) {
                    try {
                        await addDoc(collection(db, 'transactions'), {
                            userId: user.uid,
                            sessionId: sessionId,
                            amount: 0,
                            reference: `free_${sessionId}_${user.uid}`,
                            status: 'succeeded',
                            email: user.email,
                            createdAt: Timestamp.now(),
                            isHidden: false
                        });
                        hasPaidAccess = true;
                    } catch (e) {
                        console.error("Failed to enroll in free class", e);
                    }
                }

                if (!isLecturer && !hasPaidAccess) {
                    const searchParams = new URLSearchParams(window.location.search);
                    const reference = searchParams.get('reference');

                    if (reference) {
                        try {
                            const verifyRes = await fetch(`/api/paystack/verify?reference=${reference}`);
                            const verifyData = await verifyRes.json();

                            if (verifyRes.ok && verifyData.success) {
                                setCanAccess(true);
                                setLoading(false);
                                return;
                            }
                        } catch (err) {
                            console.error("Manual verification failed", err);
                        }
                    }

                    alert('You need to pay to access this class');
                    router.push('/dashboard/student');
                    return;
                }

                // Check if student profile is complete (Name & Index Number)
                if (profile.role === 'student') {
                    if (!profile.fullName || !profile.indexNumber) {
                        setStudentName(profile.fullName || '');
                        setShowProfileModal(true);
                        setLoading(false);
                        return; // Stop here, wait for modal submit
                    }

                    // Log attendance
                    await addDoc(collection(db, 'attendance_logs'), {
                        sessionId,
                        userId: user.uid,
                        userName: profile.fullName,
                        userIndexNumber: profile.indexNumber,
                        joinedAt: Timestamp.now(),
                    });
                }

                setCanAccess(true);

                // Connection Logic - Only connect if not already connected to this session
                if (currentSessionId !== sessionId) {
                    const roomName = sessionData.id;
                    try {
                        const resp = await fetch(
                            `/api/livekit/token?room=${roomName}&username=${encodeURIComponent(profile.fullName)}&role=${profile.role}`
                        );
                        const data = await resp.json();
                        if (data.token) {
                            joinClass(sessionId, data.token, sessionData.title);
                        } else {
                            console.error('Failed to get token:', data.error);
                            alert('Failed to connect to video server');
                        }
                    } catch (e) {
                        console.error(e);
                        alert('Failed to connect to video server');
                    }
                }

                setLoading(false);
            } catch (error) {
                console.error('Error loading session:', error);
                alert('Failed to load session');
                router.push('/');
            }
        };

        loadSession();
    }, [user, profile, sessionId, router, authLoading, currentSessionId, joinClass]);

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !studentName.trim() || !studentIndex.trim()) return;

        setSubmittingProfile(true);
        try {
            await updateDoc(doc(db, 'profiles', user.uid), {
                fullName: studentName,
                indexNumber: studentIndex,
                updatedAt: Timestamp.now()
            });

            await addDoc(collection(db, 'attendance_logs'), {
                sessionId,
                userId: user.uid,
                userName: studentName,
                userIndexNumber: studentIndex,
                joinedAt: Timestamp.now(),
            });

            setCanAccess(true);
            setShowProfileModal(false);

            // Connect after profile update
            const roomName = session?.id || sessionId;
            try {
                const resp = await fetch(
                    `/api/livekit/token?room=${roomName}&username=${encodeURIComponent(studentName)}&role=${profile?.role || 'student'}`
                );
                const data = await resp.json();
                if (data.token) {
                    joinClass(sessionId, data.token, session?.title);
                }
            } catch (e) { console.error("Error refreshing token", e); }

        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to save details. Please try again.");
        } finally {
            setSubmittingProfile(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white mx-auto"></div>
                    <p className="mt-4 text-white text-lg font-medium">Loading classroom...</p>
                </div>
            </div>
        );
    }

    if (!session || (!canAccess && !showProfileModal)) {
        return null; // Or access denied screen
    }

    return (
        <>
            {showProfileModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Student Details</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Please enter your details to join the class.
                        </p>
                        <form onSubmit={handleProfileSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={studentName}
                                    onChange={(e) => setStudentName(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Index Number</label>
                                <input
                                    type="text"
                                    required
                                    value={studentIndex}
                                    onChange={(e) => setStudentIndex(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submittingProfile}
                                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                                {submittingProfile ? 'Saving...' : 'Join Class'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {!showProfileModal && (
                <ClassroomContent
                    session={session}
                    user={user}
                    profile={profile}
                    sessionId={sessionId}
                />
            )}
        </>
    );
}
