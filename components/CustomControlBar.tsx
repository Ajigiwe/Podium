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
    isActive: boolean;
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
    isActive,
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
            const currentState = localParticipant.isMicrophoneEnabled;
            const newState = !currentState;
            console.log(`[CustomControlBar] Toggling mic from ${currentState} to ${newState}`);
            await localParticipant.setMicrophoneEnabled(newState);
            if (saveAudioInputEnabled) saveAudioInputEnabled(newState);
        } catch (error: any) {
            console.error('[CustomControlBar] Failed to toggle microphone:', error);
            showAlert(`Failed to toggle microphone: ${error.message || 'Unknown error'}`, 'error');
        } finally {
            setIsTogglingMic(false);
        }
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
            const currentState = localParticipant.isCameraEnabled;
            const newState = !currentState;
            console.log(`[CustomControlBar] Toggling camera from ${currentState} to ${newState}`);
            await localParticipant.setCameraEnabled(newState);
            if (saveVideoInputEnabled) saveVideoInputEnabled(newState);
        } catch (error: any) {
            console.error('[CustomControlBar] Failed to toggle camera:', error);
            showAlert(`Failed to toggle camera: ${error.message || 'Unknown error'}`, 'error');
        } finally {
            setIsTogglingVideo(false);
        }
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
        <div className="fixed bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1.5 bg-slate-900/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-10 duration-700 max-w-[98vw]">
            {/* Audio Section */}
            <div className="flex items-center" ref={micRef}>
                <button
                    onClick={toggleMic}
                    disabled={isTogglingMic || !isConnected}
                    className={`h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-xl transition-all duration-300 relative ${
                        isMicrophoneEnabled 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : 'text-slate-400 hover:bg-white/5'
                    } ${(!isConnected || isTogglingMic) ? 'opacity-50' : ''}`}
                    title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
                >
                    {isMicrophoneEnabled ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
                    {!permissions.mic && <div className="absolute top-0.5 right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full flex items-center justify-center border border-slate-900"><Lock className="w-1 h-1 sm:w-1.5 sm:h-1.5 text-white" /></div>}
                </button>
                <button
                    onClick={(e) => toggleMenu('mic', e)}
                    className={`device-menu-toggle h-9 w-4 sm:h-11 sm:w-4 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors ${activeMenu === 'mic' ? 'text-indigo-400' : 'text-slate-500'}`}
                >
                    <ChevronUp className={`w-3 h-3 sm:w-2.5 sm:h-2.5 transition-transform duration-300 ${activeMenu === 'mic' ? 'rotate-180' : ''}`} />
                </button>
                <DeviceMenu kind="audioinput" isOpen={activeMenu === 'mic'} onClose={() => setActiveMenu(null)} triggerRef={micRef} />
            </div>

            <div className="w-px h-5 bg-white/10 mx-0.5 sm:mx-1" />

            {/* Video Section */}
            <div className="flex items-center" ref={cameraRef}>
                <button
                    onClick={toggleVideo}
                    disabled={isTogglingVideo || !isConnected}
                    className={`h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-xl transition-all duration-300 relative ${
                        isCameraEnabled 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : 'text-slate-400 hover:bg-white/5'
                    } ${(!isConnected || isTogglingVideo) ? 'opacity-50' : ''}`}
                    title={isCameraEnabled ? 'Stop Video' : 'Start Video'}
                >
                    {isCameraEnabled ? <VideoIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
                    {!permissions.camera && <div className="absolute top-0.5 right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full flex items-center justify-center border border-slate-900"><Lock className="w-1 h-1 sm:w-1.5 sm:h-1.5 text-white" /></div>}
                </button>
                <button
                    onClick={(e) => toggleMenu('camera', e)}
                    className={`device-menu-toggle h-9 w-4 sm:h-11 sm:w-4 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors ${activeMenu === 'camera' ? 'text-indigo-400' : 'text-slate-500'}`}
                >
                    <ChevronUp className={`w-3 h-3 sm:w-2.5 sm:h-2.5 transition-transform duration-300 ${activeMenu === 'camera' ? 'rotate-180' : ''}`} />
                </button>
                <DeviceMenu kind="videoinput" isOpen={activeMenu === 'camera'} onClose={() => setActiveMenu(null)} triggerRef={cameraRef} />
            </div>

            <div className="w-px h-5 bg-white/10 mx-0.5 sm:mx-1" />

            {/* Interaction Section */}
            <div className="flex items-center gap-0.5 sm:gap-1">
                <button
                    onClick={toggleScreenShare}
                    disabled={isTogglingScreen || !isConnected}
                    className={`h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-xl transition-all duration-300 ${
                        isScreenShareEnabled ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30' : 'text-slate-400 hover:bg-white/5'
                    }`}
                    title="Share Screen"
                >
                    <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                
                <button
                    onClick={onToggleChat}
                    className={`h-9 px-2 sm:h-11 sm:px-3 flex items-center gap-1.5 rounded-xl transition-all duration-300 relative ${
                        isChatOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-white/5'
                    }`}
                    title="Toggle Chat"
                >
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                    {unreadChatCount > 0 && !isChatOpen && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-black min-w-[16px] h-[16px] flex items-center justify-center rounded-full border border-slate-900 animate-bounce">
                            {unreadChatCount > 9 ? '9+' : unreadChatCount}
                        </span>
                    )}
                </button>

                <button
                    onClick={onToggleHand}
                    className={`h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-xl transition-all duration-300 ${
                        isHandRaised ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:bg-white/5'
                    }`}
                    title="Raise Hand"
                >
                    <Hand className={`w-4 h-4 sm:w-5 sm:h-5 ${isHandRaised ? 'animate-bounce' : ''}`} />
                </button>

                <button
                    ref={reactionBtnRef}
                    onClick={() => setShowReactions(!showReactions)}
                    className={`h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center rounded-xl transition-all duration-300 ${
                        showReactions ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-white/5'
                    }`}
                    title="Reactions"
                >
                    <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            </div>

            <div className="w-px h-5 bg-white/10 mx-0.5 sm:mx-1" />

            {/* Leave Section */}
            <button
                onClick={onLeave}
                className="group h-9 w-9 sm:h-11 sm:w-20 flex items-center justify-center sm:gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all duration-300 border border-red-500/20 hover:border-red-600"
                title="Leave Classroom"
            >
                <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-rotate-[135deg]" />
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Leave</span>
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
