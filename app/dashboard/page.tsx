'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { db } from '@/lib/firebase/config';
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    doc,
    getDoc,
    updateDoc,
    getDocs,
    addDoc,
    deleteDoc,
    Timestamp,
    increment,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';
import { Session, Transaction, AttendanceLog, SystemSettings } from '@/lib/firebase/types';
import { initializeSubscription } from '@/lib/payments/initializeSubscription';
import { isMeetingCode, normalizeCode, generateMeetingCode } from '@/lib/meetingCode';
import { Skeleton } from '@/components/ui/Skeleton';
import { deleteSession } from '@/lib/firebase/session-utils';
import {
    CheckCircle,
    Lock,
    History,
    CreditCard,
    ArrowRight,
    Trash2,
    Video,
    Users,
    X,
    Plus,
    Download,
    Copy,
    Check,
    Calendar,
    Clock,
    DollarSign,
    Gamepad2,
    MonitorPlay
} from 'lucide-react';
import AttendanceHistoryModal from '@/components/AttendanceHistoryModal';
import { getSessionRevenue } from '@/lib/payments/verifyPayment';
import { useClassroom } from '@/contexts/ClassroomContext';

function UniversalDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, profile } = useAuth();
    const { showAlert, showConfirm } = useAlert();
    const { sessionId: activeSessionId, leaveClass } = useClassroom();

    // Redirection for Admin
    useEffect(() => {
        if (user && profile?.role === 'admin') {
            router.replace('/admin');
        }
    }, [user, profile, router]);

    // --- SHARED STATE ---
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'join' | 'host'>('join');
    const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});

    // --- HOSTING STATE ---
    const [hostedSessions, setHostedSessions] = useState<Session[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [revenueData, setRevenueData] = useState<Record<string, any>>({});
    const [totalStudents, setTotalStudents] = useState(0);
    const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

    // Create Form State
    const [title, setTitle] = useState('');
    const [lecturerName, setLecturerName] = useState('');
    const [program, setProgram] = useState('');
    const [course, setCourse] = useState('');
    const [scheduledStartTime, setScheduledStartTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('60');
    const [verificationCount, setVerificationCount] = useState('2');

    // --- JOINING STATE ---
    const [enrolledSessions, setEnrolledSessions] = useState<Session[]>([]);
    const [joining, setJoining] = useState(false);
    const [joinLink, setJoinLink] = useState('');


    // 2. Fetch Hosted Sessions
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'sessions'), where('lecturerId', '==', user.uid));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setHostedSessions(sessionsData.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));

            // Unique student count (async)
            try {
                const logsSnap = await getDocs(query(collection(db, 'attendance_logs'), where('lecturerId', '==', user.uid)));
                setTotalStudents(new Set(logsSnap.docs.map(d => d.data().userId)).size);
            } catch (err) {
                console.warn(err);
            }

            // Revenue data (async)
            for (const s of sessionsData) {
                if (!revenueData[s.id]) {
                    getSessionRevenue(s.id).then(data => {
                        setRevenueData(prev => ({ ...prev, [s.id]: data }));
                    });
                }
            }
        });
        return () => unsubscribe();
    }, [user, revenueData]);

    // 3. Fetch Enrolled Sessions (Joined)
    useEffect(() => {
        if (!user) return;
        const qTransactions = query(
            collection(db, 'transactions'),
            where('userId', '==', user.uid),
            where('isHidden', '==', false),
            orderBy('createdAt', 'desc')
        );

        const unsubscribeTx = onSnapshot(qTransactions, async (snapshot) => {
            if (snapshot.empty) {
                setEnrolledSessions([]);
                setLoading(false);
                return;
            }

            const sessionsToFetch = Array.from(new Set(snapshot.docs.map(d => d.data().sessionId)));
            const sessionSnaps = await Promise.all(sessionsToFetch.map(id => getDoc(doc(db, 'sessions', id))));
            const validSessions = sessionSnaps
                .filter(s => s.exists())
                .map(s => ({ id: s.id, ...s.data() } as Session));

            setEnrolledSessions(validSessions);
            setLoading(false);
        });

        return () => unsubscribeTx();
    }, [user]);

    // 4. Live Stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/livekit/stats');
                if (res.ok) {
                    const data = await res.json();
                    setParticipantCounts(data.stats || {});
                }
            } catch (e) { console.warn(e); }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    // --- HANDLERS ---

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !title.trim()) {
            showAlert('Please provide a class title.', 'error');
            return;
        }

        try {
            const docRef = doc(collection(db, 'sessions'));
            const sessionData = {
                id: docRef.id,
                title,
                hostId: user.uid,
                lecturerId: user.uid,
                isActive: false,
                status: 'active',
                price: 0,
                currency: 'GHS',
                isFree: true,
                meetingCode: generateMeetingCode(docRef.id),
                lecturerName: lecturerName || profile?.fullName || 'Unknown Lecturer',
                program: program || '',
                course: course || '',
                youtubeVideoId: null,
                scheduledStartTime: scheduledStartTime ? Timestamp.fromDate(new Date(scheduledStartTime)) : null,
                durationMinutes: parseInt(durationMinutes) || 60,
                verificationCount: parseInt(verificationCount) || 2,
                isDeleted: false,
                createdAt: serverTimestamp(),
            };

            await setDoc(docRef, sessionData);

            setTitle('');
            setProgram('');
            setCourse('');
            setScheduledStartTime('');
            setShowCreateModal(false);
            showAlert('Class created successfully!', 'success');
        } catch (error: any) {
            console.error('[Dashboard:CreateSession] Error:', error);
            if (error.code === 'permission-denied') {
                showAlert('You do not have permission to create a class. Please contact support.', 'error');
            } else {
                showAlert(error.message || 'Failed to create class', 'error');
            }
        }
    };

    const handleJoinByLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinLink.trim() || !user) return;

        // Subscription check is now handled at Layout level

        setJoining(true);
        try {
            let sId = joinLink.trim();
            if (isMeetingCode(sId)) {
                const normalized = normalizeCode(sId);
                const snap = await getDocs(query(collection(db, 'sessions'), where('meetingCode', '==', `pod-${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`)));
                if (snap.empty) {
                    showAlert('Class not found.', 'error'); setJoining(false); return;
                }
                sId = snap.docs[0].id;
            } else if (sId.includes('/classroom/')) {
                sId = sId.split('/classroom/')[1].split('?')[0];
            }

            // Simple Enrollment check
            const alreadyEnrolled = enrolledSessions.some(s => s.id === sId);
            if (!alreadyEnrolled) {
                await addDoc(collection(db, 'transactions'), {
                    userId: user.uid,
                    sessionId: sId,
                    amount: 0,
                    currency: 'GHS',
                    paystackReference: `sub_access_${sId}_${user.uid}_${Date.now()}`,
                    paymentChannel: 'subscription_access',
                    status: 'succeeded',
                    email: user.email || '',
                    isHidden: false,
                    createdAt: serverTimestamp(),
                    paidAt: serverTimestamp()
                });
            }

            router.push(`/classroom/${sId}`);
        } catch (err) {
            console.error(err);
            showAlert("Error joining class", "error");
        } finally {
            setJoining(false);
        }
    };


    const handleToggleActive = async (sId: string, current: boolean) => {
        try {
            await updateDoc(doc(db, 'sessions', sId), { isActive: !current });
        } catch (e) { console.error(e); }
    };

    const handleCopyCode = (code: string | undefined, id: string) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        setCopiedCodeId(id);
        setTimeout(() => setCopiedCodeId(null), 2000);
    };

    const handleRemoveEnrolled = async (sId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        showConfirm('Remove from your dashboard?', async () => {
            const q = query(collection(db, 'transactions'), where('userId', '==', user!.uid), where('sessionId', '==', sId));
            const snap = await getDocs(q);
            snap.forEach(d => updateDoc(d.ref, { isHidden: true }));
        });
    };

    const handleDeleteSession = async (sId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        showConfirm('Are you sure you want to end this class for everyone? This will eject all participants and permanently close the room.', async () => {
            try {
                await deleteSession(sId);
                // If the deleted session is the one currently active in the mini-player/background
                if (sId === activeSessionId) {
                    leaveClass();
                }
                showAlert('Class ended successfully', 'success');
            } catch (err) {
                console.error('Failed to end class:', err);
                showAlert('Failed to end class', 'error');
            }
        });
    };

    if (loading) {
        return (
            <div className="space-y-8 max-w-7xl mx-auto">
                <div className="flex justify-between items-end mb-8">
                    <Skeleton className="h-10 w-64 bg-gray-200 " />
                    <Skeleton className="h-10 w-40 bg-gray-200 " />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32 rounded-2xl bg-gray-200 " />
                    <Skeleton className="h-32 rounded-2xl bg-gray-200 " />
                    <Skeleton className="h-32 rounded-2xl bg-gray-200 " />
                </div>
            </div>
        );
    }


    return (
        <div className="space-y-12 max-w-7xl mx-auto pb-20">
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-slate-500 font-bold text-lg">
                        Welcome back, <span className="text-blue-600">{profile?.fullName?.split(' ')[0]}</span>
                    </p>
                </div>
                {activeTab === 'host' && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="hidden md:flex px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Host New Class
                    </button>
                )}
            </div>

            {/* --- TABS BROWSER --- */}
            <div className="w-full flex justify-center sticky top-20 lg:top-8 z-20 pointer-events-none">
                <div className="flex p-1 bg-slate-100 rounded-xl w-full max-w-sm border border-slate-200 pointer-events-auto">
                    <button
                        onClick={() => setActiveTab('join')}
                        className={`flex-1 py-3 px-6 rounded-lg font-bold text-sm transition-colors flex justify-center items-center gap-2 ${activeTab === 'join' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <MonitorPlay className="w-5 h-5" />
                        Join
                    </button>
                    <button
                        onClick={() => setActiveTab('host')}
                        className={`flex-1 py-3 px-6 rounded-lg font-bold text-sm transition-colors flex justify-center items-center gap-2 ${activeTab === 'host' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Plus className="w-5 h-5" />
                        Host
                    </button>
                </div>
            </div>

            {/* --- TAB CONTENT --- */}
            {activeTab === 'join' ? (
                <div className="space-y-8">
                    {/* Join Class Action */}
                    <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 max-w-4xl mx-auto">
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                                    <MonitorPlay className="w-6 h-6 text-blue-600" />
                                    Join Session
                                </h3>
                                <p className="text-slate-500 text-sm mt-1">Enter a meeting code or link to join your virtual classroom.</p>
                            </div>

                            <form onSubmit={handleJoinByLink} className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="text"
                                    value={joinLink}
                                    onChange={(e) => setJoinLink(e.target.value)}
                                    placeholder="e.g. pod-xxxx-xxxx"
                                    className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl outline-none transition-colors font-medium text-lg"
                                />
                                <button
                                    type="submit"
                                    disabled={joining || !joinLink}
                                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-lg"
                                >
                                    {joining ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : <span>Join <ArrowRight className="w-5 h-5 inline ml-1" /></span>}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Enrolled / Peer Classes */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-600" />
                                Recent Classes
                            </h2>
                            <span className="text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-full text-slate-500 border border-slate-200">{enrolledSessions.length} Joined</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {enrolledSessions.map(session => (
                                <div key={session.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between group transition-colors hover:border-blue-500 relative overflow-hidden">
                                    {session.isActive && <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${session.isActive ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                                            <MonitorPlay className="w-6 h-6" />
                                        </div>
                                        <button onClick={(e) => handleRemoveEnrolled(session.id, e)} className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-base line-clamp-2 mb-1 text-slate-900">{session.title}</h4>
                                        <p className="text-xs font-medium text-slate-500">{session.lecturerName || 'Unknown Host'}</p>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <button
                                            onClick={() => router.push(`/classroom/${session.id}`)}
                                            className={`w-full py-3 rounded-xl text-sm font-bold transition-colors flex justify-center items-center gap-2 ${session.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                                        >
                                            {session.isActive ? 'Join Live Session' : 'Open Classroom'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {enrolledSessions.length === 0 && (
                                <div className="col-span-full py-16 text-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                                    <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-base font-bold text-slate-500">No classes joined yet.</p>
                                    <p className="text-sm mt-1">Paste a meeting code above to get started.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                <Video className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Host & Manage Classes</h2>
                                <p className="text-sm text-slate-500 mt-1">Total Unique Students: {totalStudents}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Create New Class
                        </button>
                    </div>

                    {/* Hosted Sessions */}
                    <div className="space-y-8">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Video className="w-5 h-5 text-blue-600" />
                                Hosted Sessions
                            </h2>
                            <span className="text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-full text-slate-500 border border-slate-200">{hostedSessions.length} Total</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {hostedSessions.filter(s => !s.isDeleted).map(session => (
                                <div key={session.id} className="group bg-white border border-slate-200 rounded-xl p-6 transition-colors hover:border-blue-500 relative overflow-hidden flex flex-col justify-between">
                                    {session.isActive && <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />}
                                    <div>
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <h4 className="font-bold text-base text-slate-900 line-clamp-2 leading-tight">{session.title}</h4>
                                                <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 mt-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Code</span>
                                                    <span className="text-sm font-bold text-slate-900 tracking-wider">{session.meetingCode}</span>
                                                    <button onClick={() => handleCopyCode(session.meetingCode, session.id)} className="text-slate-300 hover:text-blue-600 transition-colors ml-1">
                                                        {copiedCodeId === session.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteSession(session.id, e)}
                                                className="p-2 bg-slate-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors border border-slate-100 opacity-0 group-hover:opacity-100"
                                                title="End Class for Everyone"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                                        <button onClick={() => router.push(`/classroom/${session.id}`)} className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-xl font-bold text-sm transition-colors border border-slate-200">
                                            Open Space
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(session.id, session.isActive || false)}
                                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors ${session.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                        >
                                            {session.isActive ? 'End' : 'Go Live'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {hostedSessions.length === 0 && (
                                <div className="col-span-full py-16 text-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                                    <Video className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-base font-bold text-slate-500">No classes hosted yet.</p>
                                    <p className="text-sm mt-1">Click &quot;Create New Class&quot; to get started.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}
            {/* Create Class Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
                    <div className="bg-white w-full max-w-lg rounded-xl p-8 border border-slate-200 relative">

                        <div className="flex justify-between items-center mb-10 relative z-10">
                            <div className="space-y-1">
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Host New Class</h1>
                                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Configure your virtual room</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-3 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-sm">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSession} className="space-y-6 relative z-10">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">Class Title</label>
                                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Advanced System Architecture" className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-blue-600 outline-none text-sm font-medium" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">Program</label>
                                        <input type="text" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="CS Core" className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-blue-600 outline-none text-sm font-medium" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">Course Code</label>
                                        <input type="text" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="CS404" className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-blue-600 outline-none text-sm font-medium" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">Scheduled Time (Optional)</label>
                                    <input type="datetime-local" value={scheduledStartTime} onChange={(e) => setScheduledStartTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-blue-600 outline-none text-sm font-medium" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">Duration (Min)</label>
                                        <input type="number" min="1" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-blue-600 outline-none text-sm font-medium" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">Checks Count</label>
                                        <input type="number" min="1" value={verificationCount} onChange={(e) => setVerificationCount(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-blue-600 outline-none text-sm font-medium" />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
                                Generate Class Room <ArrowRight className="w-6 h-6" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function UniversalDashboard() {
    return (
        <Suspense fallback={
            <div className="space-y-12 max-w-7xl mx-auto p-8 animate-pulse">
                <div className="flex justify-between items-center mb-12">
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-64 rounded-xl bg-slate-200" />
                        <Skeleton className="h-6 w-48 rounded-xl bg-slate-100" />
                    </div>
                </div>
                <div className="flex justify-center mb-12">
                    <Skeleton className="h-14 w-80 rounded-xl bg-slate-200" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-48 rounded-xl bg-slate-100" />
                    <Skeleton className="h-48 rounded-xl bg-slate-100" />
                    <Skeleton className="h-48 rounded-xl bg-slate-100" />
                </div>
            </div>
        }>
            <UniversalDashboardContent />
        </Suspense>
    );
}
