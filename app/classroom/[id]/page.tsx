'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, addDoc, updateDoc, collection, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { Session } from '@/lib/firebase/types';
import { hasUserPaid } from '@/lib/payments/verifyPayment';
import ClassroomContent from '@/components/ClassroomContent';
import { useClassroom } from '@/contexts/ClassroomContext';
import { Clock, RefreshCw, ArrowLeft } from 'lucide-react';

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

                // Students MUST enter name and index number for attendance
                if (profile.role === 'student') {
                    // Check if attendance is already logged for this session
                    const attendanceRef = collection(db, 'attendance_logs');
                    const q = query(
                        attendanceRef,
                        where('sessionId', '==', sessionId),
                        where('userId', '==', user.uid)
                    );
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        console.log('Attendance already submitted for this session');
                        setAttendanceSubmitted(true);
                        setCanAccess(true);

                        // Join immediately since attendance is done
                        if (currentSessionId !== sessionId) {
                            joinClass(sessionId, sessionData.title, profile.fullName, profile.role, user.uid);
                        }

                        setLoading(false);
                        return;
                    }

                    // If not found, show modal
                    // Pre-fill with existing data if available
                    setStudentName(profile.fullName || '');
                    setStudentIndex(profile.indexNumber || '');
                    setShowProfileModal(true);
                    setLoading(false);
                    return; // Wait for modal submit
                }

                setCanAccess(true);

                // Join the LiveKit room - Only if not already connected to this session
                if (currentSessionId !== sessionId) {
                    joinClass(sessionId, sessionData.title, profile.fullName, profile.role, user.uid);
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
                lecturerId: session?.lecturerId,
                sessionTitle: session?.title || 'Unknown Class',
            });

            console.log('Attendance logged successfully');

            // Mark attendance as submitted to prevent modal from reappearing
            setAttendanceSubmitted(true);

            // Close modal and join class
            setShowProfileModal(false);
            setCanAccess(true);

            // Join LiveKit after profile update
            joinClass(sessionId, session?.title || 'Class', studentName, profile?.role || 'student', user.uid);

        } catch (error) {
            console.error("Error saving attendance:", error);
            alert("Failed to save details. Please try again.");
        } finally {
            setSubmittingProfile(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600/30 border-t-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-400">Loading classroom...</p>
                </div>
            </div>
        );
    }

    // Waiting room for students when class hasn't started
    if (waitingForLecturer) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 mx-auto mb-6 bg-blue-600/20 rounded-full flex items-center justify-center">
                        <Clock className="w-10 h-10 text-blue-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-3">Waiting for Lecturer</h1>
                    <p className="text-gray-400 mb-6">
                        The class hasn't started yet. Please wait for your lecturer to begin the session.
                    </p>
                    <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800">
                        <p className="text-white font-semibold">{session?.title}</p>
                        <p className="text-gray-500 text-sm mt-1">Class ID: {sessionId.slice(0, 8)}...</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/student')}
                            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </button>
                    </div>
                    <p className="text-gray-600 text-xs mt-6">
                        Click refresh to check if the class has started.
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
                    <div className="absolute inset-0 bg-black/80" />
                    <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-xl">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Student Details</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Please enter your details to join the class.
                        </p>
                        <form onSubmit={handleProfileSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={studentName}
                                    onChange={(e) => setStudentName(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Index Number</label>
                                <input
                                    type="text"
                                    required
                                    value={studentIndex}
                                    onChange={(e) => setStudentIndex(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submittingProfile}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
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
