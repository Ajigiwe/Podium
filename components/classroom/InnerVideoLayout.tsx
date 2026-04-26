'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    useRoomContext, 
    TrackReferenceOrPlaceholder, 
    useLayoutContext,
    RoomAudioRenderer
} from '@livekit/components-react';
import { Room, Track, Participant, RoomEvent } from 'livekit-client';
import { Video, X, Minimize2 } from 'lucide-react';
import { useClassroom } from '@/contexts/ClassroomContext';
import { TileWrapper } from './TileWrapper';
import { FocusWrapper } from './FocusWrapper';
import CustomControlBar from '../CustomControlBar';
import ClassroomChat from '../ClassroomChat';
import { RaisedHandsBanner } from '../RaisedHandsBanner';
import ReactionOverlay, { ReactionOverlayHandle } from '../ReactionOverlay';
import { useScreenShareOrientation } from '@/hooks/useScreenShareOrientation';

export function InnerVideoLayout({
    onReaction,
    onLeave,
    reactionRef,
    tracks,
    onToggleChat,
    isChatOpen,
    unreadChatCount,
    layout: layoutType,
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
    showAlert,
    customAlert,
    isActive,
    isDocked,
}: any) {
    const { sessionId, title, userId, isModerator } = useClassroom();
    const room = useRoomContext();
    const [activeSpeakers, setActiveSpeakers] = useState<Participant[]>([]);
    const [isMobileLandscape, setIsMobileLandscape] = useState(false);
    const { isScreenSharing, isMobile } = useScreenShareOrientation();
    const [focusTrack, setFocusTrack] = useState<TrackReferenceOrPlaceholder | null>(null);
    const [userDisabledAutoFocus, setUserDisabledAutoFocus] = useState(false);

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

    const sortedTracks = useMemo(() => {
        return [...tracks].sort((a, b) => {
            if (spotlightParticipant === a.participant.sid) return -1;
            if (spotlightParticipant === b.participant.sid) return 1;
            if (a.source === Track.Source.ScreenShare && b.source !== Track.Source.ScreenShare) return -1;
            if (b.source === Track.Source.ScreenShare && a.source !== Track.Source.ScreenShare) return 1;
            const aIsSpeaking = activeSpeakers.some((p) => p.sid === a.participant.sid) || a.participant.isSpeaking;
            const bIsSpeaking = activeSpeakers.some((p) => p.sid === b.participant.sid) || b.participant.isSpeaking;
            if (aIsSpeaking && !bIsSpeaking) return -1;
            if (bIsSpeaking && !aIsSpeaking) return 1;
            return 0;
        });
    }, [tracks, spotlightParticipant, activeSpeakers]);

    const PAGE_SIZE = config.maxVisible;
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(sortedTracks.length / PAGE_SIZE);

    const [pipPosition, setPipPosition] = useState({ x: 16, y: 16 });
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

    useEffect(() => {
        const lecturerTracks = tracks.filter((t: any) => {
            try {
                const metadata = JSON.parse(t.participant.metadata || '{}');
                return metadata.role === 'lecturer';
            } catch (e) { return false; }
        });
        const hostScreenShare = lecturerTracks.find((t: any) => t.source === Track.Source.ScreenShare);
        const hostCamera = lecturerTracks.find((t: any) => t.source === Track.Source.Camera || t.source === Track.Source.Unknown);
        const autoFocusTarget = hostScreenShare || hostCamera;
        if (autoFocusTarget && !userDisabledAutoFocus) {
            if (!focusTrack || focusTrack.participant.sid !== autoFocusTarget.participant.sid || focusTrack.source !== autoFocusTarget.source) {
                setFocusTrack(autoFocusTarget);
            }
        } else if (focusTrack && !userDisabledAutoFocus) {
            const stillExists = tracks.some((t: any) => t.participant.sid === focusTrack.participant.sid && t.source === focusTrack.source);
            if (!stillExists) setFocusTrack(null);
        }
    }, [tracks, userDisabledAutoFocus]);

    const paginatedTracks = sortedTracks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(p => p + 1); };
    const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(p => p - 1); };
    const carouselTracks = sortedTracks.filter(t => !focusTrack || (t.participant.sid !== focusTrack.participant.sid || t.source !== focusTrack.source));

    const handleTileClick = (track: TrackReferenceOrPlaceholder) => {
        if (!track || !track.participant) return;
        if (focusTrack && focusTrack.participant?.sid === track.participant.sid && focusTrack.source === track.source) {
            setFocusTrack(null);
            setUserDisabledAutoFocus(true);
        } else {
            setFocusTrack(track);
            setUserDisabledAutoFocus(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] relative">
            <style jsx global>{`
                .lk-video-conference .lk-control-bar { display: none !important; }
                @media (max-width: 1024px) {
                    .mobile-hide-force { display: none !important; }
                    .immersive-video-container video {
                        height: 100% !important;
                        width: 100% !important;
                    }
                }
            `}</style>

            {(!isDocked && !(isMobile && focusTrack)) && (
                <div className="h-12 bg-black/80 border-b border-white/5 px-4 flex items-center justify-between z-[100] backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600/20 p-1.5 rounded-md border border-blue-500/20">
                            <Video className="w-4 h-4 text-blue-500" />
                        </div>
                        <span className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                            {title || 'Current Class'}
                        </span>
                    </div>
                </div>
            )}

            <div className="flex-1 relative overflow-hidden flex flex-col sm:flex-row">
                <div className="flex-1 relative">
                    <RaisedHandsBanner
                        isLecturer={isModerator}
                        raisedHands={raisedHands}
                        onClearAll={clearAllHands}
                        onLowerHand={lowerHand}
                    />
                    {focusTrack ? (
                        <div className="absolute inset-0 flex bg-black z-50">
                            <div className={`flex-1 relative h-full min-h-0 min-w-0 ${focusTrack.source === Track.Source.ScreenShare ? '[&_video]:!object-contain [&_video]:!w-full [&_video]:!h-full' : 'immersive-video-container [&_video]:!h-full'}`}>
                                <FocusWrapper trackRef={focusTrack} onParticipantClick={() => setFocusTrack(null)} />
                                <button
                                    onClick={() => { setFocusTrack(null); setUserDisabledAutoFocus(true); }}
                                    className="absolute top-4 left-4 z-[60] bg-black/80 text-white px-3 py-2 rounded-md hover:bg-black ring-1 ring-white/20 flex items-center gap-2 backdrop-blur-xl"
                                >
                                    <Minimize2 className="w-5 h-5" />
                                    <span className="hidden sm:inline text-sm font-semibold">Grid View</span>
                                </button>
                            </div>

                            {focusTrack.source !== Track.Source.ScreenShare && (
                                <div
                                    className={`absolute z-[70] flex flex-col gap-2 pointer-events-auto cursor-grab active:cursor-grabbing ${isDraggingPip ? 'transition-none' : 'transition-all duration-300'}`}
                                    style={{ right: `${pipPosition.x}px`, bottom: `${pipPosition.y}px` }}
                                    onMouseDown={startPipDrag}
                                    onTouchStart={startPipDrag}
                                >
                                    {carouselTracks.filter(t => {
                                        if (userRole === 'lecturer') return !t.participant.isLocal;
                                        return t.participant.isLocal || activeSpeakers.some(s => s.sid === t.participant.sid);
                                    }).slice(0, userRole === 'lecturer' ? 4 : 3).map((t) => (
                                        <div key={`${t.participant.sid}-${t.source}`} className="w-28 sm:w-48 aspect-[3/4] sm:aspect-video rounded-md overflow-hidden ring-2 ring-white/20 bg-gray-900 pointer-events-none border border-gray-800">
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
                            {totalPages > 1 && (
                                <div className="absolute z-50 bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 px-4 py-2 rounded-full border border-white/10 backdrop-blur-xl">
                                    <button onClick={handlePrevPage} disabled={currentPage === 1} className="text-white disabled:opacity-30 hover:text-blue-400 transition-colors font-bold">&larr; Prev</button>
                                    <span className="text-white text-sm font-medium">Page {currentPage} of {totalPages}</span>
                                    <button onClick={handleNextPage} disabled={currentPage === totalPages} className="text-white disabled:opacity-30 hover:text-blue-400 transition-colors font-bold">Next &rarr;</button>
                                </div>
                            )}

                            {paginatedTracks.some(t => t.source === Track.Source.ScreenShare) ? (
                                <div className="absolute inset-0 overflow-hidden bg-black">
                                    {paginatedTracks.filter(t => t.source === Track.Source.ScreenShare).map(trackRef => (
                                        <div key={trackRef.participant.sid + '_lsscreen'}>
                                            <div className="block sm:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, background: 'black', overflow: 'hidden' }}>
                                                <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100vh', height: '100vw', transform: 'translate(-50%, -50%) rotate(90deg)', transformOrigin: 'center center', overflow: 'hidden' }}>
                                                    <TileWrapper track={trackRef} participant={trackRef.participant} onTileClick={handleTileClick} className="w-full h-full !rounded-none" />
                                                </div>
                                            </div>
                                            <div className="hidden sm:block absolute inset-0">
                                                <TileWrapper track={trackRef} participant={trackRef.participant} onTileClick={handleTileClick} className="w-full h-full !rounded-none" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center justify-center content-center gap-2 sm:gap-4 w-full h-full p-2 sm:p-4 overflow-y-auto pb-24 sm:pb-4">
                                    {paginatedTracks.map((trackRef, index, arr) => {
                                        const count = arr.length;
                                        let containerClass = 'w-[calc(50%-0.5rem)] sm:w-[calc(50%-1rem)] md:w-[calc(33.33%-1rem)] lg:w-[calc(25%-1rem)] aspect-[3/4] sm:aspect-video shrink-0';
                                        if (count === 1) containerClass = 'w-full max-w-lg sm:max-w-2xl aspect-[3/4] sm:aspect-video shrink-0';
                                        else if (count === 2) containerClass = 'w-[calc(50%-0.5rem)] sm:w-[calc(50%-1rem)] max-w-4xl aspect-[3/4] sm:aspect-video shrink-0';
                                        else if (count <= 4) containerClass = 'w-[calc(50%-0.5rem)] sm:w-[calc(50%-1rem)] lg:w-[calc(50%-1rem)] max-w-3xl aspect-[3/4] sm:aspect-video shrink-0';
                                        return (
                                            <div key={trackRef.participant.sid + '_' + trackRef.source} className={`${containerClass} transition-all duration-300 flex justify-center`}>
                                                <TileWrapper
                                                    track={trackRef}
                                                    participant={trackRef.participant}
                                                    onTileClick={handleTileClick}
                                                    className="w-full h-full bg-gray-900 rounded-lg overflow-hidden border border-gray-800"
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

            <CustomControlBar
                roomId={sessionId!}
                isLecturer={isModerator}
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

            <div className={`absolute left-4 right-4 sm:left-auto sm:right-4 top-20 bottom-24 sm:w-80 z-[100] rounded-xl overflow-hidden border border-white/10 bg-gray-950/90 backdrop-blur-2xl shadow-2xl flex flex-col transition-all duration-500 ease-in-out ${isChatOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[120%] pointer-events-none'}`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
                    <h3 className="text-sm font-bold text-white">Class Chat</h3>
                    <button type="button" onClick={onToggleChat} className="flex w-8 h-8 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 min-h-0">
                    {sessionId ? <ClassroomChat sessionId={sessionId} /> : <div className="flex items-center justify-center h-full text-gray-500 text-sm italic">Connecting...</div>}
                </div>
            </div>

            {typeof window !== 'undefined' && createPortal(
                <ReactionOverlay ref={reactionRef} />,
                document.body
            )}
        </div>
    );
}
