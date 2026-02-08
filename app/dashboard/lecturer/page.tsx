'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
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
    getDocs,
    orderBy,
    Timestamp,
} from 'firebase/firestore';
import { AttendanceLog } from '@/lib/firebase/types';
import { Session } from '@/lib/firebase/types';
import { getSessionRevenue } from '@/lib/payments/verifyPayment';
import { generateMeetingCode } from '@/lib/meetingCode';
import { Plus, X, Download, Trash2, Video, Copy, Check, History, Users } from 'lucide-react';
import AttendanceHistoryModal from '@/components/AttendanceHistoryModal';
import { RecordingsDashboard } from '@/components/RecordingsDashboard';

export default function LecturerDashboard() {
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const { showAlert, showConfirm } = useAlert();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [revenueData, setRevenueData] = useState<Record<string, any>>({});
    const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
    const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});

    // Form state
    const [title, setTitle] = useState('');
    const [lecturerName, setLecturerName] = useState('');
    const [program, setProgram] = useState('');
    const [course, setCourse] = useState('');
    const [scheduledStartTime, setScheduledStartTime] = useState('');
    // Price state removed


    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);


    useEffect(() => {
        if (authLoading) return;

        if (user && profile) {
            // Autofill lecturer name if available
            setLecturerName(profile.fullName || '');
        }

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
                showAlert("Error: You do not have permission to view these sessions.", "error");
            }
        });

        return () => unsubscribe();
        return () => unsubscribe();
    }, [user, profile, authLoading, router]);

    // Fetch Live Participant Counts
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/livekit/stats');
                if (res.ok) {
                    const data = await res.json();
                    setParticipantCounts(data.stats || {});
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        };

        fetchStats();
        // Refresh every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            // priceInPesewas removed

            // Create the session first to get the ID
            const docRef = await addDoc(collection(db, 'sessions'), {
                title,
                lecturerId: user.uid,
                isActive: false,
                price: 0, // Hardcoded to 0 for subscription model
                currency: 'GHS',
                isFree: true, // Always free individually, covered by subscription
                meetingCode: '', // Placeholder, will update
                lecturerName,
                program,
                course,
                scheduledStartTime: scheduledStartTime ? Timestamp.fromDate(new Date(scheduledStartTime)) : null,
                createdAt: Timestamp.now(),
            });

            // Generate meeting code from the document ID and update
            const meetingCode = generateMeetingCode(docRef.id);
            await updateDoc(docRef, { meetingCode });

            // Reset form
            setTitle('');
            setProgram('');
            setCourse('');
            setScheduledStartTime('');
            // Lecturer name persists or resets to profile default
            if (profile?.fullName) setLecturerName(profile.fullName);
            // setPrice/setIsFree removed
            setShowCreateModal(false);
        } catch (error) {
            console.error('Error creating session:', error);
            showAlert('Failed to create session', "error");
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
        showConfirm('Are you sure you want to delete this session?', async () => {
            console.log('Attempting to delete session:', sessionId);
            const sessionToDelete = sessions.find(s => s.id === sessionId);
            console.log('Session data:', sessionToDelete);
            console.log('Current user:', user?.uid);

            if (sessionToDelete?.lecturerId !== user?.uid) {
                console.error('Mismatch in lecturerId:', sessionToDelete?.lecturerId, 'vs', user?.uid);
                showAlert('Error: You do not appear to be the owner of this session.', "error");
                return;
            }

            try {
                // Soft delete: Update isDeleted flag instead of removing document
                await updateDoc(doc(db, 'sessions', sessionId), {
                    isDeleted: true,
                    isActive: false // Ensure it's not live
                });
                console.log('Session soft-deleted successfully');
            } catch (error: any) {
                console.error('Error deleting session:', error);
                showAlert(`Failed to delete session: ${error.message} (Code: ${error.code})`, "error");
            }
        }, 'Delete Session');
    };

    const handleDownloadAttendance = async (sessionId: string, title: string) => {
        try {
            const logsRef = collection(db, 'attendance_logs');
            const q = query(
                logsRef,
                where('sessionId', '==', sessionId),
                orderBy('joinedAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map(doc => doc.data() as AttendanceLog);

            if (logs.length === 0) {
                showAlert("No attendance records found for this class.", "info");
                return;
            }

            // Generate CSV
            const headers = ['Name', 'Index Number', 'Joined At'];
            const csvRows = [headers.join(',')];

            logs.forEach(log => {
                const date = log.joinedAt?.toDate ? log.joinedAt.toDate().toLocaleString() : 'N/A';
                // Escape quotes in name
                const name = `"${(log.userName || 'Unknown').replace(/"/g, '""')}"`;
                const index = `"${(log.userIndexNumber || 'N/A').replace(/"/g, '""')}"`;
                csvRows.push([name, index, `"${date}"`].join(','));
            });

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_')}_attendance.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Error downloading attendance:", error);
            showAlert("Failed to download attendance.", "error");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600/30 border-t-blue-600"></div>
            </div>
        );
    }



    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Header / Welcome */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Welcome back, {profile?.fullName?.split(' ')[0]}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Here's what's happening with your classes today.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Create New Class
                </button>
                <button
                    onClick={() => setShowHistoryModal(true)}
                    className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold transition-colors flex items-center gap-2"
                >
                    <History className="w-5 h-5" />
                    Attendance History
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Classes</p>
                        <p className="text-4xl font-bold text-gray-900 dark:text-white mt-1">{sessions.length}</p>
                    </div>
                    <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Now</p>
                        <p className="text-4xl font-bold text-gray-900 dark:text-white mt-1">{sessions.filter(s => s.isActive).length}</p>
                    </div>
                    <div className="w-14 h-14 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Sessions Grid */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Your Sessions</h2>

                {sessions.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Video className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No classes yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">Create your first class to start streaming to your students.</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors"
                        >
                            Create Class
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {sessions.filter(s => !s.isDeleted).map((session) => {

                            return (
                                <div key={session.id} className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${session.isActive
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                            }`}>
                                            {session.isActive ? '● Live' : 'Offline'}
                                        </div>

                                        {/* Live Participants Badge */}
                                        {session.isActive && participantCounts[session.id] !== undefined && participantCounts[session.id] > 0 && (
                                            <div className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {participantCounts[session.id]}
                                            </div>
                                        )}

                                        <div className="flex gap-1 ml-auto">
                                            <button
                                                onClick={() => handleDeleteSession(session.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                                title="Delete Class"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">{session.title}</h3>

                                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-4">
                                        <span className="flex items-center gap-1">
                                            <Video className="w-4 h-4" />
                                            Video Class
                                        </span>
                                    </div>

                                    {/* Meeting Code */}
                                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Meeting Code</p>
                                                <p className="font-mono font-bold text-gray-900 dark:text-white">
                                                    {session.meetingCode || generateMeetingCode(session.id)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const code = session.meetingCode || generateMeetingCode(session.id);
                                                    navigator.clipboard.writeText(code);
                                                    setCopiedCodeId(session.id);
                                                    setTimeout(() => setCopiedCodeId(null), 2000);
                                                }}
                                                className={`p-2 rounded-lg transition-colors ${copiedCodeId === session.id
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                                                    }`}
                                            >
                                                {copiedCodeId === session.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleToggleActive(session.id, session.isActive)}
                                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${session.isActive
                                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                                                : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                                                }`}
                                        >
                                            {session.isActive ? 'Stop Stream' : 'Go Live'}
                                        </button>

                                        {session.isActive && (
                                            <button
                                                onClick={() => router.push(`/classroom/${session.id}`)}
                                                className="px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
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

            {/* Recordings Section */}
            <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
                <RecordingsDashboard lecturerId={user?.uid || ''} />
            </div>

            {/* Create Session Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
                        <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Class</h2>
                                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateSession} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Class Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                        placeholder="e.g. Advanced Mathematics"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lecturer Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={lecturerName}
                                        onChange={(e) => setLecturerName(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                        placeholder="Full Name"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Program</label>
                                        <input
                                            type="text"
                                            required
                                            value={program}
                                            onChange={(e) => setProgram(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            placeholder="e.g. Computer Science"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Course</label>
                                        <input
                                            type="text"
                                            required
                                            value={course}
                                            onChange={(e) => setCourse(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            placeholder="e.g. CS101"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Scheduled Start Time (Optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={scheduledStartTime}
                                        onChange={(e) => setScheduledStartTime(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Students will see a countdown if they join before this time.
                                    </p>
                                </div>

                                {/* Price and IsFree removed as per subscription model */}

                                <button
                                    type="submit"
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                >
                                    Create Class
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Attendance History Modal */}
            <AttendanceHistoryModal
                isOpen={showHistoryModal}
                onClose={() => setShowHistoryModal(false)}
                userId={user?.uid || ''}
            />
        </div >
    );
}
