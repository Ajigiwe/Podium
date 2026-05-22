'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Room, RemoteParticipant, LocalParticipant, Participant, RoomEvent, Track } from 'livekit-client';

import { useAlert } from '@/contexts/AlertContext';
import { GridLayout } from '@/types/layout';
import { db } from '@/lib/firebase/config';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp, setDoc, doc, updateDoc } from 'firebase/firestore';

import { Session } from '@/lib/firebase/types';
import type { CoHost } from '@/lib/firebase/types';
import { subscribeToCoHosts } from '@/lib/firebase/cohost';

// Participant type for LiveKit
export interface LiveKitParticipant {
    participantId: string;
    identity: string;
    displayName: string;
    role?: string;
    isLocal?: boolean;
    audioMuted?: boolean;
    videoMuted?: boolean;
    isSpeaking?: boolean;
    metadata?: {
        role?: string;
        userId?: string;
        name?: string;
        photoURL?: string;
    };
}

// Keep old name for backward compatibility
export type JitsiParticipant = LiveKitParticipant;

interface ClassroomState {
    sessionId: string | null;
    title: string | null;
    userName: string | null;
    userRole: 'student' | 'lecturer' | 'admin' | null;
    userId: string | null;
    isModerator: boolean;
    isHost: boolean;
    isCoHost: boolean;
    sessionData: any | null;
    photoURL: string | null;
    displayIcon: string | null;
    isMini: boolean;
    isActive: boolean;
    isFloating: boolean;
    isChatOpen: boolean;
    unreadChatCount: number;
    participants: LiveKitParticipant[];
    liveKitRoom: Room | null;
    token: string | null;
    coHosts: CoHost[];
    liveMessages: any[];
    layout: GridLayout;
    joinMicEnabled: boolean;
}

interface ClassroomActions {
    joinClass: (sessionId: string, title: string, userName: string, userRole: 'student' | 'lecturer' | 'admin', userId?: string, photoURL?: string, displayIcon?: string, joinMicEnabled?: boolean) => void;
    leaveClass: () => void;
    toggleMini: (isMini: boolean) => void;
    toggleFloating: (floating: boolean) => void;
    toggleMinimize: (minimize: boolean) => void;
    setLiveKitRoom: (room: Room | null) => void;
    setJitsiApi: (api: any) => void;
    setToken: (token: string | null) => void;
    preWarmToken: (sessionId: string, userName: string, userRole: string, userId: string, photoURL?: string, displayIcon?: string) => Promise<void>;
    muteParticipant: (participantId: string) => void;
    disableParticipantVideo: (participantId: string) => void;
    muteAllParticipants: () => void;
    kickParticipant: (participantId: string) => void;
    askToUnmute: (participantId: string) => void;
    grantModerator: (participantId: string) => void;
    assignCoHost: (targetUserId: string, targetUserName: string) => Promise<void>;
    removeCoHost: (coHostUserId: string) => Promise<void>;
    sendMessage: (content: string) => void;
    toggleChat: () => void;
    setLayout: (layout: GridLayout) => void;
}

const ClassroomStateContext = createContext<ClassroomState | undefined>(undefined);
const ClassroomActionsContext = createContext<ClassroomActions | undefined>(undefined);

