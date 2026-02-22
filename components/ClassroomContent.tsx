'use client';

import { useRouter } from 'next/navigation';
import { Session } from '@/lib/firebase/types';
import ThemeToggle from '@/components/ThemeToggle';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useAlert } from '@/contexts/AlertContext';
import { Users, User, MicOff, UserX, Volume2, Share2, Copy, Check, Link, Home, LogOut, Menu, X, Mic, VideoIcon, ArrowLeft, MoreVertical, ShieldAlert } from 'lucide-react';
import { useState, useEffect } from 'react';
import { JitsiParticipant } from '@/contexts/ClassroomContext';
import { generateMeetingCode } from '@/lib/meetingCode';
import { db, handleFirestoreError } from '@/lib/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import dynamic from 'next/dynamic';

const RecordingControls = dynamic(() => import('./RecordingControls').then(mod => mod.RecordingControls), {
    ssr: false,
    loading: () => <div className="h-8 w-24 bg-gray-800 animate-pulse rounded-lg" />
});

const LayoutSelector = dynamic(() => import('./LayoutSelector').then(mod => mod.LayoutSelector), {
    ssr: false,
    loading: () => <div className="h-8 w-32 bg-gray-800 animate-pulse rounded-lg" />
});

const SimpleAttendanceConsole = dynamic(() => import('./attendance/SimpleAttendanceConsole').then(mod => mod.SimpleAttendanceConsole), {
    ssr: false,
    loading: () => <div className="h-8 w-28 bg-gray-800 animate-pulse rounded-lg" />
});
import {
    subscribeToPermissionRequests,
    subscribeToAllPermissions,
    grantPermission,
    grantAllPermissions,
    denyPermission,
    revokePermission,
    revokeAllPermissions,
    PermissionRequest,
    ParticipantPermissions,
    PermissionType
} from '@/lib/firebase/permissions';

interface ClassroomContentProps {
    session: Session;
    user: any;
    profile: any;
    sessionId: string;
}

