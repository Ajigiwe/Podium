import {
    usePersistentUserChoices,
    TrackToggle,
    ChatToggle,
    MediaDeviceMenu,
    useLocalParticipant,
    useLayoutContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Smile, PictureInPicture2, MoreVertical, Mic, VideoIcon, MicOff, VideoOff, MonitorUp, PhoneOff, MessageSquare, Hand } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReactionModal } from './ReactionModal';

interface CustomControlBarProps {
    onTogglePiP: () => void; // Toggle PiP mode
    onReaction: (emoji: string) => void;
    isPiPActive: boolean;
    onLeave: () => void;
    onToggleChat: () => void;
    isChatOpen: boolean;
    onToggleHand: () => void;
    isHandRaised: boolean;
    unreadChatCount: number;
}

export default function CustomControlBar({
    onTogglePiP,
    onReaction,
    isPiPActive,
    onLeave,
    onToggleChat,
    isChatOpen,
    onToggleHand,
    isHandRaised,
    unreadChatCount
}: CustomControlBarProps) {
    const { saveAudioInputEnabled, saveVideoInputEnabled } = usePersistentUserChoices();
    const {
        localParticipant,
        isMicrophoneEnabled,
        isCameraEnabled,
        isScreenShareEnabled
    } = useLocalParticipant();

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

    const emojis = ['👍', '👏', '❤️', '🔥', '🎉', '😂', '😮', '🤔'];

    return (
        <div className="lk-control-bar !border-t-0 !bg-gray-900/90 !backdrop-blur-sm !p-1 sm:!p-1.5 rounded-xl mb-4 sm:mb-6 mx-auto max-w-fit flex items-center gap-1 sm:gap-1.5 shadow-xl border border-white/10">
            {/* Microphone */}
            <div className="relative group">
                <TrackToggle
                    source={Track.Source.Microphone}
                    showIcon={false}
                    onChange={saveAudioInputEnabled}
                    className="!bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-1.5 sm:!p-2 !h-auto !w-auto rounded-lg"
                >
                    {isMicrophoneEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-red-500" />}
                </TrackToggle>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                    <MediaDeviceMenu kind="audioinput" />
                </div>
            </div>

            {/* Camera */}
            <div className="relative group">
                <TrackToggle
                    source={Track.Source.Camera}
                    showIcon={false}
                    onChange={saveVideoInputEnabled}
                    className="!bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-1.5 sm:!p-2 !h-auto !w-auto rounded-lg"
                >
                    {isCameraEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4 text-red-500" />}
                </TrackToggle>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                    <MediaDeviceMenu kind="videoinput" />
                </div>
            </div>

            {/* Screen Share */}
            <div
                onClickCapture={(e) => {
                    if (isPiPActive) {
                        e.stopPropagation();
                        alert("Screen sharing is not supported in floating window mode due to browser security restrictions. Please return to the main window to start sharing.");
                    }
                }}
            >
                <TrackToggle
                    source={Track.Source.ScreenShare}
                    captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
                    showIcon={false}
                    className={`!bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-1.5 sm:!p-2 !h-auto !w-auto rounded-lg ${isPiPActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isPiPActive}
                >
                    <MonitorUp className={`w-4 h-4 ${isScreenShareEnabled ? 'text-green-500' : ''}`} />
                </TrackToggle>
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

            {/* PiP Button */}
            <button
                onClick={onTogglePiP}
                className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-1.5 sm:!p-2 !h-auto !w-auto rounded-lg ${isPiPActive ? '!text-blue-500' : ''}`}
                title={isPiPActive ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
            >
                <PictureInPicture2 className="w-4 h-4" />
            </button>

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
