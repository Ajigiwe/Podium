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
    const [attendanceSubmitted, setAttendanceSubmitted] = useState(false);
    const [waitingForLecturer, setWaitingForLecturer] = useState(false);

    // Profile Modal State (Only for joining)
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [studentName, setStudentName] = useState('');
    const [studentIndex, setStudentIndex] = useState('');
    const [submittingProfile, setSubmittingProfile] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        
        // Don't re-run if attendance already submitted
        if (attendanceSubmitted) return;

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

                // CRITICAL: Check if class is active FIRST for students
                // Students cannot join until lecturer starts the class
                const isLecturer = profile.role === 'lecturer' && sessionData.lecturerId === user.uid;
                
                if (!isLecturer && !sessionData.isActive) {
                    console.log('Class not active - showing waiting room for student');
                    setWaitingForLecturer(true);
                    setLoading(false);
                    return; // Stop here - show waiting room
                }

                // Check payment access
                let hasPaidAccess = sessionData.isFree || (await hasUserPaid(user.uid, sessionId));

                // If it's a free class and user hasn't "paid" (enrolled), create a $0 transaction so it shows on dashboard
                // Only students can create these transactions per Firestore rules
                if (sessionData.isFree && !hasPaidAccess && profile.role === 'student' && !isLecturer) {
                    // First double-check they don't already have a transaction (race condition prevention)
                    const existingAccess = await hasUserPaid(user.uid, sessionId);
                    if (!existingAccess) {
                        try {
                            await addDoc(collection(db, 'transactions'), {
                                userId: user.uid,
                                sessionId: sessionId,
                                amount: 0,
                                currency: 'GHS',
                                paystackReference: `free_${sessionId}_${user.uid}_${Date.now()}`,
                                paymentChannel: 'mobile_money_mtn', // Default for free
                                status: 'succeeded',
                                email: user.email || '',
                                createdAt: Timestamp.now(),
                                paidAt: Timestamp.now(),
                                isHidden: false
                            });
                            hasPaidAccess = true;
                            console.log('Free class enrollment successful');
                        } catch (e: any) {
                            console.error("Failed to enroll in free class:", e?.message || e);
                            // If permission denied, might be already enrolled or profile issue
                            if (e?.code === 'permission-denied') {
                                console.log('Permission denied - checking if already enrolled...');
                                // Re-check in case of race condition
                                hasPaidAccess = await hasUserPaid(user.uid, sessionId);
                                if (!hasPaidAccess) {
                                    // Profile might not be a student or doesn't exist
                                    console.error('User profile may not be set as student. Role:', profile.role);
                                    alert('Unable to enroll. Please ensure your account is set up as a student.');
                                    router.push('/dashboard/student');
                                    return;
                                }
                            }
                        }
                    } else {
                        hasPaidAccess = true;
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

                // Students MUST enter name and index number for attendance EVERY time they join
                if (profile.role === 'student') {
                    // Pre-fill with existing data if available
                    setStudentName(profile.fullName || '');
                    setStudentIndex(profile.indexNumber || '');
                    setShowProfileModal(true);
                    setLoading(false);
                    return; // Wait for modal submit
                }

                setCanAccess(true);

                // Join the Jitsi room - Only if not already connected to this session
                if (currentSessionId !== sessionId) {
                    joinClass(sessionId, sessionData.title, profile.fullName, profile.role);
                }

                setLoading(false);
            } catch (error) {
                console.error('Error loading session:', error);
                alert('Failed to load session');
                router.push('/');
            }
        };

        loadSession();
    }, [user, profile, sessionId, router, authLoading, currentSessionId, joinClass, attendanceSubmitted]);

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !studentName.trim() || !studentIndex.trim()) return;

        setSubmittingProfile(true);
        try {
            // Update profile with attendance details
            try {
                await updateDoc(doc(db, 'profiles', user.uid), {
                    fullName: studentName,
                    indexNumber: studentIndex,
                    updatedAt: Timestamp.now()
                });
            } catch (profileError) {
                console.warn('Profile update failed (might be new user):', profileError);
                // Continue anyway - attendance is more important
            }

            // Log attendance - this is the critical part
            await addDoc(collection(db, 'attendance_logs'), {
                sessionId,
                userId: user.uid,
                userName: studentName,
                userIndexNumber: studentIndex,
                joinedAt: Timestamp.now(),
            });

            console.log('Attendance logged successfully');

            // Mark attendance as submitted to prevent modal from reappearing
            setAttendanceSubmitted(true);

            // Close modal and join class
            setShowProfileModal(false);
            setCanAccess(true);

            // Join Jitsi after profile update
            joinClass(sessionId, session?.title || 'Class', studentName, profile?.role || 'student');

        } catch (error) {
            console.error("Error saving attendance:", error);
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

    // Waiting room for students when class hasn't started
    if (waitingForLecturer) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950 p-4">
                <div className="text-center max-w-md">
                    <div className="w-24 h-24 mx-auto mb-6 relative">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
                        <div className="relative w-full h-full bg-indigo-600/30 rounded-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Waiting for Lecturer</h1>
                    <p className="text-gray-400 mb-6 text-sm sm:text-base">
                        The class hasn't started yet. Please wait for your lecturer to begin the session.
                    </p>
                    <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/10">
                        <p className="text-white font-semibold text-lg">{session?.title}</p>
                        <p className="text-gray-400 text-sm mt-1">Class ID: {sessionId.slice(0, 8)}...</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/student')}
                            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-colors"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                    <p className="text-gray-500 text-xs mt-6">
                        The page will not auto-refresh. Click refresh to check if the class has started.
                    </p>
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
