'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { useClassroom } from '@/contexts/ClassroomContext';
import { Maximize2, X } from 'lucide-react';

// Sanitize room name for Jitsi - must be consistent for all users
function sanitizeRoomName(sessionId: string): string {
    // Create a unique but consistent room name based on sessionId
    const sanitized = sessionId.replace(/[^a-zA-Z0-9]/g, '');
    // Use a long unique prefix to avoid public room conflicts on meet.jit.si
    return `PodiumLMS${sanitized}`;
}

export default function GlobalClassroom() {
    const { 
        sessionId, 
        title, 
        userName, 
        userRole, 
        isActive, 
        isMini, 
        isFloating, 
        toggleMini, 
        toggleFloating, 
        leaveClass,
        setJitsiApi 
    } = useClassroom();
    
    const [mounted, setMounted] = useState(false);
    const jitsiApiRef = useRef<any>(null);

    // Draggable State for floating/mini mode
    const [position, setPosition] = useState({ x: 20, y: typeof window !== 'undefined' ? window.innerHeight - 300 : 400 });
    const [size, setSize] = useState({ width: 400, height: 300 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        setMounted(true);
    }, []);

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

    // Cleanup Jitsi API on unmount
    useEffect(() => {
        return () => {
            if (jitsiApiRef.current) {
                try {
                    jitsiApiRef.current.dispose();
                } catch (e) {
                    // Ignore
                }
                jitsiApiRef.current = null;
            }
        };
    }, []);

    if (!mounted || !isActive || !sessionId || !userName) return null;

    const roomName = `podium_${sanitizeRoomName(sessionId)}`;

    const jitsiConfig = {
        startWithAudioMuted: true,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        hideConferenceSubject: false,
        subject: title || 'Podium Class',
        // CRITICAL: Disable members-only (lobby) mode
        membersOnly: false,
        // Disable lobby completely
        enableLobby: false,
        lobby: {
            autoKnock: true,
            enableChat: false,
        },
        // Security settings
        enableLobbyChat: false,
        hideLobbyButton: true,
        requireDisplayName: false,
        // Moderator settings
        enableClosePage: false,
        disableRemoteMute: false,
        remoteVideoMenu: {
            disableKick: false,
            disableGrantModerator: false,
        },
        // Disable waiting for moderator
        enableInsecureRoomNameWarning: false,
        startAudioOnly: false,
        disableModeratorIndicator: false,
    };

    const interfaceConfig = {
        TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'desktop',
            'fullscreen',
            'hangup',
            'chat',
            'raisehand',
            'tileview',
            'settings',
            'videoquality',
            'participants-pane',
        ],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        BRAND_WATERMARK_LINK: '',
        SHOW_POWERED_BY: false,
        DEFAULT_BACKGROUND: '#1a1a2e',
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
        MOBILE_APP_PROMO: false,
        SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile'],
    };

    const handleJitsiReady = (api: any) => {
        jitsiApiRef.current = api;
        setJitsiApi(api);

        // Listen for conference left
        api.addListener('videoConferenceLeft', () => {
            leaveClass();
        });

        // Listen for ready to close
        api.addListener('readyToClose', () => {
            leaveClass();
        });
    };

    const JitsiComponent = (
        <JitsiMeeting
            domain="meet.ffmuc.net"
            roomName={roomName}
            configOverwrite={jitsiConfig}
            interfaceConfigOverwrite={interfaceConfig}
            userInfo={{
                displayName: userName,
                email: '',
            }}
            onApiReady={handleJitsiReady}
            getIFrameRef={(iframeRef) => {
                if (iframeRef) {
                    iframeRef.style.width = '100%';
                    iframeRef.style.height = '100%';
                    iframeRef.style.border = 'none';
                }
            }}
        />
    );

    // DOCKED MODE - Render in classroom page mount point
    if (mountNode && !isMini && !isFloating) {
        return createPortal(
            <div className="w-full h-full relative bg-gray-900">
                {JitsiComponent}
                {/* Float button */}
                <button
                    onClick={() => toggleFloating(true)}
                    className="absolute top-4 right-4 z-[70] p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white backdrop-blur-sm transition-colors"
                    title="Float Video"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
            </div>,
            mountNode
        );
    }

    // FLOATING/MINI MODE - Render as draggable window
    return createPortal(
        <div
            className="fixed shadow-2xl z-[9999]"
            style={{
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
            }}
        >
            <div className="bg-gray-900 w-full h-full rounded-xl overflow-hidden border border-white/10 relative group">
                {/* Drag Handle */}
                <div
                    onMouseDown={(e) => handleMouseDown(e, 'drag')}
                    className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-black/80 to-transparent z-[60] cursor-grab active:cursor-grabbing flex justify-between items-center px-3 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <span className="text-white/70 text-sm font-medium truncate max-w-[60%]">{title}</span>
                    <div className="flex gap-2">
                        {isFloating && !isMini && (
                            <button
                                onClick={() => toggleFloating(false)}
                                className="p-1.5 bg-black/40 hover:bg-white/20 text-white rounded cursor-pointer"
                                title="Dock Video"
                            >
                                <Maximize2 className="w-4 h-4" />
                            </button>
                        )}
                        {isMini && (
                            <button
                                onClick={() => toggleMini(false)}
                                className="p-1.5 bg-black/40 hover:bg-white/20 text-white rounded cursor-pointer"
                                title="Expand"
                            >
                                <Maximize2 className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={leaveClass}
                            className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded cursor-pointer"
                            title="Leave Class"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Jitsi iframe */}
                <div className="w-full h-full">
                    {JitsiComponent}
                </div>

                {/* Resize Handle */}
                <div
                    onMouseDown={(e) => handleMouseDown(e, 'resize')}
                    className="absolute bottom-0 right-0 w-6 h-6 bg-white/20 hover:bg-white/40 z-[60] cursor-se-resize rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                />
            </div>
        </div>,
        document.body
    );
}
