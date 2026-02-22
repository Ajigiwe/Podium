'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Room, RemoteParticipant, LocalParticipant, Participant, RoomEvent, Track } from 'livekit-client';
import { useAlert } from '@/contexts/AlertContext';
import { GridLayout } from '@/types/layout';
import { db } from '@/lib/firebase/config';
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';

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

    // Moderation functions using LiveKit API
    const muteParticipant = useCallback((participantId: string) => {
        if (liveKitRoom && userRole === 'lecturer') {
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
        if (liveKitRoom && userRole === 'lecturer') {
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
        if (liveKitRoom && userRole === 'lecturer') {
            const encoder = new TextEncoder();
            liveKitRoom.localParticipant.publishData(
                encoder.encode(JSON.stringify({
                    type: 'mute_all_request',
                })),
                { reliable: true }
            );
            console.log('Mute all request sent');
        }
    }, [liveKitRoom, userRole]);

    const kickParticipant = useCallback((participantId: string) => {
        if (liveKitRoom && userRole === 'lecturer') {
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
    }, [liveKitRoom, userRole]);

    const askToUnmute = useCallback((participantId: string) => {
        if (liveKitRoom && userRole === 'lecturer') {
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
    }, [liveKitRoom, userRole]);

    const grantModerator = useCallback((participantId: string) => {
        if (liveKitRoom && userRole === 'lecturer') {
            // Granting moderator requires updating participant metadata via server
            console.log('Grant moderator requested for:', participantId);
            // TODO: Implement via server-side API
        }
    }, [liveKitRoom, userRole]);

    const toggleChat = useCallback(() => {
        setIsChatOpen(prev => {
            if (!prev) setUnreadChatCount(0);
            return !prev;
        });
    }, []);

    const sendMessage = useCallback((content: string) => {
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

        const encoder = new TextEncoder();
        liveKitRoom.localParticipant.publishData(
            encoder.encode(JSON.stringify(messageData)),
            { reliable: true }
        );

        // Add to local state immediately
        setLiveMessages(prev => [...prev, messageData]);
    }, [liveKitRoom, userName, userRole, userId]);

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
                    // Everyone except lecturer gets muted
                    // Check if I am NOT the lecturer
                    if (userRole !== 'lecturer') {
                        console.log('Lecturer muted everyone');
                        liveKitRoom.localParticipant.setMicrophoneEnabled(false);
                        showAlert('The lecturer has muted everyone.', 'info');
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
                    const data = change.doc.data();
                    // Don't notify for own messages
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
    }, [sessionId]); // Run once when sessionId is available

    const contextValue = React.useMemo(() => ({
        sessionId,
        title,
        userName,
        userRole,
        userId,
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
        sessionId, title, userName, userRole, userId, photoURL, isMini, isFloating,
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
