'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Room, Track } from 'livekit-client';
import { useClassroom } from '@/contexts/ClassroomContext';
import { Maximize2, X } from 'lucide-react';
import CustomControlBar from './CustomControlBar';
import ReactionOverlay, { ReactionOverlayHandle } from './ReactionOverlay';


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

// Inner component to handle layout logic that needs LayoutContext
function InnerVideoLayout({
    onTogglePiP,
    onReaction,
    isPiPActive,
    onLeave,
    reactionRef,
    tracks,
    onToggleChat,
    isChatOpen
}: {
    onTogglePiP: () => void;
    onReaction: (emoji: string) => void;
    isPiPActive: boolean;
    onLeave: () => void;
    reactionRef: React.RefObject<ReactionOverlayHandle | null>;
    tracks: any[];
    onToggleChat: () => void;
    isChatOpen: boolean;
}) {
    // We don't rely on layoutContext for basic chat toggle anymore
    // but we can still access it if needed for other things
    const layoutContext = useLayoutContext() as any;

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] relative">
            {/* CSS to hide default LiveKit control bar so we can use our custom one */}
            <style jsx global>{`
                .lk-video-conference .lk-control-bar { display: none !important; }
                @media (max-width: 640px) {
                    .mobile-hide-force { display: none !important; }
                }
            `}</style>

            <div className="flex-1 relative overflow-hidden">
                <ReactionOverlay ref={reactionRef} />

                <div className="absolute inset-0">
                    {/* Use GridLayout for all tracks for stability */}
                    <GridLayout tracks={tracks}>
                        <ParticipantTile />
                    </GridLayout>
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
            />

            {/* Chat Sidebar - Always mounted to persist messages, hidden via CSS */}
            <div
                className={`absolute left-4 right-4 sm:left-auto sm:right-4 top-20 bottom-24 sm:w-80 z-[100] rounded-xl overflow-hidden border border-gray-800 shadow-2xl bg-gray-900/95 backdrop-blur flex flex-col transition-all duration-300 ease-in-out ${isChatOpen
                    ? 'opacity-100 translate-x-0 pointer-events-auto'
                    : 'opacity-0 translate-x-[120%] pointer-events-none'
                    }`}
            >
                {/* Custom Header for Chat */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
                    <h3 className="text-sm font-bold text-white">Chat</h3>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleChat();
                        }}
                        className="hidden md:flex w-10 h-10 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 active:bg-gray-700 transition-colors -mr-2"
                        aria-label="Close Chat"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    {/* Fallback CSS for aggressive hiding */}

                </div>

                {/* Chat Component */}
                <div className="flex-1 min-h-0">
                    <Chat style={{ height: '100%' }} />
                </div>
            </div>
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
    isChatOpen
}: {
    onTogglePiP: () => void;
    onReaction: (emoji: string) => void;
    isPiPActive: boolean;
    onLeave: () => void;
    reactionRef: React.RefObject<ReactionOverlayHandle | null>;
    onToggleChat: () => void;
    isChatOpen: boolean;
}) {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: false },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    ).filter(track => track.participant !== undefined);

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
    } = useClassroom();

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

    // Fetch token when session becomes active
    useEffect(() => {
        if (!isActive || !sessionId || !userName || !userRole) {
            setToken(null);
            return;
        }

        const fetchToken = async () => {
            setIsConnecting(true);
            setTokenError(null);

            try {
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
                setToken(data.token);
            } catch (error: any) {
                console.error('Error fetching LiveKit token:', error);
                setTokenError(error.message || 'Failed to connect to video service');
            } finally {
                setIsConnecting(false);
            }
        };

        fetchToken();
    }, [isActive, sessionId, userName, userRole, userId]);

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
            alert('Picture-in-Picture API is not supported in this browser.');
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
            connect={true}
            audio={userRole === 'lecturer'}
            video={userRole === 'lecturer'}
            onDisconnected={handleDisconnected}
            data-lk-theme="default"
            options={{
                adaptiveStream: true,
                dynacast: true,
                publishDefaults: {
                    simulcast: true,
                    videoCodec: 'vp8',
                },
            }}
            style={{ height: '100%', width: '100%' }}
        >
            <VideoLayout
                onTogglePiP={handleTogglePiP}
                onReaction={handleReaction}
                isPiPActive={isPiPActive}
                onLeave={handleLeave}
                reactionRef={reactionRef}
                onToggleChat={toggleChat}
                isChatOpen={!!isChatOpen}
            />
            <RoomConnector onRoomReady={handleRoomReady} />
            <RoomAudioRenderer />
        </LiveKitRoom>
    );

    // If PiP is active, render into PiP Window
    if (isPiPActive && pipWindowRef.current) {
        return createPortal(
            LiveKitContent,
            pipWindowRef.current.document.body
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
