'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    LiveKitRoom,
    VideoConference,
    GridLayout,
    ParticipantTile,
    useTracks,
    RoomAudioRenderer,
    ControlBar,
    useParticipants
} from '@livekit/components-react';
import { Track, RoomEvent, Participant } from 'livekit-client';
import { useClassroom } from '@/contexts/ClassroomContext';
import '@livekit/components-styles';
import { Maximize2, X, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import ActiveSpeaker from './ActiveSpeaker';

// Inner component to access LiveKit context
function RoomContent() {
    const { setParticipants, sessionId, isMini, toggleMini, leaveClass } = useClassroom();
    const participants = useParticipants();
    const tracks = useTracks([
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
    ]);

    // Sync participants to global context
    useEffect(() => {
        setParticipants(participants);
    }, [participants, setParticipants]);

    // Determine mount point, using window for immediate access in client component
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
    const pathname = window.location.pathname; // using window since we are in client component and need immediate access or can use usePathname from navigation

    useEffect(() => {
        // Check for the mount point on the page
        const checkMount = () => {
            const el = document.getElementById('classroom-video-mount');
            if (el && el !== mountNode) {
                setMountNode(el);
            } else if (!el && mountNode) {
                setMountNode(null);
            }
        };

        // Check immediately
        checkMount();

        // Check periodically for a short time to catch race conditions (re-mounts)
        const interval = setInterval(checkMount, 100);

        // Also observe DOM
        const observer = new MutationObserver(checkMount);
        observer.observe(document.body, { childList: true, subtree: true });

        // Stop checking aggressively after 5 seconds to save resources
        const timeout = setTimeout(() => clearInterval(interval), 5000);

        return () => {
            observer.disconnect();
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [pathname, isMini]); // Re-run if path or mode changes

    // 1. FULL SCREEN MODE (Inside Classroom Page)
    if (mountNode && !isMini) {
        return createPortal(
            <div className="w-full h-full relative">
                <ActiveSpeaker />
                <GridLayout tracks={tracks} style={{ height: 'calc(100% - 80px)' }}>
                    <ParticipantTile />
                </GridLayout>
                <RoomAudioRenderer />
                <ControlBar controls={{ chat: false, leave: false }} />
            </div>,
            mountNode
        );
    }

    // 2. MINI PLAYER MODE (Floating)
    // Portal this to document.body so it's not affected by parent container styles/overflow
    return createPortal(
        <div className="fixed bottom-4 right-4 w-80 sm:text-base w-[200px] sm:w-[320px] shadow-2xl z-[9999] pointer-events-none">
            <div className="bg-black rounded-xl overflow-hidden border border-white/10 pointer-events-auto aspect-video relative group animate-in slide-in-from-bottom-10 fade-in duration-300">
                {/* Mini Header / Controls */}
                <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/80 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-start">
                    <button
                        onClick={() => toggleMini(false)}
                        className="p-1.5 bg-black/40 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={leaveClass}
                        className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-lg backdrop-blur-sm transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <GridLayout tracks={tracks}>
                    <ParticipantTile />
                </GridLayout>
                <RoomAudioRenderer />
            </div>
        </div>,
        document.body
    );
}

export default function GlobalClassroom() {
    const { token, isActive } = useClassroom();

    if (!isActive || !token) return null;

    return (
        <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
            data-lk-theme="default"
            // The container is effectively hidden, acting only as a Context Provider.
            // All visual content is Portaled out.
            style={{
                height: 0,
                width: 0,
                position: 'fixed',
                top: 0,
                left: 0,
                overflow: 'hidden',
                zIndex: -9999,
                opacity: 0,
                pointerEvents: 'none'
            }}
        >
            <RoomContent />
        </LiveKitRoom>
    );
}