export function ClassroomProvider({ children }: { children: ReactNode }) {
    console.log('ClassroomProvider initializing...');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [title, setTitle] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<'student' | 'lecturer' | 'admin' | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [sessionData, setSessionData] = useState<any | null>(null);
    const [photoURL, setPhotoURL] = useState<string | null>(null);
    const [displayIcon, setDisplayIcon] = useState<string | null>(null);
    const [joinMicEnabled, setJoinMicEnabled] = useState(true);
    const [isMini, setIsMini] = useState(false);
    const [isFloating, setIsFloating] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [liveMessages, setLiveMessages] = useState<any[]>([]);
    const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);
    const [liveKitRoom, setLiveKitRoomState] = useState<Room | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [layout, setLayout] = useState<GridLayout>('4x4');
    const [coHosts, setCoHosts] = useState<CoHost[]>([]);
    const isFetchingToken = useRef(false);
    const { showAlert, showConfirm } = useAlert();

    const router = useRouter();
    const pathname = usePathname();

    const setLiveKitRoom = useCallback((room: Room | null) => {
        setLiveKitRoomState(room);
    }, []);

    // Backward compatibility helper
    const setJitsiApi = setLiveKitRoom;

    const joinClass = useCallback((
        newSessionId: string,
        newTitle: string,
        newUserName: string,
        newUserRole: 'student' | 'lecturer' | 'admin',
        newUserId?: string,
        newPhotoURL?: string,
        newDisplayIcon?: string,
        newJoinMicEnabled: boolean = true
    ) => {
        setSessionId(newSessionId);
        setTitle(newTitle);
        setUserName(newUserName);
        setUserRole(newUserRole);
        setUserId(newUserId || null);
        setPhotoURL(newPhotoURL || null);
        setDisplayIcon(newDisplayIcon || null);
        setJoinMicEnabled(newJoinMicEnabled);
        setSessionData(null);
        setIsMini(false);
        setIsChatOpen(false);
        setUnreadChatCount(0);
    }, []);

    const preWarmToken = useCallback(async (
        sId: string,
        uName: string,
        uRole: string,
        uId: string,
        uPhotoURL?: string,
        uDisplayIcon?: string
    ) => {
        if (token || isFetchingToken.current) return;
        isFetchingToken.current = true;
        try {
            const response = await fetch('/api/livekit/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName: `podium_${sId}`,
                    participantName: uName,
                    participantId: uId,
                    role: uRole,
                    userId: uId,
                    photoURL: uPhotoURL,
                    displayIcon: uDisplayIcon,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                setToken(data.token);
            }
        } catch (error) {
            console.error('Failed to pre-warm token:', error);
        } finally {
            isFetchingToken.current = false;
        }
    }, [token]);

    const leaveClass = useCallback(() => {
        if (liveKitRoom) {
            try {
                liveKitRoom.disconnect();
            } catch (e) {
                console.error('Error disconnecting from LiveKit room:', e);
            }
        }
        setSessionId(null);
        setTitle(null);
        setUserName(null);
        setUserRole(null);
        setUserId(null);
        setParticipants([]);
        setLiveKitRoomState(null);
        setSessionData(null);
        setIsMini(false);
        setIsFloating(false);
        setIsChatOpen(false);
        setUnreadChatCount(0);
        setToken(null);
        setPhotoURL(null);
        setDisplayIcon(null);
        if (typeof window !== 'undefined') {
            try {
                if (document.pictureInPictureElement) document.exitPictureInPicture();
            } catch (pipError) {
                console.log('No PiP element to exit:', pipError);
            }
        }
    }, [liveKitRoom]);

    const toggleMini = useCallback((mini: boolean) => setIsMini(mini), []);
    const toggleFloating = useCallback((floating: boolean) => {
        setIsFloating(floating);
        if (floating) setIsMini(true);
    }, []);
    const toggleMinimize = useCallback((minimize: boolean) => {
        setIsMini(minimize);
        setIsFloating(minimize);
    }, []);

    const isHost = sessionData?.hostId === userId || sessionData?.lecturerId === userId;
    const isCoHost = coHosts.some(ch => ch.userId === userId);
    const isModerator = isHost || isCoHost || sessionData?.backupModId === userId || userRole === 'admin';

    useEffect(() => {
        if (!sessionId) {
            setCoHosts([]);
            return;
        }
        const unsub = subscribeToCoHosts(sessionId, setCoHosts);
        return () => unsub();
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId || !userId) return;
        const heartbeatInterval = setInterval(async () => {
            const now = serverTimestamp();
            try {
                const participantRef = doc(db, 'sessions', sessionId, 'participants', userId);
                await setDoc(participantRef, {
                    userId,
                    userName: userName || 'Anonymous',
                    lastHeartbeat: now,
                    isOnline: true,
                }, { merge: true });
            } catch (err) {
                console.error('[Classroom:Heartbeat:Participant] Failed:', err);
            }
            if (isHost || isModerator) {
                try {
                    const sessionRef = doc(db, 'sessions', sessionId);
                    const updateField = isHost ? 'hostLastSeen' : 'modLastSeen';
                    await updateDoc(sessionRef, { [updateField]: now });
                } catch (err) {
                    console.error('[Classroom:Heartbeat:Session] Failed:', err);
                }
            }
        }, 30000);
        return () => clearInterval(heartbeatInterval);
    }, [sessionId, userId, isHost, isModerator]);

    useEffect(() => {
        if (!sessionId) return;
        const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Session;
                setSessionData(data);
                
                const userIsHost = data.hostId === userId || data.lecturerId === userId;
                const userIsCoHost = coHosts.some(ch => ch.userId === userId);
                const userIsModerator = userIsHost || userIsCoHost || data.backupModId === userId || userRole === 'admin';
                
                const isSessionEndedOrDeleted = data.status === 'deleted' || data.isDeleted || data.status === 'ended';
                const isInactiveForStudent = data.isActive === false && !userIsModerator;
                
                if (isSessionEndedOrDeleted || isInactiveForStudent) {
                    if (sessionId === docSnap.id) {
                        const wasAlreadyDeleted = (window as any)._podium_session_deleted;
                        if (!wasAlreadyDeleted) {
                            (window as any)._podium_session_deleted = true;
                            const message = (data.status === 'ended' || data.isActive === false) 
                                ? 'This class has been ended by the host.' 
                                : 'This class has been deleted.';
                            
                            showAlert(message, 'warning').then(() => {
                                leaveClass();
                                router.push('/dashboard.html');
                                (window as any)._podium_session_deleted = false;
                            });
                        }
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [sessionId, router, showAlert, leaveClass, userId, userRole, coHosts]);

    useEffect(() => {
        if (!liveKitRoom || !sessionData) return;
        const handleInitialMic = async () => {
            // Priority 1: Mute All (Global Room State)
            if (sessionData.isMutedAll && !isModerator) {
                if (liveKitRoom.localParticipant.isMicrophoneEnabled) {
                    console.log('[ClassroomContext] Forcing initial mute due to isMutedAll');
                    await liveKitRoom.localParticipant.setMicrophoneEnabled(false);
                }
                return;
            }

            // Priority 2: User Preference (One-time join setting)
            if (!(window as any)._podium_joined_mic_set) {
                (window as any)._podium_joined_mic_set = true;
                const shouldEnable = joinMicEnabled; // Default to user choice
                console.log(`[ClassroomContext] Setting initial mic state to: ${shouldEnable}`);
                await liveKitRoom.localParticipant.setMicrophoneEnabled(shouldEnable);
            }
        };
        handleInitialMic();
    }, [liveKitRoom, sessionData?.isMutedAll, isModerator, joinMicEnabled]);

    useEffect(() => {
        if (!sessionId) (window as any)._podium_joined_mic_set = false;
    }, [sessionId]);

    const muteParticipant = useCallback((participantId: string) => {
        if (liveKitRoom && isModerator) {
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({ type: 'mute_request', targetId: participantId })),
                { reliable: true }
            );
        }
    }, [liveKitRoom, isModerator]);

    const disableParticipantVideo = useCallback((participantId: string) => {
        if (liveKitRoom && isModerator) {
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({ type: 'disable_video_request', targetId: participantId })),
                { reliable: true }
            );
        }
    }, [liveKitRoom, isModerator]);

    const muteAllParticipants = useCallback(async () => {
        if (liveKitRoom && isModerator && sessionId) {
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({ type: 'mute_all_request' })),
                { reliable: true }
            );
            try {
                await updateDoc(doc(db, 'sessions', sessionId), { isMutedAll: true });
            } catch (err) {
                console.error('Failed to persist Mute All state:', err);
            }
        }
    }, [liveKitRoom, isModerator, sessionId]);

    const kickParticipant = useCallback((participantId: string) => {
        if (liveKitRoom && isModerator) {
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({ type: 'kick_request', targetId: participantId })),
                { reliable: true }
            );
        }
    }, [liveKitRoom, isModerator]);

    const askToUnmute = useCallback((participantId: string) => {
        if (liveKitRoom && isModerator) {
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({ type: 'unmute_request', targetId: participantId })),
                { reliable: true }
            );
        }
    }, [liveKitRoom, isModerator]);

    const grantModerator = useCallback(async (participantId: string) => {
        if (liveKitRoom && isHost) {
            const participant = participants.find(p => p.participantId === participantId);
            if (!participant || !sessionId) return;
            const targetUserId = participant.metadata?.userId;
            if (!targetUserId) return;
            try {
                await setDoc(doc(db, 'sessions', sessionId), { backupModId: targetUserId }, { merge: true });
                showAlert(`Assigned ${participant.displayName} as Backup Moderator`, 'success');
            } catch (err) {
                console.error('Failed to grant moderator:', err);
            }
        }
    }, [liveKitRoom, isHost, participants, sessionId, showAlert]);

    const assignCoHost = useCallback(async (targetUserId: string, targetUserName: string) => {
        if (!sessionId || !userId || !isHost) return;
        try {
            const res = await fetch('/api/moderators/assign-cohost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, hostUserId: userId, targetUserId, targetUserName }),
            });
            const data = await res.json();
            if (data.success && liveKitRoom) {
                const encoder = new TextEncoder();
                liveKitRoom.localParticipant.publishData(encoder.encode(JSON.stringify({ type: 'COHOST_ASSIGNED', coHostId: targetUserId })), { reliable: true });
                showAlert(`${targetUserName} is now a co-host`, 'success');
            }
        } catch (err) {
            console.error('Failed to assign co-host:', err);
        }
    }, [sessionId, userId, isHost, liveKitRoom, showAlert]);

    const removeCoHost = useCallback(async (coHostUserId: string) => {
        if (!sessionId || !userId || !isHost) return;
        try {
            const res = await fetch('/api/moderators/remove-cohost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, hostUserId: userId, coHostUserId }),
            });
            const data = await res.json();
            if (data.success && liveKitRoom) {
                const encoder = new TextEncoder();
                liveKitRoom.localParticipant.publishData(encoder.encode(JSON.stringify({ type: 'COHOST_REMOVED', coHostId: coHostUserId })), { reliable: true });
                showAlert('Co-host removed', 'success');
            }
        } catch (err) {
            console.error('Failed to remove co-host:', err);
        }
    }, [sessionId, userId, isHost, liveKitRoom, showAlert]);

    const toggleChat = useCallback(() => {
        setIsChatOpen(prev => {
            if (!prev) setUnreadChatCount(0);
            return !prev;
        });
    }, []);

    const sendMessage = useCallback(async (content: string) => {
        if (!liveKitRoom || !userName || !content.trim()) return;
        const messageData = {
            type: 'chat',
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content,
            senderId: userId,
            senderName: userName,
            senderRole: userRole,
            senderPhotoURL: photoURL,
            senderDisplayIcon: displayIcon,
            createdAt: Date.now()
        };
        try {
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(encoder.encode(JSON.stringify(messageData)), { reliable: true });
        } catch (e) {
            console.warn('[ClassroomChat] WebRTC publish failed', e);
        }
        setLiveMessages(prev => [...prev, messageData]);
        try {
            await addDoc(collection(db, `sessions/${sessionId}/messages`), { ...messageData, createdAt: serverTimestamp() });
        } catch (e) {
            console.error('[ClassroomChat] Failed to sync to Firestore:', e);
        }
    }, [liveKitRoom, userName, userRole, userId, sessionId, photoURL, displayIcon]);

    useEffect(() => {
        if (isChatOpen) setUnreadChatCount(0);
    }, [isChatOpen]);

    useEffect(() => {
        if (!sessionId) return;
        const isClassroomPage = pathname === `/classroom/${sessionId}`;
        if (!isClassroomPage) {
            if (!isMini && !isFloating) leaveClass();
        } else if (isMini) {
            setIsMini(false);
        }
    }, [pathname, sessionId, isMini, isFloating, leaveClass]);

    useEffect(() => {
        if (!liveKitRoom) return;
        const updateParticipants = () => {
            const allParticipants: LiveKitParticipant[] = [];
            const localParticipant = liveKitRoom.localParticipant;
            if (localParticipant) {
                const metadata = localParticipant.metadata ? JSON.parse(localParticipant.metadata) : {};
                allParticipants.push({
                    participantId: localParticipant.sid,
                    identity: localParticipant.identity,
                    displayName: localParticipant.name || localParticipant.identity,
                    role: metadata.role === 'lecturer' ? 'moderator' : 'participant',
                    isLocal: true,
                    audioMuted: !localParticipant.isMicrophoneEnabled,
                    videoMuted: !localParticipant.isCameraEnabled,
                    isSpeaking: localParticipant.isSpeaking,
                    metadata,
                });
            }
            liveKitRoom.remoteParticipants.forEach((participant) => {
                const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
                allParticipants.push({
                    participantId: participant.sid,
                    identity: participant.identity,
                    displayName: participant.name || participant.identity,
                    role: metadata.role === 'lecturer' ? 'moderator' : 'participant',
                    isLocal: false,
                    audioMuted: !participant.isMicrophoneEnabled,
                    videoMuted: !participant.isCameraEnabled,
                    isSpeaking: participant.isSpeaking,
                    metadata,
                });
            });
            setParticipants(allParticipants);
        };
        updateParticipants();
        liveKitRoom.on(RoomEvent.Connected, updateParticipants);
        liveKitRoom.on(RoomEvent.Reconnected, updateParticipants);
        liveKitRoom.on(RoomEvent.ParticipantConnected, updateParticipants);
        liveKitRoom.on(RoomEvent.ParticipantDisconnected, updateParticipants);
        liveKitRoom.on(RoomEvent.TrackMuted, updateParticipants);
        liveKitRoom.on(RoomEvent.TrackUnmuted, updateParticipants);
        liveKitRoom.on(RoomEvent.LocalTrackPublished, updateParticipants);
        liveKitRoom.on(RoomEvent.LocalTrackUnpublished, updateParticipants);
        liveKitRoom.on(RoomEvent.ParticipantMetadataChanged, updateParticipants);
        liveKitRoom.on(RoomEvent.ActiveSpeakersChanged, updateParticipants);
        const handleDataReceived = (payload: Uint8Array, participant?: RemoteParticipant) => {
            try {
                const decoder = new TextDecoder();
                const strData = decoder.decode(payload);
                const data = JSON.parse(strData);
                const senderMetadata = participant?.metadata ? JSON.parse(participant?.metadata) : {};
                const isMod = senderMetadata.role === 'lecturer';
                if (!isMod && data.type !== 'chat') return;
                if (data.type === 'mute_request' && data.targetId === liveKitRoom.localParticipant.sid) {
                    liveKitRoom.localParticipant.setMicrophoneEnabled(false);
                    showAlert('You have been muted by the lecturer.', 'info');
                }
                if (data.type === 'disable_video_request' && data.targetId === liveKitRoom.localParticipant.sid) {
                    liveKitRoom.localParticipant.setCameraEnabled(false);
                    showAlert('Your video has been turned off by the lecturer.', 'info');
                }
                if (data.type === 'mute_all_request' && isMod) {
                    liveKitRoom.localParticipant.setMicrophoneEnabled(false);
                    showAlert('A moderator has muted everyone.', 'info');
                }
                if (data.type === 'unmute_request' && data.targetId === liveKitRoom.localParticipant.sid) {
                    showConfirm('The lecturer is asking you to unmute your microphone. Allow?', () => {
                        liveKitRoom.localParticipant.setMicrophoneEnabled(true);
                    }, 'Unmute Request');
                }
                if (data.type === 'kick_request' && data.targetId === liveKitRoom.localParticipant.sid) {
                    showAlert('You have been removed from the class by the lecturer.', 'warning').then(() => leaveClass());
                }
                if (data.type === 'chat') {
                    setLiveMessages(prev => {
                        if (prev.some(m => m.id === data.id)) return prev;
                        return [...prev, { ...data, isRemote: true }];
                    });
                    if (!isChatOpen) setUnreadChatCount(prev => prev + 1);
                }
            } catch (e) {
                console.error('Failed to parse data message', e);
            }
        };
        liveKitRoom.on(RoomEvent.DataReceived, handleDataReceived);
        return () => {
            liveKitRoom.off(RoomEvent.Connected, updateParticipants);
            liveKitRoom.off(RoomEvent.Reconnected, updateParticipants);
            liveKitRoom.off(RoomEvent.ParticipantConnected, updateParticipants);
            liveKitRoom.off(RoomEvent.ParticipantDisconnected, updateParticipants);
            liveKitRoom.off(RoomEvent.TrackMuted, updateParticipants);
            liveKitRoom.off(RoomEvent.TrackUnmuted, updateParticipants);
            liveKitRoom.off(RoomEvent.LocalTrackPublished, updateParticipants);
            liveKitRoom.off(RoomEvent.LocalTrackUnpublished, updateParticipants);
            liveKitRoom.off(RoomEvent.ParticipantMetadataChanged, updateParticipants);
            liveKitRoom.off(RoomEvent.ActiveSpeakersChanged, updateParticipants);
            liveKitRoom.off(RoomEvent.DataReceived, handleDataReceived);
        };
    }, [liveKitRoom, userRole, leaveClass, isChatOpen, showAlert, showConfirm]);

    useEffect(() => {
        if (!sessionId) {
            setUnreadChatCount(0);
            return;
        }
        const q = query(collection(db, `sessions/${sessionId}/messages`), orderBy('createdAt', 'asc'));
        let initialLoad = true;
        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            if (initialLoad) {
                initialLoad = false;
                return;
            }
            snapshot.docChanges().forEach((change: any) => {
                if (change.type === 'added') {
                    const data = change.doc.data() as any;
                    setLiveMessages(prev => {
                        if (prev.some(m => m.id === data.id)) return prev;
                        return [...prev, data].sort((a, b) => {
                            const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
                            const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
                            return timeA - timeB;
                        });
                    });
                    if (data.senderId !== userId && !isChatOpen) setUnreadChatCount(prev => prev + 1);
                }
            });
        });
        return () => unsubscribe();
    }, [sessionId, userId, isChatOpen]);

    useEffect(() => {
        if (!sessionId || userRole !== 'lecturer' || liveMessages.length === 0) return;
        const syncInterval = setInterval(async () => {
            try {
                await setDoc(doc(db, `sessions/${sessionId}/chat_history`, 'transcript'), {
                    messages: liveMessages,
                    lastUpdatedAt: serverTimestamp(),
                    sessionTitle: title
                }, { merge: true });
            } catch (err) {
                console.error('[Classroom:PeriodicSync] Failed:', err);
            }
        }, 5 * 60 * 1000);
        return () => clearInterval(syncInterval);
    }, [sessionId, userRole, liveMessages.length, liveMessages, title]);

    useEffect(() => {
        if (!sessionId || liveMessages.length > 0) return;
        const restoreHistory = async () => {
            const historyRef = doc(db, `sessions/${sessionId}/chat_history`, 'transcript');
            onSnapshot(historyRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.messages && data.messages.length > 0) {
                        setLiveMessages(prev => {
                            const historyMessages = data.messages.map((m: any) => ({ ...m, isRemote: true }));
                            const messageMap = new Map();
                            historyMessages.forEach((m: any) => messageMap.set(m.id, m));
                            prev.forEach(m => messageMap.set(m.id, m));
                            return Array.from(messageMap.values()).sort((a, b) => {
                                const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
                                const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
                                return timeA - timeB;
                            });
                        });
                    }
                }
            });
        };
        restoreHistory();
    }, [sessionId]);

    const stateValue = useMemo<ClassroomState>(() => ({
        sessionId, title, userName, userRole, userId, isModerator, isHost, isCoHost, sessionData,
        photoURL, displayIcon, isMini, isActive: !!sessionId, isFloating, isChatOpen,
        unreadChatCount, participants, liveKitRoom, token, coHosts, liveMessages, layout, joinMicEnabled
    }), [
        sessionId, title, userName, userRole, userId, isModerator, isHost, isCoHost, sessionData,
        photoURL, displayIcon, isMini, isFloating, isChatOpen, unreadChatCount, participants,
        liveKitRoom, token, coHosts, liveMessages, layout, joinMicEnabled
    ]);

    const actionsValue = useMemo<ClassroomActions>(() => ({
        joinClass, leaveClass, toggleMini, toggleFloating, toggleMinimize, setLiveKitRoom,
        setJitsiApi, setToken, preWarmToken, muteParticipant, disableParticipantVideo,
        muteAllParticipants, kickParticipant, askToUnmute, grantModerator, assignCoHost,
        removeCoHost, sendMessage, toggleChat, setLayout
    }), [
        joinClass, leaveClass, toggleMini, toggleFloating, toggleMinimize, setLiveKitRoom,
        setJitsiApi, preWarmToken, muteParticipant, disableParticipantVideo,
        muteAllParticipants, kickParticipant, askToUnmute, grantModerator, assignCoHost,
        removeCoHost, sendMessage, toggleChat, setLayout
    ]);

    return (
        <ClassroomStateContext.Provider value={stateValue}>
            <ClassroomActionsContext.Provider value={actionsValue}>
                {children}
            </ClassroomActionsContext.Provider>
        </ClassroomStateContext.Provider>
    );
}

export function useClassroom() {
    const state = useContext(ClassroomStateContext);
    const actions = useContext(ClassroomActionsContext);
    if (!state || !actions) throw new Error('useClassroom must be used within ClassroomProvider');
    return { ...state, ...actions };
}

export function useClassroomState() {
    const context = useContext(ClassroomStateContext);
    if (!context) throw new Error('useClassroomState must be used within ClassroomProvider');
    return context;
}

export function useClassroomActions() {
    const context = useContext(ClassroomActionsContext);
    if (!context) throw new Error('useClassroomActions must be used within ClassroomProvider');
    return context;
}