export default function ClassroomContent({ session, user, profile, sessionId }: ClassroomContentProps) {
    const router = useRouter();
    const {
        sessionId: ctxSessionId,
        title: ctxTitle,
        userId: ctxUserId,
        userRole: ctxUserRole,
        layout,
        setLayout,
        leaveClass,
        isFloating,
        toggleFloating,
        toggleMinimize,
        participants,
        muteParticipant,
        muteAllParticipants,
        kickParticipant,
        askToUnmute,
    } = useClassroom();
    const { showAlert, showConfirm } = useAlert();

    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [mobileSideNavView, setMobileSideNavView] = useState<'menu' | 'manage'>('menu');

    // Permission Management State
    const [pendingRequests, setPendingRequests] = useState<PermissionRequest[]>([]);
    const [activePermissions, setActivePermissions] = useState<{ participantId: string; permissions: ParticipantPermissions }[]>([]);
    const [autoApproveMic, setAutoApproveMic] = useState(false);
    const [isMutedAll, setIsMutedAll] = useState(false);

    // Subscribe to permissions if lecturer
    useEffect(() => {
        if (ctxUserRole !== 'lecturer' || !sessionId) return;

        const unsubscribeRequests = subscribeToPermissionRequests(sessionId, (requests) => {
            setPendingRequests(requests);
        });

        const unsubscribeAllPerms = subscribeToAllPermissions(sessionId, (perms) => {
            setActivePermissions(perms);
        });

        return () => {
            unsubscribeRequests();
            unsubscribeAllPerms();
        };
    }, [sessionId, ctxUserRole]);

    // Fetch initial auto-approval state from session
    useEffect(() => {
        if (session.autoApproveMic !== undefined) {
            setAutoApproveMic(session.autoApproveMic);
        }
    }, [session.autoApproveMic]);

    // Smart Mic Logic: Auto-approve incoming requests if enabled
    useEffect(() => {
        if (autoApproveMic && pendingRequests.length > 0 && ctxUserRole === 'lecturer') {
            console.log(`Smart Mic: Auto-approving ${pendingRequests.length} requests`);
            handleGrantAll();
        }
    }, [pendingRequests.length, autoApproveMic, ctxUserRole]);

    const toggleAutoApproveMic = async () => {
        const newState = !autoApproveMic;
        setAutoApproveMic(newState);
        try {
            await updateDoc(doc(db, 'sessions', sessionId), {
                autoApproveMic: newState
            });
        } catch (error) {
            console.error('Failed to toggle auto-approve mic:', error);
        }
    };

    // Permission Handlers
    const handleGrant = async (identity: string, type: PermissionType) => {
        try {
            await grantPermission(sessionId, identity, ctxUserId || '', type);
        } catch (error) {
            console.error('Failed to grant permission:', error);
        }
    };

    const handleGrantAll = async () => {
        if (pendingRequests.length === 0) return;

        // Group requests by type if necessary, but for simplicity we'll just process all
        // Most are 'microphone' anyway.
        try {
            const studentIds = pendingRequests.map(r => r.participantId);
            // We'll use the type of the first request as a baseline, 
            // or just 'microphone' if they are mixed, since most are mic.
            // A more robust way would be to group them, but 'microphone' is the primary use case.
            const type = pendingRequests[0].requestType;

            await grantAllPermissions(sessionId, ctxUserId || '', studentIds, type);
        } catch (error) {
            console.error('Failed to grant all permissions:', error);
        }
    };

    const handleDeny = async (identity: string) => {
        try {
            await denyPermission(sessionId, identity);
        } catch (error) {
            console.error('Failed to deny permission:', error);
        }
    };

    const handleRevoke = async (identity: string, type: PermissionType) => {
        try {
            await revokePermission(sessionId, identity, type);
        } catch (error) {
            console.error('Failed to revoke permission:', error);
        }
    };

    const handleMuteStudent = async (participantId: string, identity: string) => {
        muteParticipant(participantId);
        try {
            await revokePermission(sessionId, identity, 'microphone');
        } catch (err) {
            console.error('Error revoking student permission:', err);
        }
    };

    const handleMuteAll = async () => {
        const studentIdentities = participants
            .filter(p => !p.isLocal && p.role !== 'moderator')
            .map(p => p.identity);

        if (isMutedAll) {
            // Unmute All - Grant permissions to all students
            if (studentIdentities.length > 0) {
                try {
                    const studentIds = participants
                        .filter(p => !p.isLocal && p.role !== 'moderator')
                        .map(p => p.participantId);
                    await grantAllPermissions(sessionId, ctxUserId || '', studentIds, 'microphone');
                    setIsMutedAll(false);
                } catch (err) {
                    console.error('Error unmuting all students:', err);
                }
            } else {
                setIsMutedAll(false);
            }
        } else {
            // Mute All
            muteAllParticipants();
            if (studentIdentities.length > 0) {
                try {
                    await revokeAllPermissions(sessionId, studentIdentities, 'microphone');
                    setIsMutedAll(true);
                } catch (err) {
                    console.error('Error revoking all permissions:', err);
                }
            } else {
                setIsMutedAll(true);
            }
        }
    };

    // Get or generate meeting code
    const meetingCode = session.meetingCode || generateMeetingCode(sessionId);
    const fullLink = typeof window !== 'undefined' ? `${window.location.origin}/classroom/${sessionId}` : '';

    // Save meeting code to Firestore if it doesn't exist
    useEffect(() => {
        const saveMeetingCode = async () => {
            if (!session.meetingCode && ctxUserRole === 'lecturer') {
                try {
                    const generatedCode = generateMeetingCode(sessionId);
                    await updateDoc(doc(db, 'sessions', sessionId), {
                        meetingCode: generatedCode
                    });
                    console.log('Meeting code saved to Firestore:', generatedCode);
                } catch (error) {
                    console.error('Failed to save meeting code:', error);
                    // Attempt to handle Firestore error and retry
                    const handled = await handleFirestoreError(db, error);
                    if (handled) {
                        // Retry once more after handling the error
                        try {
                            const generatedCode = generateMeetingCode(sessionId);
                            await updateDoc(doc(db, 'sessions', sessionId), {
                                meetingCode: generatedCode
                            });
                            console.log('Meeting code saved to Firestore after retry:', generatedCode);
                        } catch (retryError) {
                            console.error('Retry failed to save meeting code:', retryError);
                        }
                    }
                }
            }
        };
        saveMeetingCode();
    }, [session.meetingCode, sessionId, profile?.role]);

    const handleCopyCode = async () => {
        await navigator.clipboard.writeText(meetingCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const handleCopyLink = async () => {
        await navigator.clipboard.writeText(fullLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleLeave = () => {
        leaveClass();
        if (ctxUserRole === 'lecturer') {
            router.push('/dashboard/lecturer');
        } else {
            router.push('/dashboard/student');
        }
    };

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Mobile Header */}
            <header className="bg-gray-900 border-b border-gray-800 fixed top-0 left-0 right-0 z-50">
                <div className="px-3 sm:px-4 py-2 sm:py-3">
                    <div className="flex justify-between items-center">
                        {/* Title - truncated on mobile */}
                        <div className="flex-1 min-w-0 mr-2">
                            <h1 className="text-base sm:text-lg font-bold text-white truncate">{session.title}</h1>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                {session.isActive && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                                {session.isActive ? 'Live' : 'Offline'}
                            </p>
                        </div>

                        {/* Desktop Controls */}
                        <div className="hidden md:flex items-center gap-2">
                            <ThemeToggle />

                            <RecordingControls
                                roomId={ctxSessionId || ''}
                                lecturerId={ctxUserId || ''}
                                classTitle={ctxTitle || 'Untitled Class'}
                                isLecturer={ctxUserRole === 'lecturer' || ctxUserRole === 'admin'}
                            />

                            {ctxUserRole === 'lecturer' && (
                                <div className="hidden lg:block">
                                    <SimpleAttendanceConsole sessionId={sessionId} isActive={session.isActive} />
                                </div>
                            )}

                            <div className="h-6 w-px bg-gray-800 mx-1 hidden lg:block" />

                            <div className="hidden lg:block">
                                <LayoutSelector
                                    currentLayout={layout}
                                    onLayoutChange={setLayout}
                                />
                            </div>

                            <button
                                onClick={() => setShowShareModal(true)}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Share2 className="w-4 h-4" />
                                <span className="hidden lg:inline">Invite</span>
                            </button>

                            <button
                                onClick={() => setShowParticipantsModal(true)}
                                className="relative px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Users className="w-4 h-4" />
                                <span className="hidden lg:inline">{ctxUserRole === 'lecturer' ? 'Manage' : 'Participants'}</span>
                                <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">{participants.length}</span>
                                {ctxUserRole === 'lecturer' && pendingRequests.length > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-pulse">
                                        {pendingRequests.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                title="Home"
                            >
                                <Home className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleLeave}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden lg:inline">Leave</span>
                            </button>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="flex md:hidden items-center gap-2">
                            <ThemeToggle />
                            <button
                                onClick={() => setShowMobileMenu(!showMobileMenu)}
                                className="p-2 text-white bg-gray-800 rounded-lg"
                            >
                                {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                                {ctxUserRole === 'lecturer' && pendingRequests.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 w-3 h-3 rounded-full animate-pulse border-2 border-gray-900" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu Side-Nav Drawer & Backdrop */}
                    {showMobileMenu && (
                        <div className="fixed inset-0 z-[200] md:hidden">
                            {/* Backdrop */}
                            <div
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    setTimeout(() => setMobileSideNavView('menu'), 300);
                                }}
                            />

                            {/* Drawer */}
                            <div className="absolute top-0 right-0 h-full w-[300px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
                                {/* Drawer Header */}
                                <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 shrink-0">
                                    <div className="flex items-center gap-2">
                                        {mobileSideNavView === 'manage' ? (
                                            <button
                                                onClick={() => setMobileSideNavView('menu')}
                                                className="p-1.5 -ml-1 text-gray-400 hover:text-white bg-gray-800/50 rounded-lg"
                                            >
                                                <ArrowLeft className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <Menu className="w-4 h-4 text-blue-500" />
                                        )}
                                        <h3 className="text-sm font-bold text-white">
                                            {mobileSideNavView === 'manage' ? 'Manage Students' : 'Class Menu'}
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowMobileMenu(false);
                                            setTimeout(() => setMobileSideNavView('menu'), 300);
                                        }}
                                        className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {mobileSideNavView === 'menu' ? (
                                        <div className="p-4 space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                                            {/* Lecturer Specific Tools */}
                                            {ctxUserRole === 'lecturer' && (
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Class Management</label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button
                                                                onClick={() => { setShowShareModal(true); setShowMobileMenu(false); }}
                                                                className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-600/10 hover:bg-blue-600/20 rounded-2xl border border-blue-500/20 text-blue-400 Transition-all active:scale-95"
                                                            >
                                                                <Share2 className="w-5 h-5" />
                                                                <span className="text-[10px] font-bold uppercase">Invite</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setMobileSideNavView('manage')}
                                                                className="relative flex flex-col items-center justify-center gap-2 p-4 bg-indigo-600/10 hover:bg-indigo-600/20 rounded-2xl border border-indigo-500/20 text-indigo-400 transition-all active:scale-95"
                                                            >
                                                                <Users className="w-5 h-5" />
                                                                <span className="text-[10px] font-bold uppercase">Manage</span>
                                                                {pendingRequests.length > 0 && (
                                                                    <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-lg animate-pulse">
                                                                        {pendingRequests.length}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Session Control</label>
                                                        <div className="bg-gray-800/30 p-4 rounded-2xl border border-gray-800">
                                                            <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Recording & Broadcast</p>
                                                            <RecordingControls
                                                                roomId={ctxSessionId || ''}
                                                                lecturerId={ctxUserId || ''}
                                                                classTitle={ctxTitle || 'Untitled Class'}
                                                                isLecturer={true}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Attendance Taker</label>
                                                        <div className="bg-indigo-600/10 p-4 rounded-2xl border border-indigo-500/20">
                                                            <SimpleAttendanceConsole sessionId={sessionId} isActive={session.isActive} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 block">Class Info</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-blue-600/5 p-3 rounded-2xl border border-blue-500/10">
                                                        <p className="text-[10px] font-bold text-blue-400 mb-0.5">Participants</p>
                                                        <div className="flex items-center gap-1.5">
                                                            <Users className="w-3.5 h-3.5 text-blue-500" />
                                                            <span className="text-sm font-black text-white">{participants.length}</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-purple-600/5 p-3 rounded-2xl border border-purple-500/10">
                                                        <p className="text-[10px] font-bold text-purple-400 mb-0.5">Students</p>
                                                        <div className="flex items-center gap-1.5">
                                                            <User className="w-3.5 h-3.5 text-purple-500" />
                                                            <span className="text-sm font-black text-white">
                                                                {participants.filter(p => p.role !== 'moderator').length}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-800/30 p-3 rounded-2xl border border-gray-800">
                                                    <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Room ID</p>
                                                    <p className="text-[10px] font-mono text-gray-500 truncate tracking-wider">{sessionId}</p>
                                                </div>
                                            </div>

                                            <p className="text-[10px] text-gray-600 text-center pt-4">
                                                Refined Mobile UI v2.5
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                            {/* Participant Management (Ported from Modal) */}
                                            <div className="p-4 space-y-6">
                                                {/* Global Actions */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-3 bg-indigo-600/10 rounded-2xl border border-indigo-500/20">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                                                                <Mic className="w-4 h-4 text-indigo-400" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-white">Smart Mic</p>
                                                                <p className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter leading-none">Auto-Approve</p>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={autoApproveMic}
                                                                onChange={toggleAutoApproveMic}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-10 h-5 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                                        </label>
                                                    </div>

                                                    <button
                                                        onClick={handleMuteAll}
                                                        className={`w-full flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-colors ${isMutedAll
                                                            ? 'bg-green-600/10 hover:bg-green-600/20 text-green-500 border-green-500/20'
                                                            : 'bg-red-600/10 hover:bg-red-600/20 text-red-500 border-red-500/20'
                                                            }`}
                                                    >
                                                        {isMutedAll ? (
                                                            <>
                                                                <Mic className="w-4 h-4" />
                                                                UNMUTE ALL STUDENTS
                                                            </>
                                                        ) : (
                                                            <>
                                                                <MicOff className="w-4 h-4" />
                                                                MUTE ALL STUDENTS
                                                            </>
                                                        )}
                                                    </button>
                                                </div>

                                                {/* Pending Requests */}
                                                {pendingRequests.length > 0 && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Pending Requests</label>
                                                            <button
                                                                onClick={handleGrantAll}
                                                                className="text-[10px] font-bold text-white px-2 py-1 bg-blue-600 rounded-lg"
                                                            >
                                                                Approve All
                                                            </button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {pendingRequests.map(request => (
                                                                <div key={request.id} className="flex items-center justify-between bg-blue-600/5 p-3 rounded-2xl border border-blue-500/10">
                                                                    <div className="min-w-0 pr-2">
                                                                        <p className="font-bold text-sm text-white truncate">{request.participantName || 'Guest'}</p>
                                                                        <span className="text-[9px] text-blue-400 font-bold uppercase tracking-tight">{request.requestType}</span>
                                                                    </div>
                                                                    <div className="flex gap-1">
                                                                        <button
                                                                            onClick={() => handleGrant(request.participantId, request.requestType)}
                                                                            className="p-2 bg-green-600 rounded-xl"
                                                                        >
                                                                            <Check className="w-3.5 h-3.5 text-white" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeny(request.participantId)}
                                                                            className="p-2 bg-red-600/20 rounded-xl"
                                                                        >
                                                                            <X className="w-3.5 h-3.5 text-red-500" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Participant List */}
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">In Classroom ({participants.length})</label>
                                                    <div className="space-y-2 pb-8">
                                                        {participants.map((p) => {
                                                            const studentPerms = activePermissions.find(ap => ap.participantId === p.participantId)?.permissions;
                                                            const hasMic = studentPerms?.micPermission;
                                                            const hasCam = studentPerms?.cameraPermission;

                                                            return (
                                                                <div key={p.participantId} className="flex items-center justify-between bg-gray-800/30 p-3 rounded-2xl border border-gray-800">
                                                                    <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-[10px] shrink-0 ${p.isLocal ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                                                                            {p.displayName?.[0]?.toUpperCase() || '?'}
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className="font-bold text-xs text-white truncate">{p.displayName || 'Guest'}</p>
                                                                            <p className="text-[9px] text-gray-500 uppercase font-black tracking-tighter">{p.role === 'moderator' ? 'Lecturer' : 'Student'}</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-1">
                                                                        {!p.isLocal && p.role !== 'moderator' && (
                                                                            <div className="flex items-center bg-gray-900/50 p-1 rounded-xl">
                                                                                <button
                                                                                    onClick={() => hasMic ? handleRevoke(p.identity, 'microphone') : handleGrant(p.identity, 'microphone')}
                                                                                    className={`p-1.5 rounded-lg ${hasMic ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                                                                                >
                                                                                    <Mic className="w-3 h-3" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => hasCam ? handleRevoke(p.identity, 'camera') : handleGrant(p.identity, 'camera')}
                                                                                    className={`p-1.5 rounded-lg ${hasCam ? 'bg-purple-600 text-white' : 'text-gray-500'}`}
                                                                                >
                                                                                    <VideoIcon className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                        {!p.isLocal && (
                                                                            <button
                                                                                onClick={() => p.role === 'moderator' ? kickParticipant(p.participantId) : handleMuteStudent(p.participantId, p.identity)}
                                                                                className="p-2 text-gray-500 hover:text-red-500"
                                                                            >
                                                                                <UserX className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </header >

            < div
                style={{
                    position: 'fixed',
                    top: '56px', // 44px header + 12px gap
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#0a0a0a',
                }
                }
                className="sm:!top-[72px]" // 52px header + 20px gap
            >
                <div
                    id="classroom-video-mount"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: isFloating ? 'none' : 'block'
                    }}
                />
            </div >

            {/* Share/Invite Modal - Lecturer Only */}
            {
                showShareModal && ctxUserRole === 'lecturer' && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
                        <div className="relative w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:fade-in sm:zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4 sm:mb-6">
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Invite Students</h2>
                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Share this code with your students</p>
                                </div>
                                <button
                                    onClick={() => setShowShareModal(false)}
                                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>

                            {/* Meeting Code - Big and Bold */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 sm:p-6 mb-4 border border-blue-200 dark:border-blue-800">
                                <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold mb-2">Meeting Code</p>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-2xl sm:text-3xl font-mono font-bold text-gray-900 dark:text-white tracking-wider">
                                        {meetingCode}
                                    </p>
                                    <button
                                        onClick={handleCopyCode}
                                        className={`p-3 rounded-lg transition-all shrink-0 ${copiedCode
                                            ? 'bg-green-600 text-white'
                                            : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800'
                                            }`}
                                    >
                                        {copiedCode ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Full Link (Alternative) */}
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 sm:mb-6 border border-gray-200 dark:border-gray-700">
                                <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mb-2">Or share full link</p>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0">
                                        <Link className="w-4 h-4 text-gray-400 shrink-0" />
                                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">
                                            {fullLink}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleCopyLink}
                                        className={`p-2 rounded-lg transition-all shrink-0 ${copiedLink
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">How students join:</p>
                                <ol className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 space-y-1 list-decimal list-inside">
                                    <li>Go to their Student Dashboard</li>
                                    <li>Enter the meeting code</li>
                                    <li>Fill in name and index number</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                )}

            {/* Participants Modal - All Users */}
            {
                showParticipantsModal && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowParticipantsModal(false)} />
                        <div className="relative w-full sm:max-w-lg bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:fade-in sm:zoom-in duration-200 max-h-[85vh] flex flex-col">
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Participants ({participants.length})</h2>
                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Manage students in your class</p>
                                </div>
                                <button
                                    onClick={() => setShowParticipantsModal(false)}
                                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>

                            {/* Quick Actions - Lecturer Only */}
                            {ctxUserRole === 'lecturer' && (
                                <div className="space-y-3 mb-4 shrink-0">
                                    {/* Smart Mic Toggle */}
                                    <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                                <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white">Smart Mic</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">Auto-approve all requests</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={autoApproveMic}
                                                onChange={toggleAutoApproveMic}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleMuteAll()}
                                            className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 border ${isMutedAll
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50 hover:bg-green-200 dark:hover:bg-green-900/50'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50 hover:bg-red-200 dark:hover:bg-red-900/50'
                                                }`}
                                        >
                                            {isMutedAll ? (
                                                <>
                                                    <Mic className="w-4 h-4" />
                                                    Unmute All Students
                                                </>
                                            ) : (
                                                <>
                                                    <MicOff className="w-4 h-4" />
                                                    Mute All Students
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Modal Content - Streamlined */}
                            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">

                                {/* Pending Requests - Compact */}
                                {ctxUserRole === 'lecturer' && pendingRequests.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                            Pending Requests ({pendingRequests.length})
                                        </h3>
                                        <button
                                            onClick={handleGrantAll}
                                            className="w-full mb-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                                        >
                                            <Check className="w-4 h-4" />
                                            Approve All Requests
                                        </button>
                                        <div className="space-y-2">
                                            {pendingRequests.map(request => (
                                                <div key={request.id} className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                                    <div className="min-w-0 pr-4">
                                                        <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                                            {request.participantName || 'Guest'}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {request.requestType.includes('microphone') || request.requestType === 'both' ? <Mic className="w-3 h-3 text-blue-500" /> : null}
                                                            {request.requestType.includes('camera') || request.requestType === 'both' ? <VideoIcon className="w-3 h-3 text-purple-500" /> : null}
                                                            <span className="text-[10px] text-gray-500 font-medium uppercase">{request.requestType} requested</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            onClick={() => handleGrant(request.participantId, request.requestType)}
                                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold py-1 px-2 rounded-lg transition-colors border border-green-500/30"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeny(request.participantId)}
                                                            className="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-500 text-[10px] font-bold py-1 px-2 rounded-lg transition-colors border border-red-500/20"
                                                        >
                                                            Decline
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Active Participants List */}
                                <div>
                                    <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 px-1">
                                        In Classroom ({participants.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {participants.length === 0 ? (
                                            <div className="text-center py-10 bg-gray-50/50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                                                <Users className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                                                <p className="text-xs text-gray-400">Waiting for participants...</p>
                                            </div>
                                        ) : (
                                            participants.map((p) => {
                                                const studentPerms = activePermissions.find(ap => ap.participantId === p.participantId)?.permissions;
                                                const hasMic = studentPerms?.micPermission;
                                                const hasCam = studentPerms?.cameraPermission;

                                                return (
                                                    <div
                                                        key={p.participantId}
                                                        className={`group flex items-center justify-between p-3 rounded-2xl border transition-all ${p.isLocal
                                                            ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30'
                                                            : 'bg-white dark:bg-gray-900/40 border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 shadow-sm hover:shadow-md'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-inner ${p.isLocal ? 'bg-indigo-600' : 'bg-gray-400 dark:bg-gray-700'
                                                                }`}>
                                                                {p.displayName?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                                                        {p.displayName || 'Guest'}
                                                                    </p>
                                                                    {p.isLocal && (
                                                                        <span className="text-[8px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-lg uppercase tracking-tighter">YOU</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className={`text-[10px] font-bold uppercase tracking-tight ${p.role === 'moderator' ? 'text-blue-500' : 'text-gray-500'
                                                                        }`}>
                                                                        {p.role === 'moderator' ? 'Lecturer' : 'Student'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Actions Container */}
                                                        <div className="flex items-center gap-1.5">
                                                            {!p.isLocal && ctxUserRole === 'lecturer' && (
                                                                <>
                                                                    {/* Permission Group */}
                                                                    <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl gap-0.5">
                                                                        {/* Mic Toggle */}
                                                                        <button
                                                                            onClick={() => hasMic ? handleRevoke(p.identity, 'microphone') : handleGrant(p.identity, 'microphone')}
                                                                            className={`p-2 rounded-lg transition-all ${hasMic
                                                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                                                                }`}
                                                                            title={hasMic ? "Revoke Microphone" : "Grant Microphone"}
                                                                        >
                                                                            <Mic className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        {/* Cam Toggle */}
                                                                        <button
                                                                            onClick={() => hasCam ? handleRevoke(p.identity, 'camera') : handleGrant(p.identity, 'camera')}
                                                                            className={`p-2 rounded-lg transition-all ${hasCam
                                                                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                                                                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                                                                }`}
                                                                            title={hasCam ? "Revoke Camera" : "Grant Camera"}
                                                                        >
                                                                            <VideoIcon className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>

                                                                    {/* Separator */}
                                                                    <div className="w-[1px] h-6 bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />

                                                                    {/* Quick Moderation Group */}
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => askToUnmute(p.participantId)}
                                                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                                            title="Ask to Unmute"
                                                                        >
                                                                            <Volume2 className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleMuteStudent(p.participantId, p.identity)}
                                                                            className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                                                                            title="Force Mute"
                                                                        >
                                                                            <MicOff className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => showConfirm(`Remove ${p.displayName}?`, () => kickParticipant(p.participantId))}
                                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                                            title="Remove Student"
                                                                        >
                                                                            <LogOut className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>


                        </div>
                    </div>
                )
            }
        </div>
    );
}
