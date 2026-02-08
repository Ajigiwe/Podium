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
import { Room, Track, Participant, RoomEvent, ParticipantEvent } from 'livekit-client';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useAlert } from '@/contexts/AlertContext';
import { Maximize2, X, Minimize2, Pin, PinOff, Video, User, Mic } from 'lucide-react';
import CustomControlBar from './CustomControlBar';
import ReactionOverlay, { ReactionOverlayHandle } from './ReactionOverlay';
import ClassroomChat from './ClassroomChat';
import { useLayoutConfig } from '@/hooks/useLayoutConfig';
import { useRaisedHands } from '@/hooks/useRaisedHands';
import { LayoutSelector } from './LayoutSelector';
import { RaisedHandsBanner } from './RaisedHandsBanner';
import { RecordingControls } from './RecordingControls';


// Inner component that can access the room context
function RoomConnector({ onRoomReady }: { onRoomReady: (room: Room) => void }) {
    const room = useRoomContext();

    useEffect(() => {
        if (room) {
            onRoomReady(room);
        }
    }, [room, onRoomReady]);

    return null;
}

// Wrapper for Tile to handle clicks while receiving props from GridLayout
function TileWrapper({ track, participant, onTileClick, className, ...props }: any) {
    // Check if camera is off/muted to show placeholder
    // We check both the track mute status and the participant-level flag for robustness
    const isCameraOff = track.source === Track.Source.Camera &&
        (track.publication?.isMuted || !participant.isCameraEnabled);

    const hookIsSpeaking = useIsSpeaking(participant);
    const [manualIsSpeaking, setManualIsSpeaking] = useState(participant.isSpeaking);

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
            className={`h-full relative group cursor-pointer min-h-[160px] sm:min-h-0 rounded-lg overflow-hidden transition-all duration-300 ${isSpeaking ? 'ring-2 ring-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : ''} ${className || ''}`}
            onClick={() => onTileClick(track)}
        >
            <ParticipantTile trackRef={track} {...props} />

            {/* Speaking Indicator Badge */}
            {isSpeaking && (
                <div className="absolute top-2 right-2 z-20 bg-green-500 text-black p-1 rounded-full shadow-lg animate-pulse">
                    <Mic className="w-3 h-3" />
                </div>
            )}

            {/* Explicit Placeholder for Camera Off */}
            {isCameraOff && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 border border-gray-700 rounded-lg">
                    <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-2">
                        <User className="w-10 h-10 text-gray-400" />
                    </div>
                    <span className="text-gray-300 font-medium text-sm">
                        {participant.name || participant.identity || 'Participant'}
                    </span>
                </div>
            )}

            {/* Click Safe Overlay */}
            <div className="absolute inset-0 z-10 opacity-0 hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto flex items-center justify-center bg-black/20">
                <div className="bg-black/60 p-1.5 rounded-full text-white backdrop-blur-sm">
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

    return (
        <div className={`relative w-full h-full group transition-all duration-500 ${isSpeaking ? 'ring-4 ring-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : ''}`}>
            <FocusLayout trackRef={trackRef} onParticipantClick={onParticipantClick} {...props} />

            {/* Explicit Placeholder for Camera Off in Focus Mode */}
            {isCameraOff && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 border-2 border-dashed border-gray-800 rounded-xl m-4">
                    <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mb-6 shadow-2xl ring-4 ring-white/5">
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
    onTogglePiP,
    onReaction,
    isPiPActive,
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
    unreadChatCount

}: {
    onTogglePiP: () => void;
    onReaction: (emoji: string) => void;
    isPiPActive: boolean;
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
}) {
    // We don't rely on layoutContext for basic chat toggle anymore
    // but we can still access it if needed for other things
    const layoutContext = useLayoutContext() as any;
    const { sessionId, title, userId } = useClassroom();
    console.log('DEBUG: InnerVideoLayout', { sessionId, userId, userRole });
    const [focusTrack, setFocusTrack] = useState<TrackReferenceOrPlaceholder | null>(null);
    const room = useRoomContext();
    const [activeSpeakers, setActiveSpeakers] = useState<Participant[]>([]);

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

    // Sidebar Resize State
    const [sidebarWidth, setSidebarWidth] = useState(320); // Default desktop width
    const [sidebarHeight, setSidebarHeight] = useState(140); // Default mobile height
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const sidebarResizeRef = useRef<{ startX: number, startY: number, startW: number, startH: number } | null>(null);

    const startResizing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizingSidebar(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        sidebarResizeRef.current = {
            startX: clientX,
            startY: clientY,
            startW: sidebarWidth,
            startH: sidebarHeight
        };
    }, [sidebarWidth, sidebarHeight]);

    useEffect(() => {
        const handleResizeMove = (e: MouseEvent | TouchEvent) => {
            if (!isResizingSidebar || !sidebarResizeRef.current) return;

            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

            if (window.innerWidth >= 640) {
                // Desktop: Resize Width (Dragging Left increases width)
                // Handle is on the LEFT of the sidebar (which is on the right)
                // So deltaX < 0 means increasing width
                const deltaX = sidebarResizeRef.current.startX - clientX;
                setSidebarWidth(Math.max(200, Math.min(600, sidebarResizeRef.current.startW + deltaX)));
            } else {
                // Mobile: Resize Height (Dragging Up increases height)
                // Sidebar is at bottom (order-3), Handle is above it (order-2)
                // Dragging UP (negative Y) increases height
                const deltaY = sidebarResizeRef.current.startY - clientY;
                setSidebarHeight(Math.max(100, Math.min(400, sidebarResizeRef.current.startH + deltaY)));
            }
        };

        const handleResizeEnd = () => {
            setIsResizingSidebar(false);
            sidebarResizeRef.current = null;
        };

        if (isResizingSidebar) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeEnd);
            window.addEventListener('touchmove', handleResizeMove);
            window.addEventListener('touchend', handleResizeEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeEnd);
            window.removeEventListener('touchmove', handleResizeMove);
            window.removeEventListener('touchend', handleResizeEnd);
        };
    }, [isResizingSidebar]);

    // Reset to page 1 if tracks change significantly (optional, but good for UX)
    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [tracks.length, totalPages, currentPage]);

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
        } else {
            setFocusTrack(track); // Focus
        }
    };

    // If in PiP mode, provide a simplified, full-screen video layout
    if (isPiPActive) {
        return (
            <div className="h-full w-full bg-black flex flex-col items-center justify-center overflow-hidden relative">
                <ReactionOverlay ref={reactionRef} />
                <div className="flex-1 w-full h-full relative">
                    {focusTrack ? (
                        <div className="absolute inset-0">
                            <FocusLayout trackRef={focusTrack} />
                        </div>
                    ) : (
                        <div className="absolute inset-0">
                            <GridLayout tracks={tracks.slice(0, 1)}>
                                <ParticipantTile />
                            </GridLayout>
                            {tracks.length > 1 && (
                                <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur px-2 py-1 rounded text-xs text-white z-10">
                                    + {tracks.length - 1} more participants
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {/* Add a tiny exit button for PiP window UX */}
                <button
                    onClick={onTogglePiP}
                    className="absolute top-2 right-2 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/70 hover:text-white transition-all z-50 ring-1 ring-white/10"
                    title="Close PiP"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] relative">
            {/* CSS to hide default LiveKit control bar so we can use our custom one */}
            <style jsx global>{`
                .lk-video-conference .lk-control-bar { display: none !important; }
                @media (max-width: 640px) {
                    .mobile-hide-force { display: none !important; }
                }
            `}</style>

            <div className="flex-1 relative overflow-hidden flex flex-col sm:flex-row">


                <div className="flex-1 relative">
                    <RaisedHandsBanner
                        isLecturer={userRole === 'lecturer'}
                        raisedHands={raisedHands}
                        onClearAll={clearAllHands}
                        onLowerHand={lowerHand}
                    />
                    {focusTrack ? (
                        <div className="absolute inset-0 flex flex-col sm:flex-row bg-black z-50">
                            {/* Resize Handle - Desktop (Vertical) / Mobile (Horizontal) */}
                            <div
                                onMouseDown={startResizing}
                                onTouchStart={startResizing}
                                className={`
                                    z-[150] bg-gray-800 hover:bg-blue-500 transition-colors active:bg-blue-600
                                    flex items-center justify-center
                                    ${isResizingSidebar ? 'bg-blue-600' : ''}
                                    order-2 sm:order-2
                                    h-2 w-full cursor-row-resize sm:h-full sm:w-2 sm:cursor-col-resize
                                `}
                            >
                                <div className="bg-gray-600 rounded-full w-12 h-1 sm:w-1 sm:h-8" />
                            </div>

                            {/* Mobile: Horizontal scroll on top (actually bottom order-3), Desktop: Vertical on right */}
                            <div
                                className="bg-gray-900/50 border-t sm:border-t-0 sm:border-l border-white/5 order-3 sm:order-3 overflow-x-auto sm:overflow-y-auto p-1 sm:p-2 transition-[height,width] duration-75 ease-out"
                                style={{
                                    width: typeof window !== 'undefined' && window.innerWidth >= 640 ? `${sidebarWidth}px` : '100%',
                                    height: typeof window !== 'undefined' && window.innerWidth < 640 ? `${sidebarHeight}px` : '100%',
                                }}
                            >
                                <div className="flex sm:flex-col gap-1 sm:gap-2 h-full">
                                    {carouselTracks.slice(0, 4).map((t) => (
                                        <TileWrapper
                                            key={`${t.participant.sid}-${t.source}`}
                                            track={t}
                                            participant={t.participant}
                                            onTileClick={handleTileClick}
                                            className="w-40 sm:w-full aspect-video flex-shrink-0"
                                        />
                                    ))}

                                    {/* "More" Indicator Tile */}
                                    {carouselTracks.length > 4 && (
                                        <div className="w-40 sm:w-full aspect-video flex-shrink-0 bg-gray-800/50 rounded-lg flex flex-col items-center justify-center border border-dashed border-white/10 group hover:border-blue-500/50 transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center mb-1 group-hover:bg-blue-600/20 transition-colors">
                                                <User className="w-5 h-5 text-gray-400 group-hover:text-blue-400" />
                                            </div>
                                            <span className="text-white font-bold text-lg">+{carouselTracks.length - 4}</span>
                                            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">Others</span>
                                        </div>
                                    )}

                                    {carouselTracks.length === 0 && (
                                        <div className="flex-1 flex items-center justify-center text-gray-500 text-xs italic p-4 text-center">
                                            No other participants
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 relative order-1 sm:order-1 h-full min-h-0">
                                <FocusWrapper trackRef={focusTrack} onParticipantClick={() => setFocusTrack(null)} />
                                {/* Unfocus Button Overlay */}
                                <button
                                    onClick={() => setFocusTrack(null)}
                                    className="absolute top-4 left-4 z-[60] bg-black/60 text-white p-2.5 rounded-xl hover:bg-black/80 ring-1 ring-white/20 shadow-2xl backdrop-blur-md"
                                    title="Exit Focus Mode"
                                >
                                    <Minimize2 className="w-5 h-5" />
                                </button>

                                <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
                                    <p className="text-white text-xs font-medium">Focus Mode</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 grid-layout-wrapper">
                            {/* Pagination Controls Overlay */}
                            {totalPages > 1 && (
                                <div className="absolute z-50 bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur px-4 py-2 rounded-full border border-white/10">
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

                            <div className={`grid gap-1 w-full h-full p-1 content-start overflow-y-auto pb-24 sm:pb-0`}
                                style={{
                                    gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))`,
                                    gridAutoRows: typeof window !== 'undefined' && window.innerWidth < 768 ? 'minmax(160px, auto)' : '1fr',
                                    gridTemplateRows: typeof window !== 'undefined' && window.innerWidth < 768 ? 'none' : `repeat(${config.rows}, minmax(0, 1fr))`,
                                }}
                            >
                                {paginatedTracks.map((trackRef) => (
                                    <TileWrapper
                                        key={trackRef.participant.sid + '_' + trackRef.source}
                                        track={trackRef}
                                        participant={trackRef.participant}
                                        onTileClick={handleTileClick}
                                        className="w-full h-full bg-gray-900 rounded-lg overflow-hidden border border-gray-800/50 shadow-md"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>



            {/* Custom Controls */}
            <CustomControlBar
                onTogglePiP={onTogglePiP}
                onReaction={onReaction}
                isPiPActive={isPiPActive}
                onLeave={onLeave}
                onToggleChat={onToggleChat}
                isChatOpen={isChatOpen}
                onToggleHand={onToggleHand}
                isHandRaised={isHandRaised}
                unreadChatCount={unreadChatCount}
            />

            {/* Chat Sidebar - Persistent */}
            <div
                className={`absolute left-4 right-4 sm:left-auto sm:right-4 top-20 bottom-24 sm:w-80 z-[100] rounded-xl overflow-hidden border border-gray-800 shadow-2xl bg-gray-900/95 backdrop-blur flex flex-col transition-all duration-300 ease-in-out ${isChatOpen
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

// Wrapper component that provides LayoutContext
function VideoLayout({
    onTogglePiP,
    onReaction,
    isPiPActive,
    onLeave,
    reactionRef,
    onToggleChat,
    isChatOpen,
    unreadChatCount,
    userRole,
    userId,
    userName
}: {
    onTogglePiP: () => void;
    onReaction: (emoji: string) => void;
    isPiPActive: boolean;
    onLeave: () => void;
    reactionRef: React.RefObject<ReactionOverlayHandle | null>;
    onToggleChat: () => void;
    isChatOpen: boolean;
    unreadChatCount: number;
    userRole: string;
    userId: string;
    userName: string;
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

    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    ).filter(track => track.participant !== undefined && track.participant.sid !== undefined);

    // Sync hand status if cleared by lecturer
    useEffect(() => {
        if (raisedHands.length === 0 && isHandRaised) {
            setIsHandRaised(false);
        }
    }, [raisedHands, isHandRaised]);

    console.log('DEBUG: GlobalClassroom tracks:', tracks.length, tracks);

    return (
        <LayoutContextProvider>
            <InnerVideoLayout
                onTogglePiP={onTogglePiP}
                onReaction={onReaction}
                isPiPActive={isPiPActive}
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
        isMini,
        isFloating,
        toggleMinimize,
        leaveClass,
        setLiveKitRoom,
        toggleChat,
        isChatOpen,
        unreadChatCount,
    } = useClassroom();
    const { showAlert, customAlert } = useAlert();

    const [mounted, setMounted] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [tokenError, setTokenError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const roomRef = useRef<Room | null>(null);

    // Draggable State for floating/mini mode (desktop only)
    const [position, setPosition] = useState({ x: 20, y: 400 });
    const [size, setSize] = useState({ width: 400, height: 300 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const router = useRouter();

    // Document PiP State
    const pipWindowRef = useRef<Window | null>(null);
    const [isPiPActive, setIsPiPActive] = useState(false);

    // Memoized LiveKit options for stability
    const roomOptions = useMemo(() => ({
        publishDefaults: {
            simulcast: true,
            videoSimulcastLayers: [
                { width: 640, height: 360, encoding: { maxBitrate: 500 * 1000, maxFramerate: 20 }, resolution: { width: 640, height: 360, frameRate: 20 } },
                { width: 320, height: 180, encoding: { maxBitrate: 150 * 1000, maxFramerate: 15 }, resolution: { width: 320, height: 180, frameRate: 15 } },
            ]
        },
        adaptiveStream: true,
        dynacast: true,
    }), []);

    const connectOptions = useMemo(() => ({
        autoSubscribe: true,
    }), []);

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
            if (pipWindowRef.current) {
                console.log('Unmounting GlobalClassroom, closing PiP');
                try {
                    pipWindowRef.current.close();
                } catch (e) {
                    console.error('Error closing PiP:', e);
                }
                pipWindowRef.current = null;
            }
            if (roomRef.current) {
                roomRef.current.disconnect();
            }
        };
    }, []); // Only run once on mount/unmount

    // Force close PiP when class becomes inactive (even if component stays mounted)
    useEffect(() => {
        if (!isActive && pipWindowRef.current) {
            console.log('Class became inactive, closing PiP');
            try {
                pipWindowRef.current.close();
            } catch (e) {
                console.error('Error closing PiP:', e);
            }
            pipWindowRef.current = null;
            setIsPiPActive(false);
            if (roomRef.current) {
                roomRef.current.disconnect();
            }
        }
    }, [isActive]);

    // Ref to track if we're currently fetching to prevent double-firing
    const isFetchingRef = useRef(false);

    // Fetch token when session becomes active
    useEffect(() => {
        if (!isActive || !sessionId || !userName || !userRole) {
            setToken(null);
            return;
        }

        // If we already have a token for this session/user, don't refetch
        // unless it's null. This prevents strict mode double-fetch.
        if (token) return;

        const fetchToken = async () => {
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;

            setIsConnecting(true);
            setTokenError(null);

            try {
                console.log('Fetching LiveKit token for:', sessionId, userName);
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
    }, [isActive, sessionId, userName, userRole, userId, token]);

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
        if (pipWindowRef.current) {
            pipWindowRef.current.close();
            pipWindowRef.current = null;
        }
        leaveClass();

        // Navigate to dashboard to ensure full exit
        if (userRole === 'lecturer') {
            router.push('/dashboard/lecturer');
        } else {
            router.push('/dashboard/student');
        }
    }, [leaveClass, userRole, router]);

    // Handle disconnection callback
    const handleDisconnected = useCallback(() => {
        console.log('LiveKit room disconnected');
        roomRef.current = null;
        setLiveKitRoom(null);
        if (pipWindowRef.current) {
            pipWindowRef.current.close();
            pipWindowRef.current = null;
            setIsPiPActive(false);
        }
    }, [setLiveKitRoom]);

    // Handle maximize - go to classroom page
    const handleMaximize = useCallback(() => {
        toggleMinimize(false);
        router.push(`/classroom/${sessionId}`);
    }, [toggleMinimize, router, sessionId]);

    // Toggle Document PiP
    const handleTogglePiP = useCallback(async () => {
        // If already active, close it
        if (pipWindowRef.current) {
            pipWindowRef.current.close();
            return;
        }

        // Check compatibility
        if (!('documentPictureInPicture' in window)) {
            showAlert('Picture-in-Picture API is not supported in this browser.', 'warning');
            return;
        }

        try {
            // Open PiP window
            const win = await (window as any).documentPictureInPicture.requestWindow({
                width: 800,
                height: 600,
            });

            // Store ref
            pipWindowRef.current = win;
            setIsPiPActive(true);

            // Copy styles
            Array.from(document.styleSheets).forEach((styleSheet) => {
                try {
                    if (styleSheet.href) {
                        const link = win.document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = styleSheet.href;
                        win.document.head.appendChild(link);
                    } else if (styleSheet.ownerNode instanceof HTMLStyleElement) {
                        const style = win.document.createElement('style');
                        style.textContent = styleSheet.ownerNode.textContent;
                        win.document.head.appendChild(style);
                    }
                } catch (e) {
                    console.warn('Failed to copy stylesheet:', e);
                }
            });

            // Add utility classes specific to Pip
            const style = win.document.createElement('style');
            style.textContent = `
                body { margin: 0; background-color: #0a0a0a; height: 100vh; overflow: hidden; }
                .lk-video-conference { height: 100vh !important; }
            `;
            win.document.head.appendChild(style);

            // Handle close
            win.addEventListener('pagehide', () => {
                pipWindowRef.current = null;
                setIsPiPActive(false);
            });

        } catch (error) {
            console.error('Failed to open PiP window:', error);
            pipWindowRef.current = null;
            setIsPiPActive(false);
        }
    }, []);

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
            onMediaDeviceFailure={(e) => {
                console.error('Media device failure:', e);

                // e could be an Error object or a string depending on LiveKit version/implementation
                const errorName = (e as any)?.name || '';
                const errorMessage = (e as any)?.message || String(e || '');

                const isPermissionError = errorName === 'NotAllowedError' ||
                    errorMessage.includes('PermissionDenied') ||
                    errorName === 'PermissionDeniedError';

                if (isPermissionError) {
                    customAlert({
                        title: 'Camera/Mic Access Blocked',
                        message: 'Podium needs access to your camera and microphone to let you participate. Please click the camera/lock icon in your browser address bar and select "Allow".',
                        type: 'warning',
                        confirmText: 'Try Again',
                        cancelText: 'Join without Media',
                        onConfirm: () => {
                            window.location.reload();
                        }
                    });
                } else {
                    showAlert('Could not access camera or microphone. Please check your device connections.', 'error');
                }
            }}
            onError={(e) => {
                console.error('LiveKit error:', e);
                // Don't show alert for interruptions/timeouts repeatedly
                if (e.message.includes('Negotiation')) {
                    console.warn('Negotiation error suppressed - transient network issue suspected');
                } else {
                    setTokenError(e.message);
                }
            }}
            // Custom connection options for stability
            options={roomOptions}
            connectOptions={connectOptions}
            className="w-full h-full"
        >
            <VideoLayout
                onTogglePiP={handleTogglePiP}
                onReaction={handleReaction}
                isPiPActive={isPiPActive}
                onLeave={handleLeave}
                reactionRef={reactionRef}
                onToggleChat={toggleChat}
                isChatOpen={!!isChatOpen}
                userRole={userRole || 'student'}
                userId={userId || ''}
                userName={userName || ''}
                unreadChatCount={unreadChatCount}
            />
            <RoomConnector onRoomReady={handleRoomReady} />
            <RoomAudioRenderer />
        </LiveKitRoom>
    );

    // If PiP is active, render into PiP Window AND show placeholder in main window
    if (isPiPActive && pipWindowRef.current) {
        return (
            <>
                {createPortal(
                    LiveKitContent,
                    pipWindowRef.current.document.body
                )}
                {/* Main window placeholder - rendered in the mount point if possible, otherwise fixed */}
                {mountNode && !isMini && !isFloating ? createPortal(
                    <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mb-6">
                            <Video className="w-10 h-10 text-blue-500 animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Picture-in-Picture Active</h2>
                        <p className="text-gray-400 max-w-sm mb-8">
                            The classroom video is currently playing in a separate floating window.
                        </p>
                        <button
                            onClick={handleTogglePiP}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:scale-105 active:scale-95"
                        >
                            Return to Main Window
                        </button>
                    </div>,
                    mountNode
                ) : (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9998,
                        backgroundColor: '#0a0a0a',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '24px'
                        }}>
                            <Video style={{ width: '40px', height: '40px', color: '#3b82f6' }} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>PiP Mode Active</h2>
                        <p style={{ color: '#9ca3af', marginBottom: '32px', maxWidth: '320px' }}>Video is playing in a separate window.</p>
                        <button
                            onClick={handleTogglePiP}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: '#2563eb',
                                color: 'white',
                                borderRadius: '12px',
                                border: 'none',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Back to Classroom
                        </button>
                    </div>
                )}
            </>
        );
    }

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
                zIndex: 9999,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
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
