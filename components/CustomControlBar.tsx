import {
    usePersistentUserChoices,
    TrackToggle,
    ChatToggle,
    MediaDeviceMenu,
    useLocalParticipant,
    useLayoutContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Smile, PictureInPicture2, MoreVertical, Mic, VideoIcon, MicOff, VideoOff, MonitorUp, PhoneOff, MessageSquare } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface CustomControlBarProps {
    onTogglePiP: () => void; // Toggle PiP mode
    onReaction: (emoji: string) => void;
    isPiPActive: boolean;
    onLeave: () => void;
    onToggleChat: () => void;
    isChatOpen: boolean;
}

export default function CustomControlBar({
    onTogglePiP,
    onReaction,
    isPiPActive,
    onLeave,
    onToggleChat,
    isChatOpen
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
        <div className="lk-control-bar !border-t-0 !bg-gray-900/90 !backdrop-blur-sm !p-1.5 rounded-xl mb-4 mx-auto max-w-fit flex items-center gap-1.5 shadow-xl border border-white/10">
            {/* Microphone */}
            <div className="relative group">
                <TrackToggle
                    source={Track.Source.Microphone}
                    showIcon={false}
                    onChange={saveAudioInputEnabled}
                    className="!bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 !h-auto !w-auto rounded-lg"
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
                    className="!bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 !h-auto !w-auto rounded-lg"
                >
                    {isCameraEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4 text-red-500" />}
                </TrackToggle>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
                    <MediaDeviceMenu kind="videoinput" />
                </div>
            </div>

            {/* Screen Share */}
            <TrackToggle
                source={Track.Source.ScreenShare}
                captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
                showIcon={false}
                className="!bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 !h-auto !w-auto rounded-lg"
            >
                <MonitorUp className={`w-4 h-4 ${isScreenShareEnabled ? 'text-green-500' : ''}`} />
            </TrackToggle>

            <div className="w-px h-8 bg-gray-700 mx-1" />

            {/* Chat */}
            <button
                onClick={onToggleChat}
                className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 !h-auto !w-auto rounded-lg ${isChatOpen ? '!text-blue-500' : ''}`}
            >
                <span className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="w-4 h-4" />
                    Chat
                </span>
            </button>

            {/* Reactions */}
            <div className="relative">
                <button
                    ref={reactionBtnRef}
                    onClick={() => setShowReactions(!showReactions)}
                    className="lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 !h-auto !w-auto rounded-lg relative"
                    title="Reactions"
                >
                    <Smile className="w-4 h-4" />
                </button>

                {showReactions && (
                    <div
                        id="reaction-popover"
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-gray-800 border border-gray-700 rounded-xl shadow-xl p-2 flex gap-1 z-50 min-w-max animate-in fade-in zoom-in duration-200 slide-in-from-bottom-2"
                    >
                        {emojis.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => {
                                    onReaction(emoji);
                                    setShowReactions(false);
                                }}
                                className="p-2 hover:bg-gray-700 rounded-lg text-xl transition-transform hover:scale-125 active:scale-95"
                            >
                                {emoji}
                            </button>
                        ))}
                        <div className="w-3 h-3 bg-gray-800 border-r border-b border-gray-700 absolute -bottom-1.5 left-1/2 -translate-x-1/2 rotate-45" />
                    </div>
                )}
            </div>

            {/* PiP Button */}
            <button
                onClick={onTogglePiP}
                className={`lk-button !bg-gray-800 hover:!bg-gray-700 !border-gray-700 !p-2 !h-auto !w-auto rounded-lg ${isPiPActive ? '!text-blue-500' : ''}`}
                title={isPiPActive ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
            >
                <PictureInPicture2 className="w-4 h-4" />
            </button>

            <div className="w-px h-8 bg-gray-700 mx-1" />

            {/* Leave */}
            <button
                onClick={onLeave}
                className="bg-red-600 hover:bg-red-700 text-white p-2 px-3 rounded-lg flex items-center gap-2 transition-colors duration-200 font-medium text-sm"
            >
                <PhoneOff className="w-4 h-4" />
                <span>Leave</span>
            </button>
        </div>
    );
}
