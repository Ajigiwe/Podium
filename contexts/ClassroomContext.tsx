'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Room, RemoteParticipant, LocalParticipant, Participant, RoomEvent, Track } from 'livekit-client';
import { useAlert } from '@/contexts/AlertContext';
import { GridLayout } from '@/types/layout';
import { db } from '@/lib/firebase/config';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp, setDoc, doc, updateDoc } from 'firebase/firestore';

import { Session } from '@/lib/firebase/types';

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
    isMini: boolean;
    isActive: boolean;
    isFloating: boolean;
    isChatOpen?: boolean;
    unreadChatCount: number;
    participants: LiveKitParticipant[];
    liveKitRoom: Room | null;
    // Keep old name for backward compatibility
    jitsiApi: Room | null;
    joinClass: (sessionId: string, title: string, userName: string, userRole: 'student' | 'lecturer' | 'admin', userId?: string, photoURL?: string) => void;
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
    preWarmToken: (sessionId: string, userName: string, userRole: string, userId: string, photoURL?: string) => Promise<void>;
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
    const [isMini, setIsMini] = useState(false);
    const [isFloating, setIsFloating] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [liveMessages, setLiveMessages] = useState<any[]>([]);
    const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);
    const [liveKitRoom, setLiveKitRoomState] = useState<Room | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [layout, setLayout] = useState<GridLayout>('4x4');
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
        newPhotoURL?: string
    ) => {
        setSessionId(newSessionId);
        setTitle(newTitle);
        setUserName(newUserName);
        setUserRole(newUserRole);
        setUserId(newUserId || null);
        setPhotoURL(newPhotoURL || null);
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
        uPhotoURL?: string
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
    const isModerator = isHost || sessionData?.backupModId === userId || userRole === 'admin';

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

                    if (sessionData?.status === 'paused') {
                        updates.status = 'active';
                        updates.auto_alert_triggered = false;
                        updates.auto_alert_triggered_at = null;
                    }

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

                // Auto-Alert Logic (Triggered by Host/Mod absence > host_absence_minutes)
                if (isHost || isModerator) return; // Moderators don't trigger alerts on themselves

                const absenceLimit = (data.host_absence_minutes || 5) * 60 * 1000;
                const now = Date.now();
                const hostLastSeen = data.hostLastSeen?.toMillis() || 0;
                const modLastSeen = data.modLastSeen?.toMillis() || 0;

                const isHostOffline = !hostLastSeen || (now - hostLastSeen > absenceLimit);
                const isModOffline = !modLastSeen || (now - modLastSeen > absenceLimit);

                if (isHostOffline && isModOffline && data.status !== 'paused' && !data.auto_alert_triggered) {
                    console.log('🚨 Sentinel: Triggering auto-alert due to moderator absence');
                    try {
                        await updateDoc(doc(db, 'sessions', sessionId), {
                            status: 'paused',
                            auto_alert_triggered: true,
                            auto_alert_triggered_at: serverTimestamp()
                        });
                    } catch (e: any) {
                        if (e?.code === 'permission-denied') {
                            console.warn('[Classroom:Sentinel] Permission denied for pause update - likely already handled or restricted.');
                        } else {
                            console.error('[Classroom:Sentinel] Error triggering alert:', e);
                        }
                    }
                }
            }
        });

        return () => unsubscribe();
    }, [sessionId, isHost, isModerator]);

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
    }, [liveKitRoom, userRole]);

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
    }, [liveKitRoom, userRole]);

    const muteAllParticipants = useCallback(() => {
        if (liveKitRoom && isModerator) {
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({
                    type: 'mute_all_request',
                })),
                { reliable: true }
            );
            console.log('Mute all request sent');
        }
    }, [liveKitRoom, isModerator]);

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
            id: Date.now().toString(),
            content,
            senderId: userId,
            senderName: userName,
            senderRole: userRole,
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
    }, [liveKitRoom, userName, userRole, userId, sessionId]);

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
                    const message = {
                        ...data,
                        isRemote: true
                    };
                    setLiveMessages(prev => [...prev, message]);
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

        // We only want to listen for NEW messages
        // Since we don't have a reliable "last read" timestamp easily available here
        // without more complex sync, we'll listen for additions to the collection.
        const q = query(
            collection(db, `sessions/${sessionId}/messages`),
            orderBy('createdAt', 'desc'),
            limit(1)
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
                        return [...prev, data];
                    });

                    // Update notification badge
                    if (data.senderId !== userId && !isChatOpen) {
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
                    if (docSnap.exists() && liveMessages.length === 0) {
                        const data = docSnap.data();
                        if (data.messages && data.messages.length > 0) {
                            console.log('✅ [ClassroomContext] Restored chat history from snapshot');
                            setLiveMessages(data.messages.map((m: any) => ({ ...m, isRemote: true })));
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
        toggleChat,
        liveMessages,
        sendMessage,
        layout,
        setLayout,
    }), [
        sessionId, title, userName, userRole, userId, isModerator, isHost, sessionData, photoURL, isMini, isFloating,
        isChatOpen, unreadChatCount, participants, liveKitRoom,
        joinClass, leaveClass, toggleMini, toggleFloating, toggleMinimize,
        setLiveKitRoom, muteParticipant, disableParticipantVideo, muteAllParticipants, kickParticipant,
        askToUnmute, grantModerator, toggleChat, layout, token, preWarmToken
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
