'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
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

interface ClassroomContextType {
    sessionId: string | null;
    title: string | null;
    userName: string | null;
    userRole: 'student' | 'lecturer' | 'admin' | null;
    userId: string | null;
    isModerator: boolean;
    isHost: boolean;
    sessionData: any | null;
    photoURL: string | null;
    displayIcon: string | null;
    isMini: boolean;
    isActive: boolean;
    isFloating: boolean;
    isChatOpen?: boolean;
    unreadChatCount: number;
    participants: LiveKitParticipant[];
    liveKitRoom: Room | null;
    joinMicEnabled: boolean;
    // Keep old name for backward compatibility
    jitsiApi: Room | null;
    joinClass: (sessionId: string, title: string, userName: string, userRole: 'student' | 'lecturer' | 'admin', userId?: string, photoURL?: string, displayIcon?: string, joinMicEnabled?: boolean) => void;
    leaveClass: () => void;
    toggleMini: (isMini: boolean) => void;
    toggleFloating: (floating: boolean) => void;
    toggleMinimize: (minimize: boolean) => void;
    setLiveKitRoom: (room: Room | null) => void;
    // Keep old name for backward compatibility
    setJitsiApi: (api: any) => void;
    // Moderation functions
    muteParticipant: (participantId: string) => void;
    disableParticipantVideo: (participantId: string) => void;
    muteAllParticipants: () => void;
    kickParticipant: (participantId: string) => void;
    askToUnmute: (participantId: string) => void;
    grantModerator: (participantId: string) => void;
    coHosts: CoHost[];
    isCoHost: boolean;
    assignCoHost: (targetUserId: string, targetUserName: string) => Promise<void>;
    removeCoHost: (coHostUserId: string) => Promise<void>;
    liveMessages: any[];
    sendMessage: (content: string) => void;
    // Chat functions
    toggleChat: () => void;
    // Layout functions
    layout: GridLayout;
    setLayout: (layout: GridLayout) => void;
    // Token pre-warming
    token: string | null;
    setToken: (token: string | null) => void;
    preWarmToken: (sessionId: string, userName: string, userRole: string, userId: string, photoURL?: string, displayIcon?: string) => Promise<void>;
}

