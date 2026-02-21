'use client';

import { useRouter } from 'next/navigation';
import { Session } from '@/lib/firebase/types';
import ThemeToggle from '@/components/ThemeToggle';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useAlert } from '@/contexts/AlertContext';
import { Users, MicOff, UserX, Volume2, Share2, Copy, Check, Link, Home, LogOut, Menu, X, Mic, VideoIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { JitsiParticipant } from '@/contexts/ClassroomContext';
import { generateMeetingCode } from '@/lib/meetingCode';
import { db, handleFirestoreError } from '@/lib/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { RecordingControls } from './RecordingControls';
import { LayoutSelector } from './LayoutSelector';
import { SimpleAttendanceConsole } from './attendance/SimpleAttendanceConsole';
import {
    subscribeToPermissionRequests,
    subscribeToAllPermissions,
    grantPermission,
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

    // Permission Management State
    const [pendingRequests, setPendingRequests] = useState<PermissionRequest[]>([]);
    const [activePermissions, setActivePermissions] = useState<{ participantId: string; permissions: ParticipantPermissions }[]>([]);

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

    // Permission Handlers
    const handleGrant = async (identity: string, type: PermissionType) => {
        try {
            await grantPermission(sessionId, identity, ctxUserId || '', type);
        } catch (error) {
            console.error('Failed to grant permission:', error);
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
            showAlert('Student muted and permission revoked', 'success');
        } catch (err) {
            console.error('Error revoking student permission:', err);
        }
    };

    const handleMuteAll = async () => {
        muteAllParticipants();
        const studentIdentities = participants
            .filter(p => !p.isLocal && p.role !== 'moderator')
            .map(p => p.identity);

        if (studentIdentities.length > 0) {
            try {
                await revokeAllPermissions(sessionId, studentIdentities, 'microphone');
                showAlert('Muted all and revoked permissions', 'success');
            } catch (err) {
                console.error('Error revoking all permissions:', err);
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
                            {ctxUserRole === 'lecturer' && (
                                <SimpleAttendanceConsole sessionId={sessionId} isActive={session.isActive} />
                            )}
                            <ThemeToggle />
                            <button
                                onClick={() => setShowMobileMenu(!showMobileMenu)}
                                className="p-2 text-white bg-gray-800 rounded-lg"
                            >
                                {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu Dropdown */}
                    {showMobileMenu && (
                        <div className="md:hidden mt-3 pt-3 border-t border-gray-800 space-y-2">
                            {ctxUserRole === 'lecturer' && (
                                <button
                                    onClick={() => { setShowShareModal(true); setShowMobileMenu(false); }}
                                    className="w-full px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <Share2 className="w-4 h-4" />
                                    Invite Students
                                </button>
                            )}
                            <button
                                onClick={() => { setShowParticipantsModal(true); setShowMobileMenu(false); }}
                                className="relative w-full px-4 py-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Users className="w-4 h-4" />
                                {ctxUserRole === 'lecturer' ? 'Manage Participants' : 'Participants'} ({participants.length})
                                {ctxUserRole === 'lecturer' && pendingRequests.length > 0 && (
                                    <span className="absolute right-4 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                                        {pendingRequests.length} New
                                    </span>
                                )}
                            </button>

                            <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-700/50">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 block px-1">Layout</label>
                                <div className="flex justify-center">
                                    <LayoutSelector
                                        currentLayout={layout}
                                        onLayoutChange={(l) => {
                                            setLayout(l);
                                            // Optional: Close menu on selection? Maybe not.
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => router.push('/')}
                                    className="flex-1 px-4 py-3 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <Home className="w-4 h-4" />
                                    Home
                                </button>
                                <button
                                    onClick={handleLeave}
                                    className="flex-1 px-4 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Leave
                                </button>
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
                                <div className="flex gap-2 mb-4 shrink-0">
                                    <button
                                        onClick={() => handleMuteAll()}
                                        className="flex-1 px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <MicOff className="w-4 h-4" />
                                        Mute All
                                    </button>
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
