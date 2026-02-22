'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, addDoc, updateDoc, collection, Timestamp, query, where, getDocs, increment } from 'firebase/firestore';
import { Session } from '@/lib/firebase/types';
import { hasUserPaid } from '@/lib/payments/verifyPayment';
import ClassroomContent from '@/components/ClassroomContent';
import { useClassroom } from '@/contexts/ClassroomContext';
import { Clock, RefreshCw, ArrowLeft, Laptop } from 'lucide-react';
import CountdownTimer from '@/components/CountdownTimer';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAlert } from '@/contexts/AlertContext';
import { useQuery } from '@tanstack/react-query';

export default function ClassroomPage() {
    const params = useParams();
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const { joinClass, preWarmToken, sessionId: currentSessionId } = useClassroom();
    const { showAlert } = useAlert();
    const sessionId = params.id as string;

    // Session Query
    const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery({
        queryKey: ['session', sessionId],
        queryFn: async () => {
            const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
            if (!sessionDoc.exists()) {
                throw new Error('Session not found');
            }
            return { id: sessionDoc.id, ...sessionDoc.data() } as Session;
        },
        staleTime: 30000, // 30 seconds
    });

    const [loading, setLoading] = useState(true);
    const [canAccess, setCanAccess] = useState(false);
    const [attendanceSubmitted, setAttendanceSubmitted] = useState(false);
    const [waitingForLecturer, setWaitingForLecturer] = useState(false);
    const [isScheduledWait, setIsScheduledWait] = useState(false);

    // Profile Modal State (Only for joining)
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [studentName, setStudentName] = useState('');
    const [studentIndex, setStudentIndex] = useState('');
    const [submittingProfile, setSubmittingProfile] = useState(false);

    useEffect(() => {
        if (authLoading || sessionLoading) return;

        if (sessionError) {
            showAlert('Session not found', 'error');
            router.push('/');
            return;
        }

        if (!user || !profile || !session) {
            if (!authLoading && !user) {
                const currentPath = window.location.pathname + window.location.search;
                router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
            }
            return;
        }

        const verifyAccess = async () => {
            try {
                // CRITICAL: Check if user is the HOST of this session
                const isHost = session.lecturerId === user.uid;
                const isLecturer = profile.role === 'lecturer';

                if (!isHost && !session.isActive) {
                    // Check if there's a scheduled start time in the future
                    if (session.scheduledStartTime) {
                        const now = new Date();
                        const startTime = session.scheduledStartTime.toDate();

                        if (startTime > now) {
                            setIsScheduledWait(true);
                            setLoading(false);
                            return;
                        }
                    }

                    setWaitingForLecturer(true);
                    setLoading(false);
                    return;
                }

                // Check payment access
                let hasPaidAccess = session.isFree || (await hasUserPaid(user.uid, sessionId));

                // If it's a free class and user hasn't enrolled
                if (session.isFree && !hasPaidAccess && profile.role === 'student' && !isLecturer) {
                    const existingAccess = await hasUserPaid(user.uid, sessionId);
                    if (!existingAccess) {
                        try {
                            await addDoc(collection(db, 'transactions'), {
                                userId: user.uid,
                                sessionId: sessionId,
                                amount: 0,
                                currency: 'GHS',
                                paystackReference: `free_${sessionId}_${user.uid}_${Date.now()}`,
                                paymentChannel: 'mobile_money_mtn',
                                status: 'succeeded',
                                email: user.email || '',
                                createdAt: Timestamp.now(),
                                paidAt: Timestamp.now(),
                                isHidden: false
                            });
                            hasPaidAccess = true;
                        } catch (e: any) {
                            if (e?.code === 'permission-denied') {
                                hasPaidAccess = await hasUserPaid(user.uid, sessionId);
                                if (!hasPaidAccess) {
                                    showAlert('Unable to enroll. Please ensure your account is set up as a student.', 'error');
                                    router.push('/dashboard/student');
                                    return;
                                }
                            }
                        }
                    } else {
                        hasPaidAccess = true;
                    }
                }

                if (!isHost && !isLecturer && !hasPaidAccess) {
                    showAlert('You need to pay to access this class', 'warning');
                    router.push('/dashboard/student');
                    return;
                }

                // Pre-warm LiveKit token in background!
                preWarmToken(sessionId, profile.fullName, isHost ? 'lecturer' : 'student', user.uid, profile.photoURL);

                // Attendance check
                if (!isHost) {
                    const attendanceRef = collection(db, 'attendance_logs');
                    const q = query(
                        attendanceRef,
                        where('sessionId', '==', sessionId),
                        where('userId', '==', user.uid)
                    );
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        setAttendanceSubmitted(true);
                        setCanAccess(true);
                        if (currentSessionId !== sessionId) {
                            joinClass(sessionId, session.title, profile.fullName, isHost ? 'lecturer' : 'student', user.uid, profile.photoURL);
                        }
                        setLoading(false);
                        return;
                    }

                    setStudentName(profile.fullName || '');
                    setStudentIndex(profile.indexNumber || '');
                    setShowProfileModal(true);
                    setLoading(false);
                    return;
                }

                setCanAccess(true);
                if (currentSessionId !== sessionId) {
                    joinClass(sessionId, session.title, profile.fullName, isHost ? 'lecturer' : 'student', user.uid, profile.photoURL);
                }
                setLoading(false);
            } catch (error) {
                console.error('[Classroom:MainVerify] Error verifying access:', error);
                showAlert('Failed to load session', 'error');
                router.push('/');
            }
        };

        verifyAccess();
    }, [user, profile, sessionId, router, authLoading, sessionLoading, session, sessionError, currentSessionId, joinClass, preWarmToken, attendanceSubmitted]);

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
                    classCount: increment(1),
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
            // If they are a guest lecturer, they MUST join as 'student' to avoid admin perms
            const isHost = session?.lecturerId === user.uid;
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('podium_user_interacted', 'true');
            }
            joinClass(sessionId, session?.title || 'Class', studentName, isHost ? 'lecturer' : 'student', user.uid, profile?.photoURL);

        } catch (error) {
            console.error("[Classroom:AttendanceLog] Error saving attendance:", error);
            showAlert("Failed to save details. Please try again.", "error");
        } finally {
            setSubmittingProfile(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 p-8 space-y-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-12">
                        <Skeleton className="h-10 w-48 bg-gray-800" />
                        <Skeleton className="h-10 w-32 bg-gray-800" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[600px]">
                        <Skeleton className="h-full w-full rounded-2xl bg-gray-800" />
                        <Skeleton className="h-full w-full rounded-2xl bg-gray-800" />
                    </div>
                </div>
            </div>
        );
    }

    // Waiting room for students when class hasn't started
    if (isScheduledWait) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
                <div className="text-center max-w-md w-full">
                    <div className="w-20 h-20 mx-auto mb-8 bg-blue-600/20 rounded-full flex items-center justify-center">
                        <Clock className="w-10 h-10 text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2">Class starts in</h1>
                    <p className="text-gray-400 mb-8">
                        The class is scheduled to begin soon. Grab your materials and wait for the lecturer.
                    </p>

                    <div className="mb-10">
                        {session?.scheduledStartTime && (
                            <CountdownTimer
                                targetDate={session.scheduledStartTime.toDate()}
                                onComplete={() => {
                                    setIsScheduledWait(false);
                                    setWaitingForLecturer(true);
                                }}
                            />
                        )}
                    </div>

                    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-8">
                        <p className="text-blue-400 font-bold text-sm uppercase tracking-widest mb-2">Class Title</p>
                        <h2 className="text-xl font-bold text-white">{session?.title}</h2>
                        <div className="flex items-center justify-center gap-2 mt-4 text-gray-500 text-sm">
                            <Laptop className="w-4 h-4" />
                            <span>Scheduled for {session?.scheduledStartTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push('/dashboard/student')}
                        className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 mx-auto"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </button>

                    <p className="text-gray-700 text-xs mt-8">
                        You will be able to join as soon as the lecturer starts the session.
                    </p>
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
