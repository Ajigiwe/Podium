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
    const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

    // Create Form State
    const [title, setTitle] = useState('');
    const [lecturerName, setLecturerName] = useState('');
    const [program, setProgram] = useState('');
    const [course, setCourse] = useState('');
    const [scheduledStartTime, setScheduledStartTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('60');
    const [verificationCount, setVerificationCount] = useState('2');
    const [requireGuestDetails, setRequireGuestDetails] = useState(true);

    // --- JOINING STATE ---
    const [enrolledSessions, setEnrolledSessions] = useState<Session[]>([]);
    const [joining, setJoining] = useState(false);
    const [joinLink, setJoinLink] = useState('');
    
    // --- PREVIEW STATE ---
    const [showJoinPreview, setShowJoinPreview] = useState(false);
    const [selectedSessionForJoin, setSelectedSessionForJoin] = useState<Session | null>(null);
    const [enrolling, setEnrolling] = useState(false);


    // 2. Fetch Hosted Sessions
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'sessions'), where('lecturerId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setHostedSessions(sessionsData.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));

            // Revenue data (async)
            for (const s of sessionsData) {
                if (s.id && !revenueData[s.id]) {
                    getSessionRevenue(s.id).then(data => {
                        setRevenueData(prev => ({ ...prev, [s.id]: data }));
                    });
                }
            }
        }, (err: any) => console.error('[Dashboard:Hosted] Error:', err));
        return () => unsubscribe();
    }, [user, revenueData]);

    // 3. Fetch Enrolled Sessions (Joined)
    useEffect(() => {
        if (!user) return;
        const qTransactions = query(
            collection(db, 'transactions'),
            where('userId', '==', user.uid),
            where('isHidden', '==', false)
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
            
            const sorted = validSessions.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

            setEnrolledSessions(sorted);
            setLoading(false);
        }, (err: any) => {
            console.error('[Dashboard:Enrolled] Error:', err);
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
                requireGuestDetails: requireGuestDetails,
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

        setJoining(true);
        try {
            let sId = joinLink.trim();
            if (isMeetingCode(sId)) {
                const normalized = normalizeCode(sId);
                const snap = await getDocs(query(collection(db, 'sessions'), where('meetingCode', '==', `pod-${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`)));
                if (snap.empty) {
                    showAlert('Class not found.', 'error');
                    setJoining(false);
                    return;
                }
                sId = snap.docs[0].id;
            } else if (sId.includes('/classroom/')) {
                sId = sId.split('/classroom/')[1].split('?')[0];
            }

            // Fetch session details to show preview
            const sessionSnap = await getDoc(doc(db, 'sessions', sId));
            if (!sessionSnap.exists()) {
                showAlert('Class session no longer exists.', 'error');
                setJoining(false);
                return;
            }

            const sData = { id: sessionSnap.id, ...sessionSnap.data() } as Session;
            setSelectedSessionForJoin(sData);
            setShowJoinPreview(true);
        } catch (err) {
            console.error(err);
            showAlert("Error joining class", "error");
        } finally {
            setJoining(false);
        }
    };

    const enrollInClass = async (sId: string) => {
        if (!user) return false;
        try {
            // Check if already enrolled in memory
            const alreadyEnrolled = enrolledSessions.some(s => s.id === sId);
            if (alreadyEnrolled) return true;

            // Check in Firestore for ANY transaction (even hidden ones)
            const q = query(collection(db, 'transactions'), where('userId', '==', user.uid), where('sessionId', '==', sId));
            const snap = await getDocs(q);
            
            if (!snap.empty) {
                // If it exists but is hidden, unhide it
                const tx = snap.docs[0];
                if (tx.data().isHidden !== false) {
                    await updateDoc(tx.ref, { isHidden: false });
                }
                return true;
            }

            await addDoc(collection(db, 'transactions'), {
                userId: user.uid,
                sessionId: sId,
                amount: 0,
                currency: 'GHS',
                paystackReference: `join_access_${sId}_${user.uid}_${Date.now()}`,
                paymentChannel: 'direct_join',
                status: 'succeeded',
                email: user.email || '',
                isHidden: false,
                createdAt: serverTimestamp(),
                paidAt: serverTimestamp()
            });
            return true;
        } catch (err) {
            console.error('[Dashboard:Enroll] Error:', err);
            showAlert('Failed to add class to your list.', 'error');
            return false;
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
                    <Skeleton className="h-32 rounded-lg bg-gray-200 " />
                    <Skeleton className="h-32 rounded-lg bg-gray-200 " />
                    <Skeleton className="h-32 rounded-lg bg-gray-200 " />
                </div>
            </div>
        );
    }


    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-20">
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-slate-500 font-bold text-base">
                        Welcome back, <span className="text-slate-900">{profile?.fullName?.split(' ')[0]}</span>
                    </p>
                </div>
            </div>

            <div className="w-full flex justify-center">
                <div className="flex p-1 bg-slate-50 rounded-md border border-slate-100/50 w-full max-w-[240px]">
                    <button
                        onClick={() => setActiveTab('join')}
                        className={`flex-1 py-2 px-3 rounded font-bold text-[10px] transition-all flex justify-center items-center gap-1.5 ${activeTab === 'join' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-500'}`}
                    >
                        <MonitorPlay className="w-3.5 h-3.5" />
                        Join
                    </button>
                    <button
                        onClick={() => setActiveTab('host')}
                        className={`flex-1 py-2 px-3 rounded-lg font-bold text-[10px] transition-all flex justify-center items-center gap-1.5 ${activeTab === 'host' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-500'}`}
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Host
                    </button>
                </div>
            </div>

            {/* --- TAB CONTENT --- */}
            {activeTab === 'join' ? (
                <div className="max-w-3xl mx-auto space-y-8">
                    {/* Join Class Action */}
                    <div className="bg-white rounded-lg p-6 sm:p-8 border border-slate-100 shadow-sm shadow-slate-200/20">
                        <div className="space-y-6">
                            <div className="text-center sm:text-left">
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                                    Ready to learn?
                                </h3>
                                <p className="text-slate-400 font-medium text-xs mt-0.5">Enter your meeting code to enter the space.</p>
                            </div>

                            <form onSubmit={handleJoinByLink} className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative group">
                                    <input
                                        type="text"
                                        value={joinLink}
                                        onChange={(e) => setJoinLink(e.target.value)}
                                        placeholder="pod-xxxx-xxxx"
                                        className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-100 focus:border-slate-900/30 focus:bg-white rounded-md outline-none transition-all font-bold text-base text-slate-900 placeholder:text-slate-300"
                                    />
                                    <div className="absolute inset-0 rounded-md ring-4 ring-slate-900/5 transition-all pointer-events-none" />
                                </div>
                                <button
                                    type="submit"
                                    disabled={joining || !joinLink}
                                    className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-black disabled:opacity-30 transition-all flex items-center justify-center gap-2.5 text-base shadow-xl shadow-slate-900/10 active:scale-95"
                                >
                                    {joining ? <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" /> : <>Join Space <ArrowRight className="w-4 h-4" /></>}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Enrolled / Peer Classes */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xs font-bold text-slate-400 flex items-center gap-2.5 uppercase tracking-widest">
                                Recent Spaces
                            </h2>
                            <span className="text-[10px] font-black bg-slate-100 text-slate-900 px-3 py-1 rounded-full border border-slate-200 uppercase">{enrolledSessions.length} Joined</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {enrolledSessions.map(session => (
                                <div key={session.id} className="bg-white border border-slate-200 rounded-md p-4 flex flex-col justify-between group transition-colors hover:border-slate-900 relative overflow-hidden">
                                    {session.isActive && <div className="absolute top-0 left-0 w-full h-1 bg-slate-400" />}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${session.isActive ? 'bg-slate-100 text-slate-900' : 'bg-slate-50 text-slate-400'}`}>
                                            <MonitorPlay className="w-5 h-5" />
                                        </div>
                                        <button onClick={(e) => handleRemoveEnrolled(session.id, e)} className="p-1.5 bg-slate-50 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-sm line-clamp-2 mb-0.5 text-slate-900">{session.title}</h4>
                                        <p className="text-[10px] font-medium text-slate-500">{session.lecturerName || 'Unknown Host'}</p>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                        <button
                                            onClick={() => {
                                                setSelectedSessionForJoin(session);
                                                setShowJoinPreview(true);
                                            }}
                                            className={`w-full py-2 rounded text-xs font-bold transition-all flex justify-center items-center gap-2 ${session.isActive ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                                        >
                                            {session.isActive ? 'Join Live Space' : 'Open Space'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {enrolledSessions.length === 0 && (
                                <div className="col-span-full py-16 text-center rounded-md border-2 border-dashed border-slate-200 text-slate-400">
                                    <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-base font-bold text-slate-500">No classes joined yet.</p>
                                    <p className="text-sm mt-1">Paste a meeting code above to get started.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 rounded-lg border border-slate-100 shadow-sm shadow-slate-200/20">
                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 bg-slate-50 rounded-xl flex items-center justify-center">
                                <Video className="w-5 h-5 text-slate-900" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">Host & Manage</h2>
                                <p className="text-slate-400 font-medium text-xs mt-0.5">Start a new session or manage existing ones.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-black transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-slate-900/10 active:scale-95 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Launch Session
                        </button>
                    </div>

                    {/* Hosted Sessions */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xs font-bold text-slate-400 flex items-center gap-2.5 uppercase tracking-widest">
                                Your Sessions
                            </h2>
                            <span className="text-[10px] font-black bg-slate-100 text-slate-900 px-3 py-1 rounded-full border border-slate-200 uppercase">{hostedSessions.length} Created</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {hostedSessions.filter(s => !s.isDeleted).map(session => (
                        <div key={session.id} className="group bg-white border border-slate-100 rounded-md p-5 transition-all hover:border-slate-900/20 hover:shadow-xl hover:shadow-slate-200/30 relative overflow-hidden flex flex-col justify-between">
                                    {session.isActive && <div className="absolute top-0 left-0 w-full h-1 bg-slate-400" />}
                                    <div>
                                        <div className="flex items-start justify-between mb-5">
                                            <div className="flex-1">
                                                <h4 className="font-black text-base text-slate-900 line-clamp-2 leading-tight tracking-tight">{session.title}</h4>
                                                <div className="inline-flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-100 mt-2.5">
                                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">Code</span>
                                                    <span className="text-xs font-black text-slate-800 tracking-wider">{session.meetingCode}</span>
                                                    <button onClick={() => handleCopyCode(session.meetingCode, session.id)} className="text-slate-300 hover:text-slate-900 transition-colors ml-0.5">
                                                        {copiedCodeId === session.id ? <Check className="w-3.5 h-3.5 text-slate-900" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteSession(session.id, e)}
                                                className="p-2.5 bg-slate-50 rounded-md text-slate-300 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-100 opacity-0 group-hover:opacity-100 shadow-sm"
                                                title="End Class for Everyone"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2.5 mt-3.5 pt-3.5 border-t border-slate-50">
                                        <button onClick={() => router.push(`/classroom/${session.id}`)} className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded font-bold text-[10px] transition-all">
                                            Open Space
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(session.id, session.isActive || false)}
                                            className={`px-4 py-2.5 rounded font-black text-[10px] transition-all ${session.isActive ? 'bg-slate-100 text-slate-900 hover:bg-slate-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {session.isActive ? 'Go Offline' : 'Go Live'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {hostedSessions.length === 0 && (
                                <div className="col-span-full py-16 text-center rounded-md border-2 border-dashed border-slate-200 text-slate-400">
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
                    <div className="bg-white w-full max-w-lg rounded-lg p-6 border border-slate-200 relative">

                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <div className="space-y-0.5">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">Host New Class</h1>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Configure your virtual room</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl transition-all shadow-sm">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSession} className="space-y-5 relative z-10">
                            <div className="space-y-3.5">
                                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-md border border-slate-100">
                                    <div className="space-y-0.5">
                                        <label className="text-xs font-bold text-slate-900">Require Student Details</label>
                                        <p className="text-[10px] text-slate-400">Ask for name & ID on join.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setRequireGuestDetails(!requireGuestDetails)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${requireGuestDetails ? 'bg-slate-900' : 'bg-slate-300'}`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${requireGuestDetails ? 'translate-x-6' : 'translate-x-1'}`}
                                        />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">Class Title</label>
                                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Advanced System Architecture" className="w-full px-4 py-3 bg-slate-50 rounded-md border border-slate-200 focus:border-slate-900 outline-none text-sm font-medium" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">Program</label>
                                        <input type="text" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="CS Core" className="w-full px-4 py-3 bg-slate-50 rounded-md border border-slate-200 focus:border-slate-900 outline-none text-sm font-medium" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">Course Code</label>
                                        <input type="text" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="CS404" className="w-full px-4 py-3 bg-slate-50 rounded-md border border-slate-200 focus:border-slate-900 outline-none text-sm font-medium" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">Scheduled Time (Optional)</label>
                                    <input type="datetime-local" value={scheduledStartTime} onChange={(e) => setScheduledStartTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-md border border-slate-200 focus:border-slate-900 outline-none text-sm font-medium" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">Duration (Min)</label>
                                        <input type="number" min="1" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-md border border-slate-200 focus:border-slate-900 outline-none text-sm font-medium" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500">Checks Count</label>
                                        <input type="number" min="1" value={verificationCount} onChange={(e) => setVerificationCount(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-md border border-slate-200 focus:border-slate-900 outline-none text-sm font-medium" />
                                    </div>
                                </div>


                            </div>

                            <button type="submit" className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-black text-xs transition-colors flex items-center justify-center gap-2">
                                Generate Class Room <ArrowRight className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Join Preview Modal */}
            {showJoinPreview && selectedSessionForJoin && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowJoinPreview(false)} />
                    <div className="bg-white w-full max-w-md rounded-lg p-6 border border-slate-200 relative shadow-2xl overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transform -rotate-1 ${selectedSessionForJoin.isActive ? 'bg-slate-900 text-white' : 'bg-slate-900 text-white'}`}>
                                    <MonitorPlay className="w-5 h-5" />
                                </div>
                                <button onClick={() => setShowJoinPreview(false)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 leading-tight mb-0.5">{selectedSessionForJoin.title}</h2>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${selectedSessionForJoin.isActive ? 'bg-slate-900' : 'bg-slate-300'}`} />
                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${selectedSessionForJoin.isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                                            {selectedSessionForJoin.isActive ? 'Live Now' : 'Scheduled / Offline'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5 py-3 border-y border-slate-100">
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Lecturer</p>
                                        <p className="text-xs font-bold text-slate-800 truncate">{selectedSessionForJoin.lecturerName || 'Unknown'}</p>
                                    </div>
                                    <div className="space-y-0.5 text-right">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Session Code</p>
                                        <p className="text-xs font-bold text-slate-900 tracking-wider">
                                            {selectedSessionForJoin.meetingCode?.split('-').slice(1).join('-').toUpperCase()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>{selectedSessionForJoin.scheduledStartTime ? selectedSessionForJoin.scheduledStartTime.toDate().toLocaleDateString() : 'Instant'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{selectedSessionForJoin.durationMinutes} Minutes</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <button
                                    disabled={enrolling || !selectedSessionForJoin}
                                    onClick={async () => {
                                        if (!selectedSessionForJoin) return;
                                        setEnrolling(true);
                                        const success = await enrollInClass(selectedSessionForJoin.id);
                                        if (success) {
                                            router.push(`/classroom/${selectedSessionForJoin.id}`);
                                        }
                                        setEnrolling(false);
                                    }}
                                    className={`w-full py-2.5 rounded-md font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 ${selectedSessionForJoin?.isActive ? 'bg-slate-900 text-white shadow-slate-900/10' : 'bg-slate-900 text-white shadow-slate-900/10'}`}
                                >
                                    {enrolling ? 'Enrolling...' : (
                                        <>
                                            {selectedSessionForJoin?.isActive ? 'Join Live Now' : 'Enter Waiting Room'}
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                                <button
                                    disabled={enrolling || !selectedSessionForJoin}
                                    onClick={async () => {
                                        if (!selectedSessionForJoin) return;
                                        setEnrolling(true);
                                        const success = await enrollInClass(selectedSessionForJoin.id);
                                        if (success) {
                                            showAlert('Class added to your list!', 'success');
                                            setShowJoinPreview(false);
                                        }
                                        setEnrolling(false);
                                    }}
                                    className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md font-bold transition-all text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {enrolling ? 'Processing...' : 'Add to My Classes'}
                                </button>
                                <button
                                    onClick={() => setShowJoinPreview(false)}
                                    className="w-full py-1.5 text-slate-400 hover:text-slate-600 font-bold transition-all text-[9px] uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
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
                    <Skeleton className="h-48 rounded-md bg-slate-100" />
                    <Skeleton className="h-48 rounded-md bg-slate-100" />
                    <Skeleton className="h-48 rounded-md bg-slate-100" />
                </div>
            </div>
        }>
            <UniversalDashboardContent />
        </Suspense>
    );
}
