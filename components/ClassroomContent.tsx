'use client';

import { useRouter } from 'next/navigation';
import { Session } from '@/lib/firebase/types';
import ThemeToggle from '@/components/ThemeToggle';
import { useClassroom } from '@/contexts/ClassroomContext';
import { Users, MicOff, UserX, Volume2, Share2, Copy, Check, Link, Home, LogOut, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { JitsiParticipant } from '@/contexts/ClassroomContext';
import { generateMeetingCode } from '@/lib/meetingCode';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

interface ClassroomContentProps {
    session: Session;
    user: any;
    profile: any;
    sessionId: string;
}

export default function ClassroomContent({ session, user, profile, sessionId }: ClassroomContentProps) {
    const router = useRouter();
    const { 
        leaveClass, 
        isFloating, 
        toggleFloating,
        participants,
        muteParticipant,
        muteAllParticipants,
        kickParticipant,
        askToUnmute,
    } = useClassroom();

    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    // Get or generate meeting code
    const meetingCode = session.meetingCode || generateMeetingCode(sessionId);
    const fullLink = typeof window !== 'undefined' ? `${window.location.origin}/classroom/${sessionId}` : '';

    // Save meeting code to Firestore if it doesn't exist
    useEffect(() => {
        const saveMeetingCode = async () => {
            if (!session.meetingCode && profile?.role === 'lecturer') {
                try {
                    const generatedCode = generateMeetingCode(sessionId);
                    await updateDoc(doc(db, 'sessions', sessionId), {
                        meetingCode: generatedCode
                    });
                    console.log('Meeting code saved to Firestore:', generatedCode);
                } catch (error) {
                    console.error('Failed to save meeting code:', error);
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
        if (profile?.role === 'lecturer') {
            router.push('/dashboard/lecturer');
        } else {
            router.push('/dashboard/student');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Mobile Header */}
            <header className="bg-gray-900/95 backdrop-blur-lg border-b border-gray-800 fixed top-0 left-0 right-0 z-50">
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
                            {profile?.role === 'lecturer' && (
                                <>
                                    <button
                                        onClick={() => setShowShareModal(true)}
                                        className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        <span className="hidden lg:inline">Invite</span>
                                    </button>
                                    <button
                                        onClick={() => setShowParticipantsModal(true)}
                                        className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Users className="w-4 h-4" />
                                        <span className="hidden lg:inline">Manage</span>
                                        <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">{participants.length}</span>
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                title="Home"
                            >
                                <Home className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleLeave}
                                className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
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
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu Dropdown */}
                    {showMobileMenu && (
                        <div className="md:hidden mt-3 pt-3 border-t border-gray-800 space-y-2">
                            {profile?.role === 'lecturer' && (
                                <>
                                    <button
                                        onClick={() => { setShowShareModal(true); setShowMobileMenu(false); }}
                                        className="w-full px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        Invite Students
                                    </button>
                                    <button
                                        onClick={() => { setShowParticipantsModal(true); setShowMobileMenu(false); }}
                                        className="w-full px-4 py-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Users className="w-4 h-4" />
                                        Manage Participants ({participants.length})
                                    </button>
                                </>
                            )}
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
            </header>

            {/* Main Content - Full Screen Video with header offset */}
            <div className="pt-[60px] sm:pt-[68px] h-screen">
                <div className={`${isFloating ? 'hidden' : 'w-full'} h-full bg-gray-900 relative`}>
                    {/* This ID is CRITICAL - GlobalClassroom mounts Jitsi here */}
                    <div id="classroom-video-mount" className="w-full h-full" />

                    {/* Float Button - Hidden on mobile */}
                    {!isFloating && (
                        <button
                            onClick={() => toggleFloating(true)}
                            className="hidden sm:block absolute top-4 right-4 z-[70] p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white backdrop-blur-sm transition-colors"
                            title="Float Video"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Share/Invite Modal - Lecturer Only */}
            {showShareModal && profile?.role === 'lecturer' && (
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
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl p-4 sm:p-6 mb-4 border border-indigo-100 dark:border-indigo-800">
                            <p className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold mb-2">Meeting Code</p>
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-2xl sm:text-3xl font-mono font-bold text-gray-900 dark:text-white tracking-wider">
                                    {meetingCode}
                                </p>
                                <button
                                    onClick={handleCopyCode}
                                    className={`p-3 rounded-xl transition-all shrink-0 ${
                                        copiedCode 
                                            ? 'bg-green-500 text-white' 
                                            : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900'
                                    }`}
                                >
                                    {copiedCode ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Full Link (Alternative) */}
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-4 sm:mb-6 border border-gray-100 dark:border-gray-700">
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
                                    className={`p-2 rounded-lg transition-all shrink-0 ${
                                        copiedLink 
                                            ? 'bg-green-500 text-white' 
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
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

            {/* Participants Modal - Lecturer Only */}
            {showParticipantsModal && profile?.role === 'lecturer' && (
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

                        {/* Quick Actions */}
                        <div className="flex gap-2 mb-4 shrink-0">
                            <button
                                onClick={() => muteAllParticipants()}
                                className="flex-1 px-4 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2"
                            >
                                <MicOff className="w-4 h-4" />
                                Mute All
                            </button>
                        </div>

                        {/* Participants List */}
                        <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3">
                            {participants.length === 0 ? (
                                <div className="text-center py-8 sm:py-12">
                                    <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">No participants yet</p>
                                    <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">Students will appear here when they join</p>
                                </div>
                            ) : (
                                participants.map((p: JitsiParticipant) => (
                                    <div 
                                        key={p.participantId} 
                                        className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all ${
                                            p.isLocal 
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' 
                                                : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0 ${
                                                p.isLocal 
                                                    ? 'bg-gradient-to-br from-indigo-500 to-purple-500' 
                                                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                                            }`}>
                                                {p.displayName?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm flex items-center gap-1 sm:gap-2 truncate">
                                                    <span className="truncate">{p.displayName || 'Guest'}</span>
                                                    {p.isLocal && (
                                                        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1 sm:px-1.5 py-0.5 rounded font-bold shrink-0">
                                                            You
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                                                    {p.role === 'moderator' ? 'Moderator' : 'Participant'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action Buttons - Only for non-local participants */}
                                        {!p.isLocal && (
                                            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                                <button
                                                    onClick={() => askToUnmute(p.participantId)}
                                                    className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                                    title="Ask to Unmute"
                                                >
                                                    <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                </button>
                                                <button
                                                    onClick={() => muteParticipant(p.participantId)}
                                                    className="p-1.5 sm:p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                                                    title="Mute Participant"
                                                >
                                                    <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Remove ${p.displayName} from the class?`)) {
                                                            kickParticipant(p.participantId);
                                                        }
                                                    }}
                                                    className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                                    title="Remove from Class"
                                                >
                                                    <UserX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Info Footer */}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 text-center">
                                You can also use Jitsi&apos;s built-in controls by clicking on participants in the video
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
