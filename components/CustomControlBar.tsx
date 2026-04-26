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
import { Track, ConnectionState } from 'livekit-client';
import { Smile, PictureInPicture2, MoreVertical, Mic, VideoIcon, MicOff, VideoOff, MonitorUp, PhoneOff, MessageSquare, Hand, Lock, Volume2, ChevronUp } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ReactionModal } from './ReactionModal';
import UnifiedMediaButton from './media/UnifiedMediaButton';
import { usePermissions } from '@/hooks/usePermissions';

const DeviceMenu = ({
    kind,
    isOpen,
    onClose,
    triggerRef
}: {
    kind: 'audioinput' | 'videoinput' | 'audiooutput',
    isOpen: boolean,
    onClose: () => void,
    triggerRef: React.RefObject<HTMLDivElement | null>
}) => {
    const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind });
    const menuRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ bottom: 0, left: 0 });

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const menuWidth = Math.min(window.innerWidth - 32, 280);
            let left = rect.left + rect.width / 2;
            const halfWidth = menuWidth / 2;
            if (left - halfWidth < 16) left = halfWidth + 16;
            if (left + halfWidth > window.innerWidth - 16) left = window.innerWidth - 16 - halfWidth;
            setCoords({ bottom: window.innerHeight - rect.top + 12, left: left });
        }
    }, [isOpen, triggerRef]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && menuRef.current.contains(event.target as Node)) return;
            const target = event.target as HTMLElement;
            if (target.closest('.device-menu-toggle')) return;
            onClose();
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [isOpen, onClose]);

    if (!devices || devices.length === 0 || !isOpen) return null;

    const content = (
        <div
            ref={menuRef}
            style={{
                position: 'fixed',
                bottom: `${coords.bottom}px`,
                left: `${coords.left}px`,
                transform: 'translateX(-50%)'
            }}
            className="z-[9999] animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300"
        >
            <div className="bg-gray-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 w-[280px] max-w-[calc(100vw-32px)] flex flex-col gap-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                <div className="px-3 py-2 text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/5 mb-1 flex items-center justify-between">
                    <span>{kind === 'audioinput' ? 'Microphone' : kind === 'videoinput' ? 'Camera' : 'Speakers'}</span>
                    <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[9px]">{devices.length}</span>
                </div>
                <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-1">
                    {devices.map((device) => (
                        <button
                            key={device.deviceId}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveMediaDevice(device.deviceId);
                                onClose();
                            }}
                            className={`text-left px-3 py-2.5 text-xs rounded-xl transition-all truncate w-full flex items-center gap-3 group/item ${activeDeviceId === device.deviceId
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-600/20'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${activeDeviceId === device.deviceId ? 'bg-white animate-pulse' : 'bg-gray-700'}`} />
                            <span className="truncate">{device.label || `Device ${device.deviceId.slice(0, 5)}`}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    return typeof window !== 'undefined' ? createPortal(content, document.body) : null;
};

interface CustomControlBarProps {
    roomId: string;
    isLecturer: boolean;
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
    const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();

    const [isTogglingMic, setIsTogglingMic] = useState(false);
    const [isTogglingVideo, setIsTogglingVideo] = useState(false);
    const [isTogglingScreen, setIsTogglingScreen] = useState(false);

    const room = useRoomContext();
    const isConnected = room?.state === ConnectionState.Connected;
    const [activeMenu, setActiveMenu] = useState<'mic' | 'camera' | null>(null);
    const [showReactions, setShowReactions] = useState(false);
    const emojis = ['👍', '👏', '❤️', '🔥', '🎉', '😂', '😮', '🤔'];

    const micRef = useRef<HTMLDivElement>(null);
    const cameraRef = useRef<HTMLDivElement>(null);
    const reactionBtnRef = useRef<HTMLButtonElement>(null);

    const toggleMenu = (menu: 'mic' | 'camera', e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setActiveMenu(prev => prev === menu ? null : menu);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (reactionBtnRef.current && !reactionBtnRef.current.contains(event.target as Node)) {
                const popover = document.getElementById('reaction-popover');
                if (popover && !popover.contains(event.target as Node)) setShowReactions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMic = async () => {
        if (!localParticipant || isTogglingMic || !isConnected) {
            if (!isConnected) showAlert('Cannot toggle microphone while disconnected.', 'warning');
            return;
        }
        if (!permissions.mic) {
            await requestPermission('microphone');
            return;
        }
        setIsTogglingMic(true);
        try {
            const newState = !isMicrophoneEnabled;
            await localParticipant.setMicrophoneEnabled(newState);
            if (saveAudioInputEnabled) saveAudioInputEnabled(newState);
        } catch (error: any) {
            console.error('Failed to toggle microphone:', error);
            showAlert(`Failed to toggle microphone: ${error.message || 'Unknown error'}`, 'error');
        }
        setIsTogglingMic(false);
    };

    const toggleVideo = async () => {
        if (!localParticipant || isTogglingVideo || !isConnected) {
            if (!isConnected) showAlert('Cannot toggle camera while disconnected.', 'warning');
            return;
        }
        if (!permissions.camera) {
            await requestPermission('camera');
            return;
        }
        setIsTogglingVideo(true);
        try {
            const newState = !isCameraEnabled;
            await localParticipant.setCameraEnabled(newState);
            if (saveVideoInputEnabled) saveVideoInputEnabled(newState);
        } catch (error: any) {
            console.error('Failed to toggle camera:', error);
            showAlert(`Failed to toggle camera: ${error.message || 'Unknown error'}`, 'error');
        }
        setIsTogglingVideo(false);
    };

    const toggleScreenShare = async () => {
        if (!localParticipant || isTogglingScreen || !isConnected) {
            if (!isConnected) showAlert('Cannot toggle screen share while disconnected.', 'warning');
            return;
        }
        setIsTogglingScreen(true);
        try {
            await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
        } catch (error: any) {
            console.error('Failed to toggle screen share:', error);
            showAlert(`Failed to toggle screen share: ${error.message || 'Unknown error'}`, 'error');
        }
        setIsTogglingScreen(false);
    };

    return (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-1.5 sm:gap-4 p-1.5 sm:p-2 bg-gray-950/60 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5 animate-in slide-in-from-bottom-10 duration-700 max-w-[95vw] sm:max-w-none overflow-x-auto no-scrollbar">
            {/* Audio Section */}
            <div className="flex items-center bg-white/5 rounded-2xl p-0.5 sm:p-1 gap-0.5 sm:gap-1" ref={micRef}>
                <button
                    onClick={toggleMic}
                    disabled={isTogglingMic || !isConnected}
                    className={`h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-xl transition-all duration-300 relative group ${
                        isMicrophoneEnabled 
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/20' 
                        : 'bg-white/5 hover:bg-white/10'
                    } ${(!isConnected || isTogglingMic) ? 'opacity-50' : ''}`}
                >
                    {isMicrophoneEnabled ? <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
                    {!permissions.mic && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-gray-950"><Lock className="w-2 h-2 text-white scale-75 sm:scale-100" /></div>}
                </button>
                <button
                    onClick={(e) => toggleMenu('mic', e)}
                    className={`device-menu-toggle h-9 w-4 sm:h-11 sm:w-6 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors ${activeMenu === 'mic' ? 'bg-white/10' : ''}`}
                >
                    <ChevronUp className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500 transition-transform duration-300 ${activeMenu === 'mic' ? 'rotate-180 text-blue-400' : ''}`} />
                </button>
                <DeviceMenu kind="audioinput" isOpen={activeMenu === 'mic'} onClose={() => setActiveMenu(null)} triggerRef={micRef} />
            </div>

            {/* Video Section */}
            <div className="flex items-center bg-white/5 rounded-2xl p-0.5 sm:p-1 gap-0.5 sm:gap-1" ref={cameraRef}>
                <button
                    onClick={toggleVideo}
                    disabled={isTogglingVideo || !isConnected}
                    className={`h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-xl transition-all duration-300 relative group ${
                        isCameraEnabled 
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/20' 
                        : 'bg-white/5 hover:bg-white/10'
                    } ${(!isConnected || isTogglingVideo) ? 'opacity-50' : ''}`}
                >
                    {isCameraEnabled ? <VideoIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
                    {!permissions.camera && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-gray-950"><Lock className="w-2 h-2 text-white scale-75 sm:scale-100" /></div>}
                </button>
                <button
                    onClick={(e) => toggleMenu('camera', e)}
                    className={`device-menu-toggle h-9 w-4 sm:h-11 sm:w-6 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors ${activeMenu === 'camera' ? 'bg-white/10' : ''}`}
                >
                    <ChevronUp className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500 transition-transform duration-300 ${activeMenu === 'camera' ? 'rotate-180 text-blue-400' : ''}`} />
                </button>
                <DeviceMenu kind="videoinput" isOpen={activeMenu === 'camera'} onClose={() => setActiveMenu(null)} triggerRef={cameraRef} />
            </div>

            {/* Interaction Section */}
            <div className="flex items-center bg-white/5 rounded-2xl p-0.5 sm:p-1 gap-0.5 sm:gap-1">
                <button
                    onClick={toggleScreenShare}
                    disabled={isTogglingScreen || !isConnected}
                    className={`hidden sm:flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 ${
                        isScreenShareEnabled ? 'bg-green-600/20 text-green-400 ring-2 ring-green-500/50' : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}
                >
                    <MonitorUp className="w-5 h-5" />
                </button>
                
                <div className="hidden sm:block w-px h-6 bg-white/10 mx-1" />

                <button
                    onClick={onToggleChat}
                    className={`h-9 sm:h-11 flex items-center gap-2 px-3 sm:px-4 rounded-xl transition-all duration-300 relative ${
                        isChatOpen ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}
                >
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden md:inline text-sm font-bold">Chat</span>
                    {unreadChatCount > 0 && !isChatOpen && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] sm:text-[10px] font-black min-w-[16px] sm:min-w-[20px] h-[16px] sm:h-[20px] flex items-center justify-center rounded-full border-2 border-gray-950 animate-bounce">
                            {unreadChatCount > 9 ? '9+' : unreadChatCount}
                        </span>
                    )}
                </button>

                <button
                    onClick={onToggleHand}
                    className={`h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-xl transition-all duration-300 ${
                        isHandRaised ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}
                >
                    <Hand className={`w-4 h-4 sm:w-5 sm:h-5 ${isHandRaised ? 'animate-bounce' : ''}`} />
                </button>

                <button
                    ref={reactionBtnRef}
                    onClick={() => setShowReactions(!showReactions)}
                    className={`h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-xl transition-all duration-300 ${
                        showReactions ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 hover:bg-white/10 text-white'
                    }`}
                >
                    <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            </div>

            {/* Leave Section */}
            <button
                onClick={onLeave}
                className="group h-9 sm:h-11 flex items-center gap-2 px-3 sm:px-5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl sm:rounded-2xl transition-all duration-300 border border-red-500/20 hover:border-red-600 shadow-lg hover:shadow-red-600/20"
            >
                <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-rotate-[135deg]" />
                <span className="hidden sm:inline text-sm font-black uppercase tracking-wider">Leave</span>
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
        </div>
    );
}
