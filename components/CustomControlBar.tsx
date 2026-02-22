import {
    usePersistentUserChoices,
    useMediaDeviceSelect,
    TrackToggle,
    ChatToggle,
    MediaDeviceMenu,
    useLocalParticipant,
    useLayoutContext,
    useRoomContext,
} from '@livekit/components-react';

const HoverDeviceMenu = ({ kind }: { kind: 'audioinput' | 'videoinput' }) => {
    const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind });

    if (!devices || devices.length <= 1) return null; // Only show if there are options

    return (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 hidden group-hover:block z-50">
            <div className="bg-gray-900 border border-gray-700/80 rounded-lg shadow-2xl p-1.5 min-w-[220px] max-w-[300px] flex flex-col gap-0.5 animate-in fade-in slide-in-from-bottom-2">
                <div className="px-2 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-800/50 mb-1">
                    Select {kind === 'audioinput' ? 'Microphone' : 'Camera'}
                </div>
                <div className="max-h-48 overflow-y-auto scrollbar-thin">
                    {devices.map((device) => (
                        <button
                            key={device.deviceId}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveMediaDevice(device.deviceId);
                            }}
                            className={`text-left px-2.5 py-2 text-xs rounded-md transition-colors truncate w-full flex items-center gap-2 ${activeDeviceId === device.deviceId
                                ? 'bg-blue-600/20 text-blue-400 font-medium'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                            title={device.label || 'Unknown Device'}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeDeviceId === device.deviceId ? 'bg-blue-500' : 'bg-transparent'}`} />
                            <span className="truncate">{device.label || `Device ${device.deviceId.slice(0, 5)}`}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
import { Track, ConnectionState } from 'livekit-client';
import { Smile, PictureInPicture2, MoreVertical, Mic, VideoIcon, MicOff, VideoOff, MonitorUp, PhoneOff, MessageSquare, Hand, Lock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReactionModal } from './ReactionModal';
import UnifiedMediaButton from './media/UnifiedMediaButton';
import { usePermissions } from '@/hooks/usePermissions';

interface CustomControlBarProps {
    roomId: string; // Added roomId for permissions
    isLecturer: boolean; // Added role check for permissions
    onReaction: (emoji: string) => void;
    onLeave: () => void;
    onToggleChat: () => void;
    isChatOpen: boolean;
    onToggleHand: () => void;
    isHandRaised: boolean;
    unreadChatCount: number;
    showAlert: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    customAlert: (options: any) => void;
}

export default function CustomControlBar({
    roomId,
    isLecturer,
    onReaction,
    onLeave,
    onToggleChat,
    isChatOpen,
    onToggleHand,
    isHandRaised,
    unreadChatCount,
    showAlert,
    customAlert
}: CustomControlBarProps) {
    const { permissions, hasPendingRequest, requestPermission } = usePermissions(roomId, isLecturer);
    const { saveAudioInputEnabled, saveVideoInputEnabled } = usePersistentUserChoices();
    const {
        localParticipant,
        isMicrophoneEnabled,
        isCameraEnabled,
        isScreenShareEnabled
    } = useLocalParticipant();

    const [isTogglingMic, setIsTogglingMic] = useState(false);
    const [isTogglingVideo, setIsTogglingVideo] = useState(false);
    const [isTogglingScreen, setIsTogglingScreen] = useState(false);

    const room = useRoomContext();
    const isConnected = room?.state === ConnectionState.Connected;
    const isConnectingOrReconnecting = room?.state === ConnectionState.Connecting || room?.state === ConnectionState.Reconnecting;

    const [showReactions, setShowReactions] = useState(false);
    const reactionBtnRef = useRef<HTMLButtonElement>(null);

    // Close reactions menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (reactionBtnRef.current && !reactionBtnRef.current.contains(event.target as Node)) {
                // Check if clicking inside the popover (which might be rendered elsewhere or just next to it)
                const popover = document.getElementById('reaction-popover');
                if (popover && !popover.contains(event.target as Node)) {
                    setShowReactions(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Layout context for chat - NO LONGER USED
    // const layoutContext = useLayoutContext();
    // const { widgetState } = layoutContext;

    const toggleMic = async () => {
        if (!localParticipant || isTogglingMic || !isConnected) {
            if (!isConnected) showAlert('Cannot toggle microphone while disconnected or reconnecting.', 'warning');
            return;
        }

        if (!permissions.mic) {
            await requestPermission('microphone');
            return;
        }

        setIsTogglingMic(true);
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const newState = !isMicrophoneEnabled;
                await localParticipant.setMicrophoneEnabled(newState);
                if (saveAudioInputEnabled) saveAudioInputEnabled(newState);
                break; // Success
            } catch (error: any) {
                attempts++;
                const isEngineError = error.message?.includes('engine not connected') || error.message?.includes('timeout');

                if (attempts < maxAttempts && isEngineError) {
                    console.warn(`Microphone toggle retry ${attempts}/${maxAttempts} due to engine latency...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                console.error('Failed to toggle microphone:', error);
                const errorName = error.name || 'Error';
                const errorMessage = error.message || '';
                const isConflict = errorName === 'AbortError' || errorName === 'NotReadableError' || errorMessage.includes('DeviceInUse');

                if (isConflict) {
                    customAlert({
                        title: 'Microphone Already in Use',
                        message: 'Another application is using your microphone. Please close other apps and try again.',
                        type: 'error',
                        confirmText: 'Dismiss'
                    });
                } else {
                    showAlert(`Failed to toggle microphone: ${errorMessage || 'Unknown error'}`, 'error');
                }
                break;
            }
        }
        setIsTogglingMic(false);
    };

    const toggleVideo = async () => {
        if (!localParticipant || isTogglingVideo || !isConnected) {
            if (!isConnected) showAlert('Cannot toggle camera while disconnected or reconnecting.', 'warning');
            return;
        }

        if (!permissions.camera) {
            await requestPermission('camera');
            return;
        }

        setIsTogglingVideo(true);
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const newState = !isCameraEnabled;
                await localParticipant.setCameraEnabled(newState);
                if (saveVideoInputEnabled) saveVideoInputEnabled(newState);
                break; // Success
            } catch (error: any) {
                attempts++;
                const isEngineError = error.message?.includes('engine not connected') || error.message?.includes('timeout');

                if (attempts < maxAttempts && isEngineError) {
                    console.warn(`Camera toggle retry ${attempts}/${maxAttempts} due to engine latency...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                console.error('Failed to toggle camera:', error);
                const errorName = error.name || 'Error';
                const errorMessage = error.message || '';
                const isConflict = errorName === 'AbortError' || errorName === 'NotReadableError' || errorMessage.includes('DeviceInUse');

                if (isConflict) {
                    customAlert({
                        title: 'Camera Already in Use',
                        message: 'Another application (like Zoom, Teams, or another browser tab) is already using your camera. Please close those applications and try again.',
                        type: 'error',
                        confirmText: 'Dismiss',
                        cancelText: 'Join without Media', // Use existing pattern
                        onCancel: () => {
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('podium_camera_state', 'false');
                            }
                        }
                    });
                } else {
                    showAlert(`Failed to toggle camera: ${errorMessage || 'Unknown error'}`, 'error');
                }
                break;
            }
        }
        setIsTogglingVideo(false);
    };

    const toggleScreenShare = async () => {
        if (!localParticipant || isTogglingScreen || !isConnected) {
            if (!isConnected) showAlert('Cannot toggle screen share while disconnected or reconnecting.', 'warning');
            return;
        }
        setIsTogglingScreen(true);
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const newState = !isScreenShareEnabled;
                await localParticipant.setScreenShareEnabled(newState);
                break; // Success
            } catch (error: any) {
                attempts++;
                const isEngineError = error.message?.includes('engine not connected') || error.message?.includes('timeout');

                if (attempts < maxAttempts && isEngineError) {
                    console.warn(`Screen share toggle retry ${attempts}/${maxAttempts} due to engine latency...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                console.error('Failed to toggle screen share:', error);
                showAlert(`Failed to toggle screen share: ${error.message || 'Unknown error'}`, 'error');
                break;
            }
        }
        setIsTogglingScreen(false);
    };

    const emojis = ['👍', '👏', '❤️', '🔥', '🎉', '😂', '😮', '🤔'];

    return (
        <div className="lk-control-bar !border-t-0 !bg-gray-900/90 !backdrop-blur-sm !p-1 sm:!p-1.5 rounded-xl mb-4 sm:mb-6 mx-auto max-w-[95vw] sm:max-w-fit flex items-center overflow-x-auto no-scrollbar gap-0.5 sm:gap-1.5 shadow-xl border border-white/10">
            {/* Microphone */}
            <div className="relative group">
                <button
                    onClick={toggleMic}
                    disabled={isTogglingMic || !isConnected}
                    className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 sm:!p-2.5 !h-10 !w-10 sm:!h-11 sm:!w-11 rounded-xl transition-all relative ${(isTogglingMic || !isConnected) ? 'opacity-50 cursor-wait' :
                        !permissions.mic ? 'opacity-80' : ''
                        }`}
                    title={
                        !permissions.mic ? 'Request mic permission' :
                            isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'
                    }
                >
                    {isMicrophoneEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-red-500" />}

                    {!permissions.mic && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-md border border-gray-900">
                            <Lock className="w-2.5 h-2.5 text-white" />
                        </div>
                    )}

                    {isTogglingMic && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                    )}
                </button>
                <HoverDeviceMenu kind="audioinput" />
            </div>

            {/* Camera */}
            <div className="relative group">
                <button
                    onClick={toggleVideo}
                    disabled={isTogglingVideo || !isConnected}
                    className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 sm:!p-2.5 !h-10 !w-10 sm:!h-11 sm:!w-11 rounded-xl transition-all relative ${(isTogglingVideo || !isConnected) ? 'opacity-50 cursor-wait' :
                        !permissions.camera ? 'opacity-80' : ''
                        }`}
                    title={
                        !permissions.camera ? 'Request camera permission' :
                            isCameraEnabled ? 'Turn off camera' : 'Turn on camera'
                    }
                >
                    {isCameraEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4 text-red-500" />}

                    {!permissions.camera && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-md border border-gray-900">
                            <Lock className="w-2.5 h-2.5 text-white" />
                        </div>
                    )}

                    {isTogglingVideo && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                    )}
                </button>
                <HoverDeviceMenu kind="videoinput" />
            </div>

            {/* Screen Share */}
            <div className="hidden sm:block">
                <button
                    onClick={toggleScreenShare}
                    disabled={isTogglingScreen || !isConnected}
                    className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 sm:!p-2.5 !h-10 !w-10 sm:!h-11 sm:!w-11 rounded-xl transition-all relative ${(isTogglingScreen || !isConnected) ? 'opacity-50 cursor-wait' : ''}`}
                >
                    <MonitorUp className={`w-4 h-4 ${isScreenShareEnabled ? 'text-green-500' : ''}`} />
                    {isTogglingScreen && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                    )}
                </button>
            </div>

            <div className="w-px h-8 bg-gray-700 mx-1" />

            {/* Chat */}
            <button
                onClick={onToggleChat}
                className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 sm:!p-2.5 !h-10 sm:!h-11 !w-auto px-3 sm:px-4 rounded-xl relative ${isChatOpen ? '!text-blue-500' : ''}`}
            >
                <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="w-5 h-5 sm:w-4 sm:h-4" />
                    <span className="hidden md:inline">Chat</span>
                </div>
                {unreadChatCount > 0 && !isChatOpen && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 border-2 border-gray-900 animate-in zoom-in duration-200">
                        {unreadChatCount > 9 ? '9+' : unreadChatCount}
                    </span>
                )}
            </button>

            {/* Raise Hand */}
            <button
                onClick={onToggleHand}
                className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 sm:!p-2.5 !h-10 !w-10 sm:!h-11 sm:!w-11 rounded-xl transition-all ${isHandRaised ? '!bg-yellow-500 !text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' : ''}`}
                title={isHandRaised ? "Lower Hand" : "Raise Hand"}
            >
                <Hand className={`w-5 h-5 sm:w-4 sm:h-4 ${isHandRaised ? 'animate-bounce' : ''}`} />
            </button>

            {/* Reactions */}
            <button
                onClick={() => setShowReactions(true)}
                className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 sm:!p-2.5 !h-10 !w-10 sm:!h-11 sm:!w-11 rounded-xl transition-colors ${showReactions ? '!bg-blue-600 !text-white' : ''}`}
                title="Reactions"
            >
                <Smile className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>

            {/* Reaction Modal Portal */}
            {typeof window !== 'undefined' && createPortal(
                <ReactionModal
                    isOpen={showReactions}
                    onClose={() => setShowReactions(false)}
                    onReaction={onReaction}
                    emojis={emojis}
                />,
                document.body
            )}

            {/* Unified Media Button (PiP + Mobile Audio -> now Mobile Leave) */}
            <UnifiedMediaButton onLeave={onLeave} />

            <div className="w-px h-8 bg-gray-700 mx-1 hidden sm:block" />

            {/* Leave - Hidden on mobile because it's now in UnifiedMediaButton */}
            <button
                onClick={onLeave}
                className="hidden sm:flex bg-red-600 hover:bg-red-700 text-white p-1.5 sm:px-3 sm:py-2 rounded-lg items-center gap-2 transition-colors duration-200 font-medium text-sm"
            >
                <PhoneOff className="w-4 h-4" />
                <span className="hidden sm:inline">Leave</span>
            </button>
        </div>
    );
}
