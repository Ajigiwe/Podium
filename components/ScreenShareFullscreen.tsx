'use client';

import { useEffect, useRef, useState } from 'react';
import { useRemoteParticipants, VideoTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Maximize2, Minimize2, X, Monitor } from 'lucide-react';

export const ScreenShareFullscreen = () => {
    const remoteParticipants = useRemoteParticipants();
    const [screenShareTrack, setScreenShareTrack] = useState<any>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Detect mobile
    useEffect(() => {
        const checkMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        setIsMobile(checkMobile);
    }, []);

    const exitFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }

            setIsFullscreen(false);

            // Unlock orientation
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        } catch (error) {
            console.error('Exit fullscreen failed:', error);
        }
    };

    const enterFullscreen = async () => {
        if (!containerRef.current) return;

        try {
            // Request fullscreen
            if (containerRef.current.requestFullscreen) {
                await containerRef.current.requestFullscreen();
            } else if ((containerRef.current as any).webkitRequestFullscreen) {
                await (containerRef.current as any).webkitRequestFullscreen();
            } else if ((containerRef.current as any).mozRequestFullScreen) {
                await (containerRef.current as any).mozRequestFullScreen();
            }

            setIsFullscreen(true);

            // Lock to landscape on mobile
            if (isMobile && screen.orientation && (screen.orientation as any).lock) {
                try {
                    await (screen.orientation as any).lock('landscape');
                } catch (e) {
                    console.log('Could not lock orientation:', e);
                }
            }
        } catch (error) {
            console.error('Fullscreen failed:', error);
        }
    };

    // Find screen share track
    useEffect(() => {
        let foundTrack: any = null;

        for (const participant of remoteParticipants) {
            const screenPublication = Array.from(participant.videoTrackPublications.values())
                .find(pub => pub.source === Track.Source.ScreenShare);

            if (screenPublication && screenPublication.isSubscribed && screenPublication.track) {
                foundTrack = {
                    participant,
                    publication: screenPublication,
                };
                break;
            }
        }

        setScreenShareTrack(foundTrack);

        // Exit fullscreen when screen share ends
        if (!foundTrack && isFullscreen) {
            exitFullscreen();
        }
    }, [remoteParticipants, isMobile]);



    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        };
    }, []);

    if (!screenShareTrack || !isMobile) return null;

    return (
        <>
            {/* Screen Share Container */}
            <div
                ref={containerRef}
                className={`${isFullscreen
                    ? 'fixed inset-0 z-[200] bg-black'
                    : 'fixed inset-4 z-[190] bg-black rounded-xl overflow-hidden border border-white/10'
                    }`}
            >
                {/* Screen Share Video */}
                <VideoTrack
                    trackRef={{
                        participant: screenShareTrack.participant,
                        source: Track.Source.ScreenShare,
                        publication: screenShareTrack.publication,
                    }}
                    className="w-full h-full object-contain"
                />

                {/* Controls Overlay */}
                <div className="absolute top-4 right-4 left-4 flex items-center justify-between pointer-events-none">
                    {/* Participant Name */}
                    <div className="bg-black/90 text-white px-4 py-2 rounded-lg text-sm font-medium pointer-events-auto flex items-center gap-2 border border-white/10">
                        <Monitor className="w-4 h-4 text-blue-400" />
                        <span>{screenShareTrack.participant.name || 'Presenter'} is sharing</span>
                    </div>

                    <div className="flex items-center gap-2 pointer-events-auto">
                        {/* Fullscreen Toggle (Available on all devices) */}
                        <button
                            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                            className="bg-black/90 hover:bg-black text-white p-2.5 rounded-lg transition-colors border border-white/10"
                            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen (Landscape)'}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="w-5 h-5" />
                            ) : (
                                <Maximize2 className="w-5 h-5" />
                            )}
                        </button>

                        {/* Close */}
                        <button
                            onClick={exitFullscreen}
                            className="bg-red-600/80 hover:bg-red-600 text-white p-2.5 rounded-lg transition-colors border border-red-500/20"
                            title="Close viewer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

function isLandscape(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight;
}