const ClassroomContext = createContext<ClassroomContextType | undefined>(undefined);

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

    // Backward compatibility
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
        setSessionData(null); // Reset session data
        setIsMini(false);
        setIsChatOpen(false);
        setUnreadChatCount(0);
        // If we don't have a token, it will be fetched in GlobalClassroom
        // but if we do (from pre-warming), it's already there
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
            console.log('Pre-warming LiveKit token...');
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
                console.log('Token pre-warmed successfully');
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

        // Reset state
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

        // Exit PiP if active
        if (typeof window !== 'undefined') {
            try {
                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture();
                }
            } catch (pipError) {
                console.log('No PiP element to exit:', pipError);
            }
        }
    }, [liveKitRoom]);

    const toggleMini = useCallback((mini: boolean) => {
        setIsMini(mini);
    }, []);

    const toggleFloating = useCallback((floating: boolean) => {
        setIsFloating(floating);
        if (floating) {
            setIsMini(true);
        }
    }, []);

    const toggleMinimize = useCallback((minimize: boolean) => {
        setIsMini(minimize);
        setIsFloating(minimize);
    }, []);

    // Derived Permission States
    const isHost = sessionData?.hostId === userId || sessionData?.lecturerId === userId;
    const isCoHost = coHosts.some(ch => ch.userId === userId);
    const isModerator = isHost || isCoHost || sessionData?.backupModId === userId || userRole === 'admin';

    // Real-time co-host subscription
    useEffect(() => {
        if (!sessionId) {
            setCoHosts([]);
            return;
        }
        const unsub = subscribeToCoHosts(sessionId, setCoHosts);
        return () => unsub();
    }, [sessionId]);

    // Heartbeat & Presence Logic (Unified)
    useEffect(() => {
        if (!sessionId || !userId) return;

        const heartbeatInterval = setInterval(async () => {
            const now = serverTimestamp();

            // 1. Update Participant Heartbeat (Spec Requirement)
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

            // 2. Update Moderator Master Heartbeats
            if (isHost || isModerator) {
                try {
                    const sessionRef = doc(db, 'sessions', sessionId);
                    const updateField = isHost ? 'hostLastSeen' : 'modLastSeen';

                    // Construct the update object to satisfy Firestore rules
                    const updates: any = {
                        [updateField]: now
                    };

                    await updateDoc(sessionRef, updates);
                } catch (err) {
                    console.error('[Classroom:Heartbeat:Session] Failed:', err);
                }
            }
        }, 30000); // 30 seconds as per spec

        return () => clearInterval(heartbeatInterval);
    }, [sessionId, userId, isHost, isModerator, sessionData?.status]);

    // Listen to Session Data & Manage Auto-Alert (Client-Side Sentinel)
    useEffect(() => {
        if (!sessionId) return;

        const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Session;
                setSessionData(data);

                // --- Detect session deletion: eject all participants ---
                if (data.status === 'deleted' || data.isDeleted) {
                    console.log('🗑️ Session deleted — ejecting participant');

                    // Only show alert and redirect if we are currently in this session
                    if (sessionId === docSnap.id) {
                        // Use a flag to prevent multiple alerts
                        const wasAlreadyDeleted = (window as any)._podium_session_deleted;
                        if (!wasAlreadyDeleted) {
                            (window as any)._podium_session_deleted = true;

                            showAlert('This class has been ended by the host.', 'warning').then(() => {
                                leaveClass();
                                router.push('/dashboard');
                                (window as any)._podium_session_deleted = false;
                            });
                        }
                    }
                    return;
                }

            }
        });

        return () => unsubscribe();
    }, [sessionId, isHost, isModerator]);

    // Handle initial join mic preference & persistent lockdown
    useEffect(() => {
        if (!liveKitRoom || !sessionData) return;

        const handleInitialMic = async () => {
            // Priority 1: Persistent Lockdown (Mute All)
            if (sessionData.isMutedAll && !isModerator) {
                if (liveKitRoom.localParticipant.isMicrophoneEnabled) {
                    console.log('🔇 [Lockdown] Muting local participant due to global lockdown');
                    await liveKitRoom.localParticipant.setMicrophoneEnabled(false);
                }
                return;
            }

            // Priority 2: Individual Join Preference (Only on first connection)
            // We use a ref to ensure this only runs once per session join
            if (!(window as any)._podium_joined_mic_set) {
                (window as any)._podium_joined_mic_set = true;
                if (!joinMicEnabled && !isModerator) {
                    console.log('🔇 [Preference] Muting local participant by join choice');
                    await liveKitRoom.localParticipant.setMicrophoneEnabled(false);
                }
            }
        };

        handleInitialMic();
    }, [liveKitRoom, sessionData?.isMutedAll, isModerator, joinMicEnabled]);

    // Clear the joined_mic_set flag on leave
    useEffect(() => {
        if (!sessionId) {
            (window as any)._podium_joined_mic_set = false;
        }
    }, [sessionId]);

    // Moderation functions using LiveKit API
    const muteParticipant = useCallback((participantId: string) => {
        if (liveKitRoom && isModerator) {
            const participant = Array.from(liveKitRoom.remoteParticipants.values()).find(
                (p) => p.sid === participantId
            );
            if (participant) {
                // In LiveKit, muting remote participants requires server-side action
                // We'll use the data channel to send a mute request
                const encoder = new TextEncoder();
                liveKitRoom.localParticipant.publishData(
                    encoder.encode(JSON.stringify({
                        type: 'mute_request',
                        targetId: participantId,
                    })),
                    { reliable: true }
                );
                console.log('Mute request sent to:', participantId);
            }
        }
    }, [liveKitRoom, isModerator]);

    const disableParticipantVideo = useCallback((participantId: string) => {
        if (liveKitRoom && isModerator) {
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({
                    type: 'disable_video_request',
                    targetId: participantId,
                })),
                { reliable: true }
            );
            console.log('Disable video request sent to:', participantId);
        }
    }, [liveKitRoom, isModerator]);

    const muteAllParticipants = useCallback(async () => {
        if (liveKitRoom && isModerator && sessionId) {
            // 1. Send real-time signal
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({
                    type: 'mute_all_request',
                })),
                { reliable: true }
            );
            console.log('Mute all request sent');

            // 2. Persist to Firestore (Lockdown Mode)
            try {
                await updateDoc(doc(db, 'sessions', sessionId), {
                    isMutedAll: true
                });
            } catch (err) {
                console.error('Failed to persist Mute All state:', err);
            }
        }
    }, [liveKitRoom, isModerator, sessionId]);

    const kickParticipant = useCallback((participantId: string) => {
        if (liveKitRoom && isModerator) {
            // Kicking requires server-side API call
            // For now, we'll use data channel to notify
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({
                    type: 'kick_request',
                    targetId: participantId,
                })),
                { reliable: true }
            );
            console.log('Kick request sent for:', participantId);

            // TODO: Implement server-side kick via API
            // This would require calling a backend API that uses livekit-server-sdk
        }
    }, [liveKitRoom, isModerator]);

    const askToUnmute = useCallback((participantId: string) => {
        if (liveKitRoom && isModerator) {
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({
                    type: 'unmute_request',
                    targetId: participantId,
                })),
                { reliable: true }
            );
            console.log('Unmute request sent to:', participantId);
        }
    }, [liveKitRoom, isModerator]);

    const grantModerator = useCallback(async (participantId: string) => {
        if (liveKitRoom && isHost) {
            // Granting moderator (Backup Mod)
            const participant = participants.find(p => p.participantId === participantId);
            if (!participant || !sessionId) return;

            const targetUserId = participant.metadata?.userId;
            if (!targetUserId) return;

            try {
                await setDoc(doc(db, 'sessions', sessionId), {
                    backupModId: targetUserId
                }, { merge: true });
                showAlert(`Assigned ${participant.displayName} as Backup Moderator`, 'success');
            } catch (err) {
                console.error('Failed to grant moderator:', err);
                showAlert('Failed to assign backup moderator', 'error');
            }
        }
    }, [liveKitRoom, isHost, participants, sessionId, showAlert]);

    const assignCoHost = useCallback(async (targetUserId: string, targetUserName: string) => {
        if (!sessionId || !userId || !isHost) {
            showAlert('Only the host can assign co-hosts', 'error');
            return;
        }
        try {
            const res = await fetch('/api/moderators/assign-cohost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, hostUserId: userId, targetUserId, targetUserName }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            // Broadcast over LiveKit data channel so everyone refreshes instantly
            if (liveKitRoom) {
                const encoder = new TextEncoder();
                liveKitRoom.localParticipant.publishData(
                    encoder.encode(JSON.stringify({ type: 'COHOST_ASSIGNED', coHostId: targetUserId })),
                    { reliable: true }
                );
            }
            showAlert(`${targetUserName} is now a co-host`, 'success');
        } catch (err: any) {
            console.error('Failed to assign co-host:', err);
            showAlert(err.message || 'Failed to assign co-host', 'error');
        }
    }, [sessionId, userId, isHost, liveKitRoom, showAlert]);

    const removeCoHost = useCallback(async (coHostUserId: string) => {
        if (!sessionId || !userId || !isHost) {
            showAlert('Only the host can remove co-hosts', 'error');
            return;
        }
        try {
            const res = await fetch('/api/moderators/remove-cohost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, hostUserId: userId, coHostUserId }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            // Broadcast over LiveKit data channel
            if (liveKitRoom) {
                const encoder = new TextEncoder();
                liveKitRoom.localParticipant.publishData(
                    encoder.encode(JSON.stringify({ type: 'COHOST_REMOVED', coHostId: coHostUserId })),
                    { reliable: true }
                );
            }
            showAlert('Co-host removed', 'success');
        } catch (err: any) {
            console.error('Failed to remove co-host:', err);
            showAlert(err.message || 'Failed to remove co-host', 'error');
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
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // More unique ID
            content,
            senderId: userId,
            senderName: userName,
            senderRole: userRole,
            senderPhotoURL: photoURL,
            senderDisplayIcon: displayIcon,
            createdAt: Date.now()
        };

        try {
            // Send via WebRTC Data Channel for immediate delivery (low latency)
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify(messageData)),
                { reliable: true } // Ensures complete packet delivery
            );
        } catch (e) {
            console.warn('[ClassroomChat] WebRTC publish failed, falling back to Firestore', e);
        }

        // Add to local state immediately for instant feedback
        setLiveMessages(prev => [...prev, messageData]);

        // Push to Firestore for persistence and reliable delivery to those who missed the UDP packet
        try {
            await addDoc(collection(db, `sessions/${sessionId}/messages`), {
                ...messageData,
                createdAt: serverTimestamp() // Overwrite with server time
            });
        } catch (e) {
            console.error('[ClassroomChat] Failed to sync message to Firestore:', e);
        }
    }, [liveKitRoom, userName, userRole, userId, sessionId, photoURL, displayIcon]);

    // Also reset unread count if becomes open through other means
    useEffect(() => {
        if (isChatOpen) {
            setUnreadChatCount(0);
        }
    }, [isChatOpen]);

    // Auto-detect mini mode based on route
    useEffect(() => {
        if (!sessionId) return;

        const isClassroomPage = pathname === `/classroom/${sessionId}`;

        if (!isClassroomPage) {
            // User navigated away from the classroom
            if (!isMini && !isFloating) {
                // If not already in mini/floating mode, interpret navigation as "Leave Class"
                leaveClass();
            }
            // If isMini/isFloating is true, we respect the user's intent to multitask and keep it open
        } else {
            // User returned to the classroom page
            if (isMini) {
                setIsMini(false);
            }
        }
    }, [pathname, sessionId, isMini, isFloating, leaveClass]);

    // Listen to LiveKit participant events
    // Moved here to avoid "leaveClass used before initialization" error
    useEffect(() => {
        if (!liveKitRoom) return;

        const updateParticipants = () => {
            const allParticipants: LiveKitParticipant[] = [];

            // Add local participant
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

            // Add remote participants
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

        // Initial load
        updateParticipants();

        // Listen for participant changes
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

        // Listen for data messages (Moderation)
        const handleDataReceived = (payload: Uint8Array, participant?: RemoteParticipant) => {
            try {
                const decoder = new TextDecoder();
                const strData = decoder.decode(payload);
                const data = JSON.parse(strData);

                // Verify sender is a moderator/lecturer
                // Note: In production, verify this via signed tokens or server-side validation
                // For now, we trust the role in metadata if available
                const senderMetadata = participant?.metadata ? JSON.parse(participant?.metadata) : {};
                const isModerator = senderMetadata.role === 'lecturer';

                if (!isModerator) return;

                console.log('Received moderation command:', data, 'from', participant?.identity);

                if (data.type === 'mute_request' && data.targetId === liveKitRoom.localParticipant.sid) {
                    // Lecturer requested to mute me
                    console.log('Lecturer muted my audio/video');
                    liveKitRoom.localParticipant.setMicrophoneEnabled(false);
                    // Optional: mute video too if desired, usually just audio is forced
                    // liveKitRoom.localParticipant.setCameraEnabled(false);
                    showAlert('You have been muted by the lecturer.', 'info');
                }

                if (data.type === 'disable_video_request' && data.targetId === liveKitRoom.localParticipant.sid) {
                    // Lecturer requested to disable my video
                    console.log('Lecturer disabled my video');
                    liveKitRoom.localParticipant.setCameraEnabled(false);
                    showAlert('Your video has been turned off by the lecturer.', 'info');
                }

                if (data.type === 'mute_all_request') {
                    // Everyone except moderator gets muted
                    // Check if I am NOT a moderator
                    if (!isModerator) {
                        console.log('Moderator muted everyone');
                        liveKitRoom.localParticipant.setMicrophoneEnabled(false);
                        showAlert('A moderator has muted everyone.', 'info');
                    }
                }

                if (data.type === 'unmute_request' && data.targetId === liveKitRoom.localParticipant.sid) {
                    // Lecturer asked me to unmute
                    showConfirm('The lecturer is asking you to unmute your microphone. Allow?', () => {
                        liveKitRoom.localParticipant.setMicrophoneEnabled(true);
                    }, 'Unmute Request');
                }

                if (data.type === 'kick_request' && data.targetId === liveKitRoom.localParticipant.sid) {
                    // Lecturer kicked me
                    console.log('Lecturer kicked me out');
                    showAlert('You have been removed from the class by the lecturer.', 'warning').then(() => {
                        leaveClass();
                    });
                }

                if (data.type === 'chat') {
                    setLiveMessages(prev => {
                        // Strict check to prevent duplication from multiple paths (WebRTC vs Firestore)
                        if (prev.some(m => m.id === data.id)) return prev;
                        return [...prev, { ...data, isRemote: true }];
                    });
                    if (!isChatOpen) {
                        setUnreadChatCount(prev => prev + 1);
                    }
                }

            } catch (e) {
                console.error('Failed to parse data message', e);
            }
        };

        liveKitRoom.on(RoomEvent.DataReceived, handleDataReceived);

        return () => {
            liveKitRoom.off(RoomEvent.ParticipantConnected, updateParticipants);
            liveKitRoom.off(RoomEvent.ParticipantDisconnected, updateParticipants);
            liveKitRoom.off(RoomEvent.TrackMuted, updateParticipants);
            liveKitRoom.off(RoomEvent.TrackUnmuted, updateParticipants);
            liveKitRoom.off(RoomEvent.ParticipantMetadataChanged, updateParticipants);
            liveKitRoom.off(RoomEvent.ActiveSpeakersChanged, updateParticipants);
            liveKitRoom.off(RoomEvent.DataReceived, handleDataReceived);
        };
    }, [liveKitRoom, userRole, leaveClass]);

    // Global Message Listener for Notifications
    useEffect(() => {
        if (!sessionId || !db) {
            setUnreadChatCount(0);
            return;
        }

        // Listen for RECENT messages to keep sync while live
        const q = query(
            collection(db, `sessions/${sessionId}/messages`),
            orderBy('createdAt', 'asc') // Use ASC to get latest ones in order
        );

        let initialLoad = true;
        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            if (initialLoad) {
                initialLoad = false;
                return;
            }

            snapshot.docChanges().forEach((change: any) => {
                if (change.type === 'added') {
                    const data = change.doc.data() as any;

                    // Ensure message is added to UI if WebRTC UDP packet dropped
                    setLiveMessages(prev => {
                        if (prev.some(m => m.id === data.id)) return prev;
                        // Always keep the list sorted when merging from Firestore
                        const newList = [...prev, data];
                        return newList.sort((a, b) => {
                            const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
                            const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
                            return timeA - timeB;
                        });
                    });

                    // Update notification badge
                    if (data.senderId !== userId && !isChatOpen && !initialLoad) {
                        setUnreadChatCount(prev => prev + 1);
                    }
                }
            });
        }, (error) => {
            console.error('[Classroom:Messages] Error listening for new messages:', error);
        });

        return () => unsubscribe();
    }, [sessionId, userId, isChatOpen]);

    // Smart Chat Persistence: Snapshotting
    useEffect(() => {
        if (!sessionId || userRole !== 'lecturer' || liveMessages.length === 0) return;

        // Sync to Firestore every 5 minutes or on meaningful message count changes
        const syncInterval = setInterval(async () => {
            console.log('🔄 [ClassroomContext] Periodic chat snapshot sync starting...');
            try {
                // We store the current liveMessages as a snapshot
                // This allows late joiners to fetch the entire history in one read
                await setDoc(doc(db, `sessions/${sessionId}/chat_history`, 'transcript'), {
                    messages: liveMessages,
                    lastUpdatedAt: serverTimestamp(),
                    sessionTitle: title
                }, { merge: true });
                console.log('✅ [ClassroomContext] Chat snapshot saved to Firestore');
            } catch (err) {
                console.error('[Classroom:PeriodicSync] Periodic sync failed:', err);
            }
        }, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(syncInterval);
    }, [sessionId, userRole, liveMessages.length, liveMessages, title]);

    // Restore chat history for late joiners
    useEffect(() => {
        if (!sessionId || liveMessages.length > 0) return;

        const restoreHistory = async () => {
            try {
                console.log('📖 [ClassroomContext] Checking for chat history snapshot...');
                const historyRef = doc(db, `sessions/${sessionId}/chat_history`, 'transcript');
                onSnapshot(historyRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.messages && data.messages.length > 0) {
                            console.log('✅ [ClassroomContext] Syncing chat history from snapshot...');

                            setLiveMessages(prev => {
                                const historyMessages = data.messages.map((m: any) => ({ ...m, isRemote: true }));
                                // Create a Map by ID to ensure uniqueness and fast lookup
                                const messageMap = new Map();

                                // Add history first
                                historyMessages.forEach((m: any) => messageMap.set(m.id, m));
                                // Add current live messages (allowing them to overwrite history if same ID, as they might be fresher)
                                prev.forEach(m => messageMap.set(m.id, m));

                                // Convert back to array and sort by createdAt
                                return Array.from(messageMap.values()).sort((a, b) => {
                                    const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
                                    const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
                                    return timeA - timeB;
                                });
                            });
                        }
                    }
                }, (error) => {
                    console.error('[Classroom:Transcript:Error] Error restoring chat history snapshot:', error);
                });
            } catch (err) {
                console.error('[Classroom:RestoreHistory] Failed to restore history:', err);
            }
        };

        restoreHistory();
    }, [sessionId]); // Removed liveMessages.length check to allow live updates to transcript if needed

    const contextValue = React.useMemo(() => ({
        sessionId,
        title,
        userName,
        userRole,
        userId,
        isModerator,
        isHost,
        sessionData,
        photoURL,
        displayIcon,
        joinMicEnabled,
        isMini,
        isFloating,
        isChatOpen,
        unreadChatCount,
        isActive: !!sessionId,
        participants,
        liveKitRoom,
        jitsiApi: liveKitRoom,
        joinClass,
        leaveClass,
        toggleMini,
        toggleFloating,
        toggleMinimize,
        setLiveKitRoom,
        setJitsiApi,
        setToken,
        token,
        preWarmToken,
        muteParticipant,
        disableParticipantVideo,
        muteAllParticipants,
        kickParticipant,
        askToUnmute,
        grantModerator,
        coHosts,
        isCoHost,
        assignCoHost,
        removeCoHost,
        toggleChat,
        liveMessages,
        sendMessage,
        layout,
        setLayout,
    }), [
        sessionId, title, userName, userRole, userId, isModerator, isHost, sessionData, photoURL, displayIcon, isMini, isFloating,
        isChatOpen, unreadChatCount, participants, liveKitRoom,
        joinClass, leaveClass, toggleMini, toggleFloating, toggleMinimize,
        setLiveKitRoom, muteParticipant, disableParticipantVideo, muteAllParticipants, kickParticipant,
        askToUnmute, grantModerator, coHosts, isCoHost, assignCoHost, removeCoHost,
        toggleChat, layout, token, preWarmToken
    ]);

    return (
        <ClassroomContext.Provider value={contextValue}>
            {children}
        </ClassroomContext.Provider>
    );
}

export function useClassroom() {
    const context = useContext(ClassroomContext);
    if (context === undefined) {
        throw new Error('useClassroom must be used within a ClassroomProvider');
    }
    return context;
}
