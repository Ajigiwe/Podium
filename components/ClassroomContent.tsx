'use client';

import { useRouter } from 'next/navigation';
import { Session } from '@/lib/firebase/types';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useAlert } from '@/contexts/AlertContext';
import { Users, User, MicOff, VideoOff, UserX, Volume2, Share2, Copy, Check, Link, Home, LogOut, Menu, X, Mic, VideoIcon, ArrowLeft, MoreVertical, ShieldAlert, Trash2, Crown, Shield, Folder, Power } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { JitsiParticipant } from '@/contexts/ClassroomContext';
import { generateMeetingCode } from '@/lib/meetingCode';
import { db, handleFirestoreError } from '@/lib/firebase/config';
import { doc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { deleteSession, endSession } from '@/lib/firebase/session-utils';
import dynamic from 'next/dynamic';
import { MaterialsModal } from './classroom/MaterialsModal';

const RecordingControls = dynamic(() => import('./RecordingControls').then(mod => mod.RecordingControls), {
    ssr: false,
    loading: () => <div className="h-8 w-24 bg-gray-800 animate-pulse rounded-lg" />
});

const SimpleAttendanceConsole = dynamic(() => import('./attendance/SimpleAttendanceConsole').then(mod => mod.SimpleAttendanceConsole), {
    ssr: false,
    loading: () => <div className="h-8 w-28 bg-gray-800 animate-pulse rounded-lg" />
});

const CoHostManagementPanel = dynamic(() => import('./CoHostManagementPanel').then(mod => mod.CoHostManagementPanel), {
    ssr: false,
    loading: () => <div className="h-8 w-24 bg-gray-800 animate-pulse rounded-lg" />
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
        participants,
        muteParticipant,
        muteAllParticipants,
        kickParticipant,
        isModerator,
        isHost,
        sessionData,
        coHosts,
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
    const [autoApproveMic, setAutoApproveMic] = useState(false);
    
    // Materials Modal State
    const [showMaterialsModal, setShowMaterialsModal] = useState(false);
    const [hasNewMaterials, setHasNewMaterials] = useState(false);
    const [lastKnownMaterialCount, setLastKnownMaterialCount] = useState(0);
    
    // isMutedAll is now synced from sessionData
    const isMutedAll = sessionData?.isMutedAll || false;

    // Subscribe to permissions if moderator
    useEffect(() => {
        if (!isModerator || !sessionId) return;

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
    }, [sessionId, isModerator]);

    // Notification logic for materials
    useEffect(() => {
        if (!sessionId) return;
        const materialsRef = collection(db, 'sessions', sessionId, 'materials');
        let isFirstLoad = true;
        const unsubscribe = onSnapshot(materialsRef, (snapshot) => {
            const count = snapshot.docs.length;
            if (!isFirstLoad && count > lastKnownMaterialCount && !showMaterialsModal) {
                setHasNewMaterials(true);
            }
            setLastKnownMaterialCount(count);
            isFirstLoad = false;
        });
        return () => unsubscribe();
    }, [sessionId, lastKnownMaterialCount, showMaterialsModal]);

    // Fetch initial auto-approval state from session
    useEffect(() => {
        if (session.autoApproveMic !== undefined) {
            setAutoApproveMic(session.autoApproveMic);
        }
    }, [session.autoApproveMic]);

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

    const handleGrantAll = useCallback(async () => {
        if (pendingRequests.length === 0) return;
        try {
            const studentIds = pendingRequests.map(r => r.participantId);
            const type = pendingRequests[0].requestType;
            await grantAllPermissions(sessionId, ctxUserId || '', studentIds, type);
        } catch (error) {
            console.error('Failed to grant all permissions:', error);
        }
    }, [pendingRequests, sessionId, ctxUserId]);

    // Smart Mic Logic: Auto-approve incoming requests if enabled
    useEffect(() => {
        if (autoApproveMic && pendingRequests.length > 0 && isModerator && !isMutedAll) {
            handleGrantAll();
        }
    }, [pendingRequests.length, autoApproveMic, isModerator, handleGrantAll, isMutedAll]);

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
            .filter(p => !p.isLocal && 
                p.role !== 'moderator' && 
                !coHosts.some(ch => ch.userId === p.metadata?.userId)
            )
            .map(p => p.identity);

        if (isMutedAll) {
            if (studentIdentities.length > 0) {
                try {
                    const studentIds = participants
                        .filter(p => !p.isLocal && 
                            p.role !== 'moderator' && 
                            !coHosts.some(ch => ch.userId === p.metadata?.userId)
                        )
                        .map(p => p.participantId);
                    await grantAllPermissions(sessionId, ctxUserId || '', studentIds, 'microphone');
                    await updateDoc(doc(db, 'sessions', sessionId), { isMutedAll: false });
                } catch (err) {
                    console.error('Error unmuting all students:', err);
                }
            } else {
                await updateDoc(doc(db, 'sessions', sessionId), { isMutedAll: false }).catch(() => {});
            }
        } else {
            muteAllParticipants(); 
            if (studentIdentities.length > 0) {
                try {
                    await revokeAllPermissions(sessionId, studentIdentities, 'microphone');
                } catch (err) {
                    console.error('Error revoking all permissions:', err);
                }
            }
        }
    };

    const meetingCode = session.meetingCode || generateMeetingCode(sessionId);
    const fullLink = typeof window !== 'undefined' ? `${window.location.origin}/classroom/${sessionId}` : '';

    useEffect(() => {
        const saveMeetingCode = async () => {
            if (!session.meetingCode && isHost) {
                try {
                    const generatedCode = generateMeetingCode(sessionId);
                    await updateDoc(doc(db, 'sessions', sessionId), { meetingCode: generatedCode });
                } catch (error) {
                    console.error('Failed to save meeting code:', error);
                }
            }
        };
        saveMeetingCode();
    }, [session.meetingCode, sessionId, isHost]);

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

    const handleEndSession = () => {
        showConfirm('End this class session? All students will be removed instantly.', async () => {
            try {
                await endSession(sessionId);
                showAlert('Class session ended.', 'success');
                // The listener in ClassroomContext will handle the redirect
            } catch (error) {
                showAlert('Failed to end session.', 'error');
            }
        });
    };

    const handleLeave = () => {
        leaveClass();
        window.location.href = '/dashboard.html';
    };

    return (
        <div className="min-h-screen bg-gray-950 font-sans">
            {/* Header */}
            <header className="bg-slate-900/80 backdrop-blur-3xl border-b border-white/5 fixed top-0 left-0 right-0 z-[100] h-14 sm:h-16 flex items-center">
                <div className="w-full px-3 sm:px-6">
                    <div className="flex justify-between items-center gap-2 sm:gap-4">
                        {/* Left: Title & Status */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button 
                                onClick={() => window.location.href = '/'}
                                className="sm:hidden p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
                            >
                                <Home className="w-4 h-4" />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-[13px] sm:text-base font-bold text-white truncate leading-none mb-1 max-w-[100px] xs:max-w-[150px] sm:max-w-none">{session.title}</h1>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${session.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                            {session.isActive ? 'Live' : 'Offline'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            {/* Moderator Tools Group - Desktop Only */}
                            {isModerator && (
                                <div className="hidden lg:flex items-center bg-white/5 rounded-xl p-1 border border-white/5">
                                    <RecordingControls
                                        roomId={ctxSessionId || ''}
                                        lecturerId={ctxUserId || ''}
                                        classTitle={ctxTitle || 'Untitled Class'}
                                        isLecturer={isModerator}
                                    />
                                    <div className="w-px h-6 bg-white/10 mx-1" />
                                    <SimpleAttendanceConsole sessionId={sessionId} isActive={session.isActive} />
                                    {isHost && (
                                        <>
                                            <div className="w-px h-6 bg-white/10 mx-1" />
                                            <CoHostManagementPanel sessionId={sessionId} />
                                            <div className="w-px h-6 bg-white/10 mx-1" />
                                            <button
                                                onClick={handleEndSession}
                                                className="h-8 w-8 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                title="End Session (Kick All)"
                                            >
                                                <Power className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Standard Actions */}
                            <div className="flex items-center gap-1 sm:gap-1.5">
                                <button
                                    onClick={() => setShowParticipantsModal(true)}
                                    className="relative h-8 sm:h-9 px-2 sm:px-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 sm:gap-2 border border-indigo-400/20"
                                >
                                    <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    <span className="hidden xs:inline sm:inline">{isModerator ? 'Manage' : 'People'}</span>
                                    <span className="bg-white/20 px-1 py-0.5 rounded text-[8px] sm:text-[10px] tabular-nums">{participants.length}</span>
                                    {isModerator && pendingRequests.length > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full border-2 border-slate-900 animate-bounce">
                                            {pendingRequests.length}
                                        </span>
                                    )}
                                </button>

                                <button
                                    onClick={() => {
                                        setShowMaterialsModal(true);
                                        setHasNewMaterials(false);
                                    }}
                                    className="relative h-8 sm:h-9 px-2 sm:px-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-white/10 flex items-center gap-1.5 sm:gap-2"
                                >
                                    <Folder className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    <span className="hidden xs:inline sm:inline">Materials</span>
                                    {hasNewMaterials && (
                                        <span className="absolute -top-1 -right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-indigo-500 rounded-full border-2 border-slate-900 shadow-lg animate-pulse" />
                                    )}
                                </button>
                                
                                <button
                                    onClick={() => setShowShareModal(true)}
                                    className="hidden md:flex h-9 sm:h-10 px-3 sm:px-4 text-[10px] font-black uppercase tracking-widest text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-white/10 items-center gap-2"
                                >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span className="hidden lg:inline">Invite</span>
                                </button>

                                <button
                                    onClick={() => setShowMobileMenu(true)}
                                    className="p-2 sm:p-2.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5"
                                >
                                    <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Video Mount Area */}
            <div
                style={{
                    position: 'fixed',
                    top: '56px',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#0a0a0a',
                    paddingBottom: '80px', // Space for Control Bar
                }}
                className="sm:!top-[64px] sm:pb-[100px]"
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
            </div>

            {/* Mobile Menu Slide-over Drawer */}
            {showMobileMenu && (
                <>
                    <div 
                        className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => setShowMobileMenu(false)}
                    />
                    <div className="fixed inset-y-0 right-0 w-[300px] z-[500] bg-slate-950 shadow-2xl border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Classroom Tools</h2>
                            <button onClick={() => setShowMobileMenu(false)} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            <div className="space-y-3">
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest px-1">Engagement</p>
                                <button
                                    onClick={() => { setShowParticipantsModal(true); setShowMobileMenu(false); }}
                                    className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400"><Users className="w-4 h-4" /></div>
                                        <span className="text-xs font-bold text-white">{isModerator ? 'Manage People' : 'Participants'}</span>
                                    </div>
                                    <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-black text-gray-400">{participants.length}</span>
                                </button>

                                <button
                                    onClick={() => { setShowShareModal(true); setShowMobileMenu(false); }}
                                    className="w-full flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all text-left"
                                >
                                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400"><Share2 className="w-4 h-4" /></div>
                                    <span className="text-xs font-bold text-white">Invite Students</span>
                                </button>

                                <button
                                    onClick={() => { 
                                        setShowMaterialsModal(true); 
                                        setShowMobileMenu(false); 
                                        setHasNewMaterials(false);
                                    }}
                                    className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 ${hasNewMaterials ? 'bg-indigo-600 shadow-lg shadow-indigo-600/30' : 'bg-slate-500/10'} rounded-lg flex items-center justify-center text-white`}><Folder className="w-4 h-4" /></div>
                                        <span className="text-xs font-bold text-white">Learning Materials</span>
                                    </div>
                                    {hasNewMaterials && <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />}
                                </button>
                            </div>

                            {isModerator && (
                                <div className="space-y-4">
                                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest px-1">Moderator Tools</p>
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-4">
                                        <div className="flex flex-col gap-3 items-center">
                                            <RecordingControls
                                                roomId={ctxSessionId || ''}
                                                lecturerId={ctxUserId || ''}
                                                classTitle={ctxTitle || 'Untitled Class'}
                                                isLecturer={isModerator}
                                            />
                                            <div className="w-full h-px bg-white/5" />
                                            <div className="flex items-center justify-center py-2">
                                                <SimpleAttendanceConsole sessionId={sessionId} isActive={session.isActive} />
                                            </div>
                                            {isHost && (
                                                <>
                                                    <div className="w-full h-px bg-white/5" />
                                                    <CoHostManagementPanel sessionId={sessionId} />
                                                    <div className="w-full h-px bg-white/5" />
                                                    <button
                                                        onClick={handleEndSession}
                                                        className="w-full flex items-center justify-center gap-3 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                                                    >
                                                        <Power className="w-4 h-4" />
                                                        End Session (Kick All)
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-white/5">
                            <button
                                onClick={handleLeave}
                                className="w-full flex items-center justify-center gap-3 py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                            >
                                <LogOut className="w-4 h-4" />
                                Exit Classroom
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Share/Invite Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowShareModal(false)} />
                    <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[2rem] p-6 sm:p-8 animate-in zoom-in-95 fade-in duration-300 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tight">Invite Students</h2>
                                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Share session access</p>
                            </div>
                            <button onClick={() => setShowShareModal(false)} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-center">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Meeting Code</p>
                                <div className="flex items-center justify-center gap-3">
                                    <span className="text-4xl font-black text-white tracking-[0.2em] font-mono">{meetingCode}</span>
                                    <button onClick={handleCopyCode} className={`p-2.5 rounded-xl transition-all ${copiedCode ? 'bg-emerald-500 text-white' : 'bg-white/10 text-indigo-400 hover:bg-white/20'}`}>
                                        {copiedCode ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Or share link</p>
                                <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/5 rounded-2xl">
                                    <div className="flex-1 px-3 py-1 text-xs text-slate-400 truncate font-medium">{fullLink}</div>
                                    <button onClick={handleCopyLink} className={`p-2 rounded-xl transition-all shrink-0 ${copiedLink ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400 hover:text-white'}`}>
                                        {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Participants Modal */}
            {showParticipantsModal && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowParticipantsModal(false)} />
                    <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2rem] flex flex-col max-h-[85vh] animate-in zoom-in-95 fade-in duration-300 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-white/5 shrink-0">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight">People</h2>
                                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">{participants.length} Participants</p>
                                </div>
                                <button onClick={() => setShowParticipantsModal(false)} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                            </div>

                            {isModerator && (
                                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1 flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400"><Mic className="w-5 h-5" /></div>
                                            <div>
                                                <p className="text-xs font-bold text-white">Smart Mic</p>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Auto-approve</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer scale-90">
                                            <input type="checkbox" checked={autoApproveMic} onChange={toggleAutoApproveMic} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>
                                    <button
                                        onClick={handleMuteAll}
                                        className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${isMutedAll ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white'}`}
                                    >
                                        {isMutedAll ? 'Unmute All' : 'Mute All'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                            {/* Pending Section */}
                            {isModerator && pendingRequests.length > 0 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Pending Requests</h3>
                                        <button onClick={handleGrantAll} className="text-[9px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase">Approve All</button>
                                    </div>
                                    <div className="space-y-2">
                                        {pendingRequests.map(request => (
                                            <div key={request.id} className="flex items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                                                <div className="min-w-0 pr-4">
                                                    <p className="font-bold text-xs text-white truncate">{request.participantName || 'Guest'}</p>
                                                    <p className="text-[9px] text-indigo-400 font-black uppercase mt-0.5">{request.requestType} requested</p>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <button onClick={() => handleGrant(request.participantId, request.requestType)} className="p-2 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-600/20"><Check className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeny(request.participantId)} className="p-2 bg-white/5 rounded-xl text-red-400 hover:bg-red-500/20"><X className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Participant List */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">In Classroom</h3>
                                <div className="space-y-2">
                                    {participants.map((p) => {
                                        const studentPerms = activePermissions.find(ap => ap.participantId === p.participantId)?.permissions;
                                        const hasMic = studentPerms?.micPermission;
                                        const hasCam = studentPerms?.cameraPermission;
                                        const isModP = p.metadata?.userId === sessionData?.hostId || p.metadata?.userId === sessionData?.lecturerId || p.role === 'moderator' || p.role === 'lecturer';
                                        const isCHostP = coHosts.some(ch => ch.userId === p.metadata?.userId);

                                        return (
                                            <div key={p.participantId} className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/[0.08] border border-white/5 rounded-2xl transition-all group">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 ${p.isLocal ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-slate-800'}`}>
                                                        {p.displayName?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-xs text-white truncate">{p.displayName || 'Guest'}</p>
                                                            {p.isLocal && <span className="text-[8px] font-black bg-white/10 text-indigo-400 px-1.5 py-0.5 rounded-lg uppercase tracking-widest">YOU</span>}
                                                        </div>
                                                        <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 flex items-center gap-1 ${isModP ? 'text-amber-400' : isCHostP ? 'text-purple-400' : 'text-slate-500'}`}>
                                                            {isModP ? <><Crown className="w-2.5 h-2.5" /> Host</> : isCHostP ? <><Shield className="w-2.5 h-2.5" /> Co-Host</> : 'Student'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    {/* Real-time Status Indicators */}
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-black/20 rounded-lg mr-2">
                                                        {p.audioMuted ? <MicOff className="w-3 h-3 text-red-400" /> : <Mic className={`w-3 h-3 ${p.isSpeaking ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />}
                                                        {p.videoMuted ? <VideoOff className="w-3 h-3 text-slate-600" /> : <VideoIcon className="w-3 h-3 text-indigo-400" />}
                                                    </div>

                                                    {!p.isLocal && isModerator && (
                                                        <>
                                                            <div className="hidden sm:flex items-center bg-black/40 p-1 rounded-xl gap-1">
                                                                <button
                                                                    onClick={() => hasMic ? handleRevoke(p.identity, 'microphone') : handleGrant(p.identity, 'microphone')}
                                                                    className={`p-1.5 rounded-lg transition-all ${hasMic ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'text-slate-500 hover:text-slate-300'}`}
                                                                    title={hasMic ? "Revoke Mic Permission" : "Grant Mic Permission"}
                                                                >
                                                                    <Shield className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => hasCam ? handleRevoke(p.identity, 'camera') : handleGrant(p.identity, 'camera')}
                                                                    className={`p-1.5 rounded-lg transition-all ${hasCam ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/10' : 'text-slate-500 hover:text-slate-300'}`}
                                                                    title={hasCam ? "Revoke Camera Permission" : "Grant Camera Permission"}
                                                                >
                                                                    <VideoIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => isModP ? kickParticipant(p.participantId) : handleMuteStudent(p.participantId, p.identity)}
                                                                className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                                                                title={isModP ? "Kick Participant" : "Mute Student"}
                                                            >
                                                                <UserX className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showMaterialsModal && (
                <MaterialsModal 
                    sessionId={sessionId}
                    userId={ctxUserId || ''}
                    isModerator={isModerator}
                    onClose={() => setShowMaterialsModal(false)}
                />
            )}
        </div>
    );
}
