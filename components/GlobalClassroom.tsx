'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
    LiveKitRoom,
    LayoutContextProvider,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useRoomContext,
    useTracks,
    Chat,
    useLayoutContext,
    ConnectionStateToast,
    FocusLayout,
    FocusLayoutContainer,
    CarouselLayout,
    TrackReferenceOrPlaceholder,
    useIsSpeaking,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Room, Track, Participant, RoomEvent, ParticipantEvent, ConnectionState } from 'livekit-client';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useAlert } from '@/contexts/AlertContext';
import { Maximize2, X, Minimize2, Pin, PinOff, Video, User, Mic, MoreVertical, MicOff, VideoOff, UserX } from 'lucide-react';
import CustomControlBar from './CustomControlBar';
import ReactionOverlay, { ReactionOverlayHandle } from './ReactionOverlay';
import ClassroomChat from './ClassroomChat';
import { useLayoutConfig } from '@/hooks/useLayoutConfig';
import { useRaisedHands } from '@/hooks/useRaisedHands';
import { LayoutSelector } from './LayoutSelector';
import { RaisedHandsBanner } from './RaisedHandsBanner';
import { RecordingControls } from './RecordingControls';
import { InstantPiPManager } from './media/InstantPiPManager';
import { PiPPermissionPrompt } from './media/PiPPermissionPrompt';
import { SimpleAttendanceConsole } from './attendance/SimpleAttendanceConsole';
import { StudentVerificationModal } from './attendance/StudentVerificationModal';
import { ConnectionRecoveryStatus } from './ConnectionRecoveryStatus';
import { roomOptions } from '@/config/livekit.config';
import { useMediaPersistence } from '@/hooks/useMediaPersistence';
import { DeviceFailureHandler } from './media/DeviceFailureHandler';
import { useScreenSharePersistence } from '@/hooks/useScreenSharePersistence';
import { useScreenShareOrientation } from '@/hooks/useScreenShareOrientation';

// Inner component that can access the room context
function RoomConnector({ onRoomReady }: { onRoomReady: (room: Room) => void }) {
    const room = useRoomContext();

    // Auto-restore screen share across network reconnects
    useScreenSharePersistence();

    useEffect(() => {
        if (room) {
            onRoomReady(room);
        }
    }, [room, onRoomReady]);

    return null;
}

