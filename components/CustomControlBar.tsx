import {
    usePersistentUserChoices,
    TrackToggle,
    ChatToggle,
    MediaDeviceMenu,
    useLocalParticipant,
    useLayoutContext,
    useRoomContext,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import { Smile, PictureInPicture2, MoreVertical, Mic, VideoIcon, MicOff, VideoOff, MonitorUp, PhoneOff, MessageSquare, Hand } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReactionModal } from './ReactionModal';
import UnifiedMediaButton from './media/UnifiedMediaButton';

interface CustomControlBarProps {
    onReaction: (emoji: string) => void;
    onLeave: () => void;
    onToggleChat: () => void;
    isChatOpen: boolean;
    onToggleHand: () => void;
    isHandRaised: boolean;
    unreadChatCount: number;
}

export default function CustomControlBar({
    onReaction,
    onLeave,
    onToggleChat,
    isChatOpen,
    onToggleHand,
    isHandRaised,
    unreadChatCount,
    showAlert
}: CustomControlBarProps & { showAlert: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void }) {
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
                showAlert(`Failed to toggle microphone: ${error.message || 'Unknown error'}`, 'error');
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
                showAlert(`Failed to toggle camera: ${error.message || 'Unknown error'}`, 'error');
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
        <div className="lk-control-bar !border-t-0 !bg-gray-900/90 !backdrop-blur-sm !p-1 sm:!p-1.5 rounded-xl mb-4 sm:mb-6 mx-auto max-w-fit flex items-center gap-1 sm:gap-1.5 shadow-xl border border-white/10">
            {/* Microphone */}
            <div className="relative group">
                <button
                    onClick={toggleMic}
                    disabled={isTogglingMic || !isConnected}
                    className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-1.5 sm:!p-2 !h-auto !w-auto rounded-lg transition-all relative ${(isTogglingMic || !isConnected) ? 'opacity-50 cursor-wait' : ''}`}
                >
                    {isMicrophoneEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-red-500" />}
                    {isTogglingMic && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                    )}
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                    <MediaDeviceMenu kind="audioinput" />
                </div>
            </div>

            {/* Camera */}
            <div className="relative group">
                <button
                    onClick={toggleVideo}
                    disabled={isTogglingVideo || !isConnected}
                    className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-1.5 sm:!p-2 !h-auto !w-auto rounded-lg transition-all relative ${(isTogglingVideo || !isConnected) ? 'opacity-50 cursor-wait' : ''}`}
                >
                    {isCameraEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4 text-red-500" />}
                    {isTogglingVideo && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                    )}
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                    <MediaDeviceMenu kind="videoinput" />
                </div>
            </div>

            {/* Screen Share */}
            <div>
                <button
                    onClick={toggleScreenShare}
                    disabled={isTogglingScreen || !isConnected}
                    className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-1.5 sm:!p-2 !h-auto !w-auto rounded-lg transition-all relative ${(isTogglingScreen || !isConnected) ? 'opacity-50 cursor-wait' : ''}`}
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
                className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-1.5 sm:!p-2 !h-auto !w-auto rounded-lg relative ${isChatOpen ? '!text-blue-500' : ''}`}
            >
                <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Chat</span>
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
                className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-1.5 sm:!p-2 !h-auto !w-auto rounded-lg transition-all ${isHandRaised ? '!bg-yellow-500 !text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' : ''}`}
                title={isHandRaised ? "Lower Hand" : "Raise Hand"}
            >
                <Hand className={`w-4 h-4 ${isHandRaised ? 'animate-bounce' : ''}`} />
            </button>

            {/* Reactions */}
            <button
                onClick={() => setShowReactions(true)}
                className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-1.5 sm:!p-2 !h-auto !w-auto rounded-lg transition-colors ${showReactions ? '!bg-blue-600 !text-white' : ''}`}
                title="Reactions"
            >
                <Smile className="w-4 h-4" />
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

            {/* Unified Media Button (PiP + Mobile Audio) */}
            <UnifiedMediaButton />

            <div className="w-px h-8 bg-gray-700 mx-1" />

            {/* Leave */}
            <button
                onClick={onLeave}
                className="bg-red-600 hover:bg-red-700 text-white p-1.5 sm:px-3 sm:py-2 rounded-lg flex items-center gap-2 transition-colors duration-200 font-medium text-sm"
            >
                <PhoneOff className="w-4 h-4" />
                <span className="hidden sm:inline">Leave</span>
            </button>
        </div>
    );
}