// Participant Menu Component
function ParticipantMenu({ participant, closeMenu }: { participant: Participant, closeMenu: () => void }) {
    const { userRole, muteParticipant, disableParticipantVideo, kickParticipant } = useClassroom();
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                closeMenu();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [closeMenu]);

    if (userRole !== 'lecturer') return null;

    return (
        <div
            ref={menuRef}
            className="absolute top-10 right-2 z-50 bg-gray-900 border border-gray-700 rounded-lg w-48 py-1 overflow-hidden"
            onClick={(e) => e.stopPropagation()} // Prevent tile click
        >
            <button
                onClick={() => { muteParticipant(participant.sid); closeMenu(); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 flex items-center gap-2 transition-colors"
                title="Mute Audio"
            >
                <MicOff className="w-4 h-4" />
                <span>Mute Audio</span>
            </button>
            <button
                onClick={() => { disableParticipantVideo(participant.sid); closeMenu(); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 flex items-center gap-2 transition-colors"
                title="Turn Off Video"
            >
                <VideoOff className="w-4 h-4" />
                <span>Stop Video</span>
            </button>
            <div className="h-px bg-gray-800 my-1" />
            <button
                onClick={() => { kickParticipant(participant.sid); closeMenu(); }}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2 transition-colors"
                title="Remove from Class"
            >
                <UserX className="w-4 h-4" />
                <span>Remove</span>
            </button>
        </div>
    );
}

// Wrapper for Tile to handle clicks while receiving props from GridLayout
function TileWrapper({ track, participant, onTileClick, className, ...props }: any) {
    // Check if camera is off/muted to show placeholder
    // We check both the track mute status and the participant-level flag for robustness
    const isCameraOff = track.source === Track.Source.Camera &&
        (track.publication?.isMuted || !participant.isCameraEnabled);

    const hookIsSpeaking = useIsSpeaking(participant);
    const [manualIsSpeaking, setManualIsSpeaking] = useState(participant.isSpeaking);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { userRole, userId } = useClassroom();

    // Extract photoURL from metadata
    let photoURL = null;
    try {
        if (participant.metadata) {
            const metadata = JSON.parse(participant.metadata);
            photoURL = metadata.photoURL;
        }
    } catch (e) {
        console.error('Error parsing participant metadata:', e);
    }

    // Check if we can show menu (lecturer only, and not on self)
    const showMenu = userRole === 'lecturer' && participant.identity !== userId;

    useEffect(() => {
        const handleSpeakingChanged = (speaking: boolean) => {
            setManualIsSpeaking(speaking);
        };
        participant.on(ParticipantEvent.IsSpeakingChanged, handleSpeakingChanged);
        return () => {
            participant.off(ParticipantEvent.IsSpeakingChanged, handleSpeakingChanged);
        };
    }, [participant]);

    const isSpeaking = hookIsSpeaking || manualIsSpeaking;

    return (
        <div
            className={`h-full w-full max-w-full relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 ${isSpeaking ? 'ring-4 ring-green-500' : 'ring-1 ring-white/10'} ${className || ''}`}
            onClick={() => onTileClick(track)}
        >
            <ParticipantTile trackRef={track} {...props} className={`!w-full !h-full [&_video]:!object-center ${track.source === Track.Source.ScreenShare ? '[&_video]:!object-contain' : '[&_video]:!object-cover'}`} />

            {/* Speaking Indicator Badge */}
            {isSpeaking && (
                <div className="absolute top-2 right-2 z-20 bg-green-500 text-black p-1 rounded-full animate-pulse border border-green-400">
                    <Mic className="w-3 h-3" />
                </div>
            )}

            {/* Moderator Menu Button */}
            {showMenu && (
                <div className="absolute top-2 right-2 z-30">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                        className="p-1 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>
                    {isMenuOpen && (
                        <ParticipantMenu
                            participant={participant}
                            closeMenu={() => setIsMenuOpen(false)}
                        />
                    )}
                </div>
            )}

            {/* Explicit Placeholder for Camera Off */}
            {isCameraOff && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 border border-gray-700 rounded-lg">
                    <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-2 overflow-hidden">
                        {photoURL ? (
                            <img src={photoURL} alt={participant.name || 'User'} className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-10 h-10 text-gray-400" />
                        )}
                    </div>
                    <span className="text-gray-300 font-medium text-sm">
                        {participant.name || participant.identity || 'Participant'}
                    </span>
                </div>
            )}

            {/* Click Safe Overlay */}
            <div className="absolute inset-0 z-10 opacity-0 hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto flex items-center justify-center bg-black/20">
                <div className="bg-black/80 p-1.5 rounded-full text-white">
                    <Maximize2 className="w-4 h-4" />
                </div>
            </div>
        </div>
    );
}

// Wrapper for Focus Layout to handle placeholders
function FocusWrapper({ trackRef, onParticipantClick, ...props }: any) {
    const isCameraOff = trackRef.source === Track.Source.Camera &&
        (trackRef.publication?.isMuted || !trackRef.participant.isCameraEnabled);

    const hookIsSpeaking = useIsSpeaking(trackRef.participant);
    const [manualIsSpeaking, setManualIsSpeaking] = useState(trackRef.participant.isSpeaking);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { userRole, userId } = useClassroom();

    // Check if we can show menu (lecturer only, and not on self)
    const showMenu = userRole === 'lecturer' && trackRef.participant.identity !== userId;

    useEffect(() => {
        const p = trackRef.participant;
        const handleSpeakingChanged = (speaking: boolean) => {
            setManualIsSpeaking(speaking);
        };
        p.on(ParticipantEvent.IsSpeakingChanged, handleSpeakingChanged);
        return () => {
            p.off(ParticipantEvent.IsSpeakingChanged, handleSpeakingChanged);
        };
    }, [trackRef.participant]);

    const isSpeaking = hookIsSpeaking || manualIsSpeaking;
    const isScreenShare = trackRef.source === Track.Source.ScreenShare;

    return (
        <div className={`relative w-full h-full group transition-all duration-500 bg-black ${isSpeaking ? 'ring-4 ring-green-500/50' : ''}`}>
            {/* Directly render ParticipantTile to ensure camera tracks display correctly full-screen, bypassing FocusLayout bugs */}
            <ParticipantTile
                trackRef={trackRef}
                onParticipantClick={onParticipantClick}
                className={`!w-full !h-full [&_video]:!object-center ${isScreenShare ? '[&_video]:!object-contain bg-black' : '[&_video]:!object-cover'}`}
                {...props}
            />

            {/* Moderator Menu Button - Top Right */}
            {showMenu && (
                <div className="absolute top-4 right-4 z-[60]">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                        className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors ring-1 ring-white/10"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>
                    {isMenuOpen && (
                        <ParticipantMenu
                            participant={trackRef.participant}
                            closeMenu={() => setIsMenuOpen(false)}
                        />
                    )}
                </div>
            )}

            {/* Explicit Placeholder for Camera Off in Focus Mode */}
            {isCameraOff && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 border-2 border-dashed border-gray-800 rounded-xl m-4 pointer-events-none">
                    <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mb-6 ring-4 ring-white/5 border border-gray-700">
                        <User className="w-16 h-16 text-gray-400" />
                    </div>
                    <span className="text-gray-200 font-bold text-2xl tracking-tight">
                        {trackRef.participant.name || trackRef.participant.identity || 'Participant'}
                    </span>
                    <span className="text-gray-500 mt-2 text-sm uppercase tracking-widest font-semibold">Camera Off</span>
                </div>
            )}
        </div>
    );
}

// Inner component to handle layout logic that needs LayoutContext
function InnerVideoLayout({
    onReaction,
    onLeave,
    reactionRef,
    tracks,
    onToggleChat,
    isChatOpen,
    layout,
    config,
    spotlightParticipant,
    setSpotlightParticipant,
    raisedHands,
    clearAllHands,
    lowerHand,
    onToggleHand,
    isHandRaised,
    userRole,
    setLayout,
    unreadChatCount,
    showAlert,
    customAlert,
    isActive,
    isDocked,
}: {
    onReaction: (emoji: string) => void;
    onLeave: () => void;
    reactionRef: React.RefObject<ReactionOverlayHandle | null>;
    tracks: TrackReferenceOrPlaceholder[];
    onToggleChat: () => void;
    isChatOpen: boolean;
    layout: any;
    config: any;
    spotlightParticipant: string | null;
    setSpotlightParticipant: (id: string | null) => void;
    raisedHands: any[];
    clearAllHands: () => void;
    lowerHand: (id: string) => void;
    onToggleHand: () => void;
    isHandRaised: boolean;
    userRole: string;
    setLayout: (layout: any) => void;
    unreadChatCount: number;
    showAlert: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    customAlert: (options: any) => void;
    isActive: boolean;
    isDocked?: boolean;
}) {
    // We don't rely on layoutContext for basic chat toggle anymore
    // but we can still access it if needed for other things
    const layoutContext = useLayoutContext() as any;
    const { sessionId, title, userId } = useClassroom();
    console.log('DEBUG: InnerVideoLayout', { sessionId, userId, userRole });
    const [focusTrack, setFocusTrack] = useState<TrackReferenceOrPlaceholder | null>(null);
    const [userDisabledAutoFocus, setUserDisabledAutoFocus] = useState(false);
    const room = useRoomContext();
    const [activeSpeakers, setActiveSpeakers] = useState<Participant[]>([]);
    const [isMobileLandscape, setIsMobileLandscape] = useState(false);
    const { isScreenSharing, isMobile } = useScreenShareOrientation();

    useEffect(() => {
        const checkOrientation = () => {
            setIsMobileLandscape(window.innerWidth > window.innerHeight && window.innerWidth < 1024);
        };
        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        return () => window.removeEventListener('resize', checkOrientation);
    }, []);

    useEffect(() => {
        if (!room) return;
        const handleActiveSpeakersChanged = (speakers: Participant[]) => {
            setActiveSpeakers(speakers);
        };
        room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
        return () => {
            room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
        };
    }, [room]);

    // --- Pagination Logic ---
    const sortedTracks = useMemo(() => {
        return [...tracks].sort((a, b) => {
            // 1. Spotlighted participant always first
            if (spotlightParticipant === a.participant.sid) return -1;
            if (spotlightParticipant === b.participant.sid) return 1;

            // 2. Screen share always higher priority
            if (a.source === Track.Source.ScreenShare && b.source !== Track.Source.ScreenShare) return -1;
            if (b.source === Track.Source.ScreenShare && a.source !== Track.Source.ScreenShare) return 1;

            // 3. Active speakers move to top
            const aIsSpeaking = activeSpeakers.some((p) => p.sid === a.participant.sid) || a.participant.isSpeaking;
            const bIsSpeaking = activeSpeakers.some((p) => p.sid === b.participant.sid) || b.participant.isSpeaking;
            if (aIsSpeaking && !bIsSpeaking) return -1;
            if (bIsSpeaking && !aIsSpeaking) return 1;

            return 0;
        });
    }, [tracks, spotlightParticipant, activeSpeakers]);

    const PAGE_SIZE = config.maxVisible; // Maximum tiles per page
    const [currentPage, setCurrentPage] = useState(1);

    // Calculate total pages
    const totalPages = Math.ceil(sortedTracks.length / PAGE_SIZE);

    // PiP Drag State
    const [pipPosition, setPipPosition] = useState({ x: 16, y: 16 }); // 16px from bottom-right initial
    const [isDraggingPip, setIsDraggingPip] = useState(false);
    const pipDragRef = useRef<{ startX: number, startY: number, startPipX: number, startPipY: number } | null>(null);

    const startPipDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsDraggingPip(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        pipDragRef.current = {
            startX: clientX,
            startY: clientY,
            startPipX: pipPosition.x,
            startPipY: pipPosition.y
        };
    }, [pipPosition]);

    useEffect(() => {
        const handlePipMove = (e: MouseEvent | TouchEvent) => {
            if (!isDraggingPip || !pipDragRef.current) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

            const deltaX = pipDragRef.current.startX - clientX;
            const deltaY = pipDragRef.current.startY - clientY;

            setPipPosition({
                x: Math.max(0, Math.min(window.innerWidth - 100, pipDragRef.current.startPipX + deltaX)),
                y: Math.max(0, Math.min(window.innerHeight - 100, pipDragRef.current.startPipY + deltaY))
            });
        };

        const handlePipEnd = () => {
            setIsDraggingPip(false);
            pipDragRef.current = null;
        };

        if (isDraggingPip) {
            window.addEventListener('mousemove', handlePipMove);
            window.addEventListener('mouseup', handlePipEnd);
            window.addEventListener('touchmove', handlePipMove, { passive: false });
            window.addEventListener('touchend', handlePipEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handlePipMove);
            window.removeEventListener('mouseup', handlePipEnd);
            window.removeEventListener('touchmove', handlePipMove);
            window.removeEventListener('touchend', handlePipEnd);
        };
    }, [isDraggingPip]);


    // --- Automatic Host Focus ---
    useEffect(() => {
        // Find lecturer tracks
        const lecturerTracks = tracks.filter(t => {
            try {
                const metadata = JSON.parse(t.participant.metadata || '{}');
                return metadata.role === 'lecturer';
            } catch (e) {
                return false;
            }
        });

        // Prefer screen share over camera
        const hostScreenShare = lecturerTracks.find(t => t.source === Track.Source.ScreenShare);
        const hostCamera = lecturerTracks.find(t => t.source === Track.Source.Camera || t.source === Track.Source.Unknown);
        const autoFocusTarget = hostScreenShare || hostCamera;

        if (autoFocusTarget && !userDisabledAutoFocus) {
            // Auto-focus the host if not already focused
            if (!focusTrack || focusTrack.participant.sid !== autoFocusTarget.participant.sid || focusTrack.source !== autoFocusTarget.source) {
                console.log('⚡ [InnerVideoLayout] Auto-focusing Host (Lecturer)');
                setTimeout(() => setFocusTrack(autoFocusTarget), 0);
            }
        } else if (focusTrack && !userDisabledAutoFocus) {
            // If the focused track no longer exists, unfocus to revert to grid
            const stillExists = tracks.some(t => t.participant.sid === focusTrack.participant.sid && t.source === focusTrack.source);
            if (!stillExists) {
                setTimeout(() => setFocusTrack(null), 0);
            }
        }
    }, [tracks, userDisabledAutoFocus]);

    // Get current page tracks
    const paginatedTracks = sortedTracks.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(p => p + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(p => p - 1);
    };
    // ------------------------

    // Filter out the focus track from other tracks for the carousel
    const carouselTracks = sortedTracks.filter(t => !focusTrack || (t.participant.sid !== focusTrack.participant.sid || t.source !== focusTrack.source));

    const handleTileClick = (track: TrackReferenceOrPlaceholder) => {
        if (!track || !track.participant) {
            console.warn('Attempted to focus an invalid track:', track);
            return;
        }

        if (focusTrack && focusTrack.participant?.sid === track.participant.sid && focusTrack.source === track.source) {
            setFocusTrack(null); // Unfocus
            setUserDisabledAutoFocus(true);
        } else {
            setFocusTrack(track); // Focus
            setUserDisabledAutoFocus(false); // Re-enable auto focus since the user explicitly focused someone
        }
    };

    // If in PiP mode, the video element itself handles the display. 
    // The main UI stays as a classroom.

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] relative">
            {/* CSS for immersive view and vertical video filling */}
            <style jsx global>{`
                .lk-video-conference .lk-control-bar { display: none !important; }
                @media (max-width: 1024px) {
                    .mobile-hide-force { display: none !important; }
                    /* Let Tailwind classes handle object-fit (cover vs contain) */
                    .immersive-video-container video {
                        height: 100% !important;
                        width: 100% !important;
                    }
                }
            `}</style>

            {/* Top Navbar - Hide if docked OR on mobile focus for immersive feel */}
            {(!isDocked && !(isMobile && focusTrack)) && (
                <div className="h-12 bg-black/80 border-b border-white/5 px-4 flex items-center justify-between z-[100]">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600/20 p-1.5 rounded-lg border border-blue-500/20">
                            <Video className="w-4 h-4 text-blue-500" />
                        </div>
                        <span className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                            {title || 'Current Class'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Removed Lecturer tools from here so they aren't hidden when docked */}
                    </div>
                </div>
            )}



            <div className="flex-1 relative overflow-hidden flex flex-col sm:flex-row">


                <div className="flex-1 relative">
                    <RaisedHandsBanner
                        isLecturer={userRole === 'lecturer'}
                        raisedHands={raisedHands}
                        onClearAll={clearAllHands}
                        onLowerHand={lowerHand}
                    />
                    {focusTrack ? (
                        <div className="absolute inset-0 flex bg-black z-50">
                            {/* Focused Track (Host / Screen Share) */}
                            <div className={`flex-1 relative h-full min-h-0 min-w-0 ${focusTrack.source === Track.Source.ScreenShare ? '[&_video]:!object-contain [&_video]:!w-full [&_video]:!h-full' : 'immersive-video-container [&_video]:!h-full'}`}>
                                <FocusWrapper trackRef={focusTrack} onParticipantClick={() => setFocusTrack(null)} />

                                {/* Always show Minimize button so students can return to grid manually */}
                                <button
                                    onClick={() => {
                                        setFocusTrack(null);
                                        setUserDisabledAutoFocus(true);
                                    }}
                                    className="absolute top-4 left-4 z-[60] bg-black/80 text-white px-3 py-2 rounded-xl hover:bg-black ring-1 ring-white/20 flex items-center gap-2"
                                    title="Switch to Grid View"
                                >
                                    <Minimize2 className="w-5 h-5" />
                                    <span className="hidden sm:inline text-sm font-semibold">Grid View</span>
                                </button>
                            </div>

                            {/* Floating Joiner PiP - hidden during screen share to avoid blocking content */}
                            {focusTrack.source !== Track.Source.ScreenShare && (
                                <div
                                    className={`absolute z-[70] flex flex-col gap-2 pointer-events-auto cursor-grab active:cursor-grabbing ${isDraggingPip ? 'transition-none' : 'transition-all duration-300'}`}
                                    style={{ right: `${pipPosition.x}px`, bottom: `${pipPosition.y}px` }}
                                    onMouseDown={startPipDrag}
                                    onTouchStart={startPipDrag}
                                >
                                    {carouselTracks.filter(t => {
                                        if (userRole === 'lecturer') {
                                            return !t.participant.isLocal;
                                        }
                                        return t.participant.isLocal || activeSpeakers.some(s => s.sid === t.participant.sid);
                                    }).slice(0, userRole === 'lecturer' ? 4 : 3).map((t) => (
                                        <div key={`${t.participant.sid}-${t.source}`} className="w-28 sm:w-48 aspect-[3/4] sm:aspect-video rounded-xl overflow-hidden ring-2 ring-white/20 bg-gray-900 pointer-events-none border border-gray-800">
                                            <TileWrapper
                                                track={t}
                                                participant={t.participant}
                                                onTileClick={handleTileClick}
                                                className="w-full h-full"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="absolute inset-0 grid-layout-wrapper">
                            {/* Pagination Controls Overlay */}
                            {totalPages > 1 && (
                                <div className="absolute z-50 bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 px-4 py-2 rounded-full border border-white/10">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 1}
                                        className="text-white disabled:opacity-30 hover:text-blue-400 transition-colors font-bold"
                                    >
                                        &larr; Prev
                                    </button>
                                    <span className="text-white text-sm font-medium">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={currentPage === totalPages}
                                        className="text-white disabled:opacity-30 hover:text-blue-400 transition-colors font-bold"
                                    >
                                        Next &rarr;
                                    </button>
                                </div>
                            )}

                            {/* SCENARIO A: Screen Share Active - CSS Landscape Rotation (mobile only) */}
                            {paginatedTracks.some(t => t.source === Track.Source.ScreenShare) ? (
                                <div className="absolute inset-0 overflow-hidden bg-black">
                                    {paginatedTracks.filter(t => t.source === Track.Source.ScreenShare).map(trackRef => (
                                        <div key={trackRef.participant.sid + '_lsscreen'}>
                                            {/* Mobile: fixed overlay rotated 90deg to fake landscape */}
                                            <div className="block sm:hidden" style={{
                                                position: 'fixed',
                                                top: 0, left: 0, right: 0, bottom: 0,
                                                zIndex: 200,
                                                background: 'black',
                                                overflow: 'hidden',
                                            }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    width: '100vh',
                                                    height: '100vw',
                                                    transform: 'translate(-50%, -50%) rotate(90deg)',
                                                    transformOrigin: 'center center',
                                                    overflow: 'hidden',
                                                }}>
                                                    <TileWrapper
                                                        track={trackRef}
                                                        participant={trackRef.participant}
                                                        onTileClick={handleTileClick}
                                                        className="w-full h-full !rounded-none"
                                                    />
                                                </div>
                                            </div>
                                            {/* Desktop: normal view */}
                                            <div className="hidden sm:block absolute inset-0">
                                                <TileWrapper
                                                    track={trackRef}
                                                    participant={trackRef.participant}
                                                    onTileClick={handleTileClick}
                                                    className="w-full h-full !rounded-none"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* SCENARIO B: Standard Camera Grid (No Screen Share) */
                                <div className="flex flex-wrap items-center justify-center content-center gap-2 sm:gap-4 w-full h-full p-2 sm:p-4 overflow-y-auto pb-28 sm:pb-4">
                                    {paginatedTracks.map((trackRef, index, arr) => {
                                        const count = arr.length;
                                        let containerClass = 'w-[calc(50%-0.5rem)] sm:w-[calc(50%-1rem)] md:w-[calc(33.33%-1rem)] lg:w-[calc(25%-1rem)] aspect-[3/4] sm:aspect-video shrink-0';
                                        if (count === 1) {
                                            containerClass = 'w-full max-w-5xl aspect-[3/4] sm:aspect-video shrink-0';
                                        } else if (count === 2) {
                                            containerClass = 'w-[calc(50%-0.5rem)] sm:w-[calc(50%-1rem)] max-w-4xl aspect-[3/4] sm:aspect-video shrink-0';
                                        } else if (count <= 4) {
                                            containerClass = 'w-[calc(50%-0.5rem)] sm:w-[calc(50%-1rem)] lg:w-[calc(50%-1rem)] max-w-3xl aspect-[3/4] sm:aspect-video shrink-0';
                                        }
                                        return (
                                            <div key={trackRef.participant.sid + '_' + trackRef.source} className={`${containerClass} transition-all duration-300 flex justify-center`}>
                                                <TileWrapper
                                                    track={trackRef}
                                                    participant={trackRef.participant}
                                                    onTileClick={handleTileClick}
                                                    className="w-full h-full bg-gray-900 rounded-xl overflow-hidden border border-gray-800"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>



            {/* Custom Controls */}
            <CustomControlBar
                roomId={sessionId!}
                isLecturer={userRole === 'lecturer'}
                onReaction={onReaction}
                onLeave={onLeave}
                onToggleChat={onToggleChat}
                isChatOpen={isChatOpen}
                onToggleHand={onToggleHand}
                isHandRaised={isHandRaised}
                unreadChatCount={unreadChatCount}
                showAlert={showAlert}
                customAlert={customAlert}
            />

            {/* Chat Sidebar - Persistent */}
            <div
                className={`absolute left-4 right-4 sm:left-auto sm:right-4 top-20 bottom-24 sm:w-80 z-[100] rounded-xl overflow-hidden border border-gray-800 bg-gray-900 flex flex-col transition-all duration-300 ease-in-out ${isChatOpen
                    ? 'opacity-100 translate-x-0 pointer-events-auto'
                    : 'opacity-0 translate-x-[120%] pointer-events-none'
                    }`}
            >
                {/* Custom Header for Chat */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
                    <h3 className="text-sm font-bold text-white">Class Chat</h3>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleChat();
                        }}
                        className="flex w-10 h-10 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 active:bg-gray-700 transition-colors -mr-2"
                        aria-label="Close Chat"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Chat Component */}
                <div className="flex-1 min-h-0 bg-gray-900">
                    {sessionId ? (
                        <ClassroomChat sessionId={sessionId} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                            Connecting to chat...
                        </div>
                    )}
                </div>
            </div>

            {typeof window !== 'undefined' && createPortal(
                <ReactionOverlay ref={reactionRef} />,
                document.body
            )}
        </div>
    );
}

function VideoLayout({
    onReaction,
    onLeave,
    reactionRef,
    onToggleChat,
    isChatOpen,
    unreadChatCount,
    userId,
    userRole,
    userName,
    isActive,
    showAlert,
    customAlert,
    isDocked,
}: {
    onReaction: (emoji: string) => void;
    onLeave: () => void;
    reactionRef: React.RefObject<ReactionOverlayHandle | null>;
    onToggleChat: () => void;
    isChatOpen: boolean;
    userRole: string;
    userName: string;
    unreadChatCount: number;
    userId: string;
    isActive: boolean;
    showAlert: (message: string, type: any) => void;
    customAlert: (options: any) => void;
    isDocked?: boolean;
}) {
    const { layout, setLayout, config, spotlightParticipant, setSpotlightParticipant } = useLayoutConfig();
    const { raisedHands, raiseHand, lowerHand, clearAllHands } = useRaisedHands();
    const [isHandRaised, setIsHandRaised] = useState(false);

    const onToggleHand = useCallback(() => {
        if (isHandRaised) {
            lowerHand(userId);
        } else {
            raiseHand(userId, userName);
        }
        setIsHandRaised(!isHandRaised);
    }, [isHandRaised, lowerHand, raiseHand, userId, userName]);

    const room = useRoomContext();
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    ).filter(track => {
        if (!track.participant || !track.participant.sid) return false;
        // Ensure participant actually exists in the room or is local
        if (room) {
            const isLocal = track.participant.sid === room.localParticipant.sid;
            const isRemote = room.remoteParticipants.has(track.participant.identity);
            return isLocal || isRemote;
        }
        return true;
    });

    // Sync hand status if cleared by lecturer
    useEffect(() => {
        if (raisedHands.length === 0 && isHandRaised) {
            setTimeout(() => setIsHandRaised(false), 0);
        }
    }, [raisedHands, isHandRaised]);

    console.log('DEBUG: GlobalClassroom tracks:', tracks.length, tracks);

    return (
        <LayoutContextProvider>
            <InnerVideoLayout
                onReaction={onReaction}
                onLeave={onLeave}
                reactionRef={reactionRef}
                tracks={tracks}
                onToggleChat={onToggleChat}
                isChatOpen={isChatOpen}
                unreadChatCount={unreadChatCount}
                layout={layout}
                config={config}
                spotlightParticipant={spotlightParticipant}
                setSpotlightParticipant={setSpotlightParticipant}
                raisedHands={raisedHands}
                clearAllHands={clearAllHands}
                lowerHand={lowerHand}
                onToggleHand={onToggleHand}
                isHandRaised={isHandRaised}
                userRole={userRole}
                setLayout={setLayout}
                showAlert={showAlert}
                customAlert={customAlert}
                isActive={isActive}
                isDocked={isDocked}
            />
        </LayoutContextProvider>
    );
}

export default function GlobalClassroom() {
    const {
        sessionId,
        title,
        userName,
        userRole,
        userId,
        isActive,
        isHost,
        isMini,
        isFloating,
        toggleMinimize,
        leaveClass,
        setLiveKitRoom,
        toggleChat,
        isChatOpen,
        unreadChatCount,
        token,
        setToken,
    } = useClassroom();
    const { showAlert, customAlert, showConfirm } = useAlert();

    const [mounted, setMounted] = useState(false);
    const [tokenError, setTokenError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const roomRef = useRef<Room | null>(null);

    // Suppress LiveKit's internal releasePointerCapture error (draggable.tsx)
    // This is a harmless browser race condition on mobile touch events
    useEffect(() => {
        const handler = (e: ErrorEvent) => {
            if (e.message?.includes('releasePointerCapture')) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };
        window.addEventListener('error', handler);
        return () => window.removeEventListener('error', handler);
    }, []);

    // PERSISTENT GESTURE MONITOR
    // This ensures that every click "re-primes" the browser interaction status
    // which is needed for PiP if the user manually closes it.
    useEffect(() => {
        const resumeMedia = async () => {
            console.log('🔈 [GlobalClassroom] Gesture refreshed: Re-priming media...');
            try {
                // 1. Resume AudioContext (re-check if suspended)
                const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
                if (AC) {
                    const ctx = new AC();
                    if (ctx.state === 'suspended') await ctx.resume();
                }

                // 2. Mark interaction for media restoration
                if (typeof window !== 'undefined' && sessionStorage.getItem('podium_user_interacted') !== 'true') {
                    console.log('✅ [GlobalClassroom] Interaction established via gesture');
                    sessionStorage.setItem('podium_user_interacted', 'true');
                }

                // 3. Continuous Priming for PiP
                // Browsers often disable auto-PiP if manually closed.
                // We re-enable it on every interaction to stay resilient.
                const videos = document.querySelectorAll('video');
                videos.forEach(video => {
                    if (!(video as any).autoPictureInPicture) {
                        (video as any).autoPictureInPicture = true;
                    }
                    if (video.srcObject || video.src) {
                        video.play().catch(e => console.debug('Playback refresh deferred:', e));
                    }
                });
            } catch (err) { }
        };

        window.addEventListener('click', resumeMedia);
        window.addEventListener('touchstart', resumeMedia);
        window.addEventListener('keydown', resumeMedia);

        return () => {
            window.removeEventListener('click', resumeMedia);
            window.removeEventListener('touchstart', resumeMedia);
            window.removeEventListener('keydown', resumeMedia);
        };
    }, []);
    // Dragging State for floating/mini mode (desktop only)
    const [position, setPosition] = useState({ x: 20, y: 400 });
    const [size, setSize] = useState({ width: 400, height: 300 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const router = useRouter();

    const [isPiPActive, setIsPiPActive] = useState(false);

    // Use centralized LiveKit options for stability
    const finalRoomOptions = useMemo(() => ({
        ...roomOptions,
        publishDefaults: {
            ...roomOptions.publishDefaults,
            simulcast: true,
        }
    }), []);

    const connectOptions = useMemo(() => ({
        autoSubscribe: true,
    }), []);

    // PERMISSIONS API SAFETY GUARD
    // Some browsers (like Edge or Chrome in mobile emulation) throw a TypeError
    // if navigator.permissions.query is called with a name they don't recognize
    // or if called in a specific context. We wrap it to be more resilient.
    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.permissions || !(navigator.permissions as any).query) return;

        const originalQuery = navigator.permissions.query.bind(navigator.permissions);

        (navigator.permissions as any).query = async (descriptor: any) => {
            try {
                return await originalQuery(descriptor);
            } catch (error: any) {
                if (error instanceof TypeError && error.message.includes('Permissions check failed')) {
                    console.warn('🛡️ [PermissionsGuard] Suppressed TypeError for descriptor:', descriptor.name);
                    // Return a mock permission state to avoid breaking the caller
                    return {
                        state: 'denied',
                        name: descriptor.name,
                        onchange: null,
                        addEventListener: () => { },
                        removeEventListener: () => { },
                        dispatchEvent: () => false,
                    } as any;
                }
                throw error;
            }
        };
    }, []);

    // Reaction Overlay Ref
    // Reaction Overlay Ref
    const reactionRef = useRef<ReactionOverlayHandle>(null);



    // Get LiveKit server URL from environment
    const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://your-project.livekit.cloud';

    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            setPosition({ x: 20, y: window.innerHeight - 320 });
        }

        // Cleanup on unmount
        return () => {
            if (roomRef.current && roomRef.current.state !== ConnectionState.Disconnected) {
                console.log('Classroom unmounting, disconnecting room...');
                roomRef.current.disconnect();
                roomRef.current = null;
            }
        };
    }, []); // Only run once on mount/unmount

    // Force close when class becomes inactive
    useEffect(() => {
        if (!isActive) {
            if (roomRef.current && roomRef.current.state !== ConnectionState.Disconnected) {
                console.log('Force disconnecting room as class is inactive');
                roomRef.current.disconnect();
                roomRef.current = null;
            }
        }
    }, [isActive]);

    // Ref to track if we're currently fetching to prevent double-firing
    const isFetchingRef = useRef(false);

    // Fetch token when session becomes active if not already pre-warmed
    useEffect(() => {
        if (!isActive || !sessionId || !userName || !userRole || !userId) {
            return;
        }

        // If we already have a token for this session/user, don't refetch
        if (token) return;

        const fetchToken = async () => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;

            setIsConnecting(true);
            setTokenError(null);

            try {
                console.log('Fetching LiveKit token (fallback) for:', sessionId, userName, userId);
                const response = await fetch('/api/livekit/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomName: `podium_${sessionId}`,
                        participantName: userName,
                        participantId: userId || `user_${Date.now()}`,
                        role: userRole,
                        userId: userId,
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to get token');
                }

                const data = await response.json();
                console.log('Token received');
                setToken(data.token);
            } catch (error: any) {
                console.error('Error fetching LiveKit token:', error);
                setTokenError(error.message || 'Failed to connect to video service');
            } finally {
                setIsConnecting(false);
                isFetchingRef.current = false;
            }
        };

        fetchToken();
    }, [isActive, sessionId, userName, userRole, userId, token, setToken]);

    // Dragging handlers - desktop only
    const handleMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize') => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'drag') {
            setIsDragging(true);
            dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        } else {
            setIsResizing(true);
            dragStartRef.current = { x: e.clientX, y: e.clientY };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragStartRef.current.x,
                    y: e.clientY - dragStartRef.current.y
                });
            } else if (isResizing) {
                const deltaX = e.clientX - dragStartRef.current.x;
                const deltaY = e.clientY - dragStartRef.current.y;
                setSize(prev => ({
                    width: Math.max(300, prev.width + deltaX),
                    height: Math.max(200, prev.height + deltaY)
                }));
                dragStartRef.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing]);

    // Determine mount point for docked mode
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

    useEffect(() => {
        const checkMount = () => {
            const el = document.getElementById('classroom-video-mount');
            if (el && el !== mountNode) {
                setMountNode(el);
            } else if (!el && mountNode) {
                setMountNode(null);
            }
        };
        checkMount();
        const interval = setInterval(checkMount, 100);
        const observer = new MutationObserver(checkMount);
        observer.observe(document.body, { childList: true, subtree: true });
        const timeout = setTimeout(() => clearInterval(interval), 5000);
        return () => {
            observer.disconnect();
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [pathname, isMini, isFloating, mountNode]);

    // Handle room ready
    const handleRoomReady = useCallback((room: Room) => {
        console.log('LiveKit room ready:', room.name);
        roomRef.current = room;
        setLiveKitRoom(room);
    }, [setLiveKitRoom]);

    // Handle leaving the class
    const handleLeave = useCallback(() => {
        if (roomRef.current) {
            roomRef.current.disconnect();
        }
        leaveClass();

        // Navigate to dashboard to ensure full exit
        router.push('/dashboard');
    }, [leaveClass, userRole, router]);

    const handleDisconnected = useCallback(() => {
        console.log('LiveKit room disconnected');
        roomRef.current = null;
        setLiveKitRoom(null);
    }, [setLiveKitRoom]);

    const handleLiveKitError = useCallback((e: Error) => {
        // Suppress errors that are expected during teardown or transient network issues
        const isSuppressed =
            e.message.includes('Negotiation') ||
            e.message.includes('Received leave request') ||
            e.message.includes('Signal connection closed') ||
            e.message.toLowerCase().includes('could not establish pc connection') ||
            e.message.toLowerCase().includes('could not connect after') ||
            e.message.includes("participant, that's not present");

        if (e.message.toLowerCase().includes('expired') || e.message.toLowerCase().includes('validation failed')) {
            console.warn('LiveKit token expired or invalid, clearing token to trigger refetch');
            setToken(null);
            return;
        }

        if (isSuppressed) {
            console.warn('Suppressed LiveKit error:', e.message);
        } else {
            console.error('LiveKit error:', e);
            setTokenError(e.message);
        }
    }, [setToken]);

    // Handle maximize - go to classroom page
    const handleMaximize = useCallback(() => {
        toggleMinimize(false);
        router.push(`/classroom/${sessionId}`);
    }, [toggleMinimize, router, sessionId]);

    // Handle PiP Toggle (Placeholder for new implementation)
    const handleTogglePiP = useCallback(async () => {
        // We will implement the new Video Element PiP here or in a separate component
        console.log('Toggle PiP clicked');
        setIsPiPActive(!isPiPActive);
    }, [isPiPActive]);

    // Send Reaction
    const handleReaction = useCallback(async (emoji: string) => {
        if (roomRef.current) {
            const encoder = new TextEncoder();
            const payload = JSON.stringify({ type: 'reaction', emoji });
            const data = encoder.encode(payload);
            await roomRef.current.localParticipant.publishData(data, {
                reliable: true,
                topic: 'reaction',
            });
            // Show local reaction instantly
            if (reactionRef.current) {
                reactionRef.current.addReaction(emoji);
            }
        }
    }, []);


    if (!mounted || !isActive || !sessionId || !userName) return null;

    // Show loading state while connecting
    if (isConnecting || !token) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#111111'
            }}>
                <div style={{ textAlign: 'center' }}>
                    {tokenError ? (
                        <>
                            <div style={{ color: '#ef4444', fontSize: '1.25rem', marginBottom: '1rem' }}>Connection Error</div>
                            <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>{tokenError}</p>
                            <button
                                onClick={() => leaveClass()}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                Go Back
                            </button>
                        </>
                    ) : (
                        <>
                            <div style={{
                                width: '3rem',
                                height: '3rem',
                                border: '4px solid rgba(59, 130, 246, 0.3)',
                                borderTopColor: '#3b82f6',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto'
                            }} />
                            <p style={{ marginTop: '1rem', color: '#9ca3af' }}>Connecting to classroom...</p>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // LiveKit video content - Fully decomposed layout
    const LiveKitContent = (
        <LiveKitRoom
            serverUrl={liveKitUrl}
            token={token}
            connect={!!token && isActive} // Only connect if we have a token AND class is active
            video={false} // Manage manually via Layout
            audio={false} // Manage manually via Layout
            onConnected={() => setIsConnecting(false)}
            onDisconnected={handleDisconnected}
            onError={handleLiveKitError}
            // Custom connection options for stability
            options={finalRoomOptions}
            connectOptions={connectOptions}
            className="w-full h-full"
        >
            <PiPPermissionPrompt />
            <InstantPiPManager />
            <ConnectionRecoveryStatus />
            <DeviceFailureHandler />

            {/* Student Attendance Verification Modal */}
            {userRole !== 'lecturer' && (
                <StudentVerificationModal sessionId={sessionId!} />
            )}
            <VideoLayout
                onReaction={handleReaction}
                onLeave={handleLeave}
                reactionRef={reactionRef}
                onToggleChat={toggleChat}
                isChatOpen={!!isChatOpen}
                userRole={userRole || 'student'}
                userId={userId || ''}
                userName={userName || ''}
                unreadChatCount={unreadChatCount}
                isActive={isActive}
                showAlert={showAlert}
                customAlert={customAlert}
                isDocked={!!(mountNode && !isMini && !isFloating)}
            />
            <RoomConnector onRoomReady={handleRoomReady} />
            <RoomAudioRenderer />
        </LiveKitRoom>
    );

    // If PiP is active, we just show a subtle indicator or nothing special in the main UI
    // since the video element itself will be in PiP mode.

    // Check if on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    // DOCKED MODE - User is on the classroom page, render in mount point
    if (mountNode && !isMini && !isFloating) {
        return createPortal(
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#0a0a0a'
            }}>
                {LiveKitContent}
            </div>,
            mountNode
        );
    }

    // MINI/FLOATING MODE
    if (isMini || isFloating) {
        // On mobile: always show full screen
        if (isMobile) {
            return createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 9999,
                    backgroundColor: '#0a0a0a',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Header */}
                    <div style={{
                        height: '48px',
                        backgroundColor: '#1f2937',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0 12px',
                        borderBottom: '1px solid #374151',
                        flexShrink: 0
                    }}>
                        <span style={{ color: 'white', fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px' }}>
                            {title}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleMaximize}
                                style={{
                                    padding: '8px',
                                    backgroundColor: '#374151',
                                    color: 'white',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Maximize2 style={{ width: '16px', height: '16px' }} />
                            </button>
                            <button
                                onClick={handleLeave}
                                style={{
                                    padding: '8px',
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X style={{ width: '16px', height: '16px' }} />
                            </button>
                        </div>
                    </div>
                    {/* Video fills remaining space */}
                    <div style={{ flex: 1, minHeight: 0 }}>
                        {LiveKitContent}
                    </div>
                </div>,
                document.body
            );
        }

        // On desktop: draggable floating window
        return createPortal(
            <div style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
                zIndex: 9999
            }}>
                <div style={{
                    backgroundColor: '#1f2937',
                    width: '100%',
                    height: '100%',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #374151',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Drag Handle */}
                    <div
                        onMouseDown={(e) => handleMouseDown(e, 'drag')}
                        style={{
                            height: '40px',
                            backgroundColor: '#1f2937',
                            cursor: 'grab',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0 12px',
                            borderBottom: '1px solid #374151',
                            flexShrink: 0
                        }}
                    >
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                            {title}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleMaximize(); }}
                                style={{
                                    padding: '6px',
                                    backgroundColor: '#374151',
                                    color: 'white',
                                    borderRadius: '4px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Maximize2 style={{ width: '16px', height: '16px' }} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleLeave(); }}
                                style={{
                                    padding: '6px',
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    borderRadius: '4px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X style={{ width: '16px', height: '16px' }} />
                            </button>
                        </div>
                    </div>
                    {/* LiveKit fills remaining space */}
                    <div style={{ flex: 1, minHeight: 0, backgroundColor: '#0a0a0a' }}>
                        {LiveKitContent}
                    </div>

                    {/* Resize Handle */}
                    <div
                        onMouseDown={(e) => handleMouseDown(e, 'resize')}
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '24px',
                            height: '24px',
                            backgroundColor: '#374151',
                            cursor: 'se-resize',
                            borderTopLeftRadius: '8px'
                        }}
                    />
                </div>
            </div>,
            document.body
        );
    }

    // FALLBACK - No mount point available, render full screen
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9998,
            backgroundColor: '#0a0a0a'
        }}>
            {LiveKitContent}
        </div>
    );
}
