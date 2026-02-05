'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Room, RemoteParticipant, LocalParticipant, Participant, RoomEvent, Track } from 'livekit-client';

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
    };
}

// Keep old name for backward compatibility
export type JitsiParticipant = LiveKitParticipant;

interface ClassroomContextType {
    sessionId: string | null;
    title: string | null;
    userName: string | null;
    userRole: 'student' | 'lecturer' | null;
    userId: string | null;
    isMini: boolean;
    isActive: boolean;
    isFloating: boolean;
    isChatOpen?: boolean; // Added optional flag
    participants: LiveKitParticipant[];
    liveKitRoom: Room | null;
    // Keep old name for backward compatibility
    jitsiApi: Room | null;
    joinClass: (sessionId: string, title: string, userName: string, userRole: 'student' | 'lecturer', userId?: string) => void;
    leaveClass: () => void;
    toggleMini: (isMini: boolean) => void;
    toggleFloating: (floating: boolean) => void;
    toggleMinimize: (minimize: boolean) => void;
    setLiveKitRoom: (room: Room | null) => void;
    // Keep old name for backward compatibility
    setJitsiApi: (api: any) => void;
    // Moderation functions
    muteParticipant: (participantId: string) => void;
    muteAllParticipants: () => void;
    kickParticipant: (participantId: string) => void;
    askToUnmute: (participantId: string) => void;
    grantModerator: (participantId: string) => void;
    // Chat functions
    toggleChat: () => void;
}

const ClassroomContext = createContext<ClassroomContextType | undefined>(undefined);

export function ClassroomProvider({ children }: { children: ReactNode }) {
    console.log('ClassroomProvider initializing...');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [title, setTitle] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<'student' | 'lecturer' | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isMini, setIsMini] = useState(false);
    const [isFloating, setIsFloating] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);
    const [liveKitRoom, setLiveKitRoomState] = useState<Room | null>(null);

    const router = useRouter();
    const pathname = usePathname();

    // Auto-detect mini mode based on route
    useEffect(() => {
        if (sessionId && pathname !== `/classroom/${sessionId}` && !isMini) {
            setIsMini(true);
        } else if (pathname === `/classroom/${sessionId}`) {
            if (!isMini) {
                setIsMini(false);
            }
        }
    }, [pathname, sessionId]);



    const setLiveKitRoom = useCallback((room: Room | null) => {
        setLiveKitRoomState(room);
    }, []);

    // Backward compatibility
    const setJitsiApi = setLiveKitRoom;

    const joinClass = useCallback((
        newSessionId: string,
        newTitle: string,
        newUserName: string,
        newUserRole: 'student' | 'lecturer',
        newUserId?: string
    ) => {
        setSessionId(newSessionId);
        setTitle(newTitle);
        setUserName(newUserName);
        setUserRole(newUserRole);
        setUserId(newUserId || null);
        setIsMini(false);
        setIsChatOpen(false);
    }, []);

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
        setIsChatOpen(prev => !prev);
    }, []);

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
        liveKitRoom.on(RoomEvent.ParticipantConnected, updateParticipants);
        liveKitRoom.on(RoomEvent.ParticipantDisconnected, updateParticipants);
        liveKitRoom.on(RoomEvent.TrackMuted, updateParticipants);
        liveKitRoom.on(RoomEvent.TrackUnmuted, updateParticipants);
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
                    alert('You have been muted by the lecturer.');
                }

                if (data.type === 'mute_all_request') {
                    // Everyone except lecturer gets muted
                    // Check if I am NOT the lecturer
                    if (userRole !== 'lecturer') {
                        console.log('Lecturer muted everyone');
                        liveKitRoom.localParticipant.setMicrophoneEnabled(false);
                        alert('The lecturer has muted everyone.');
                    }
                }

                if (data.type === 'unmute_request' && data.targetId === liveKitRoom.localParticipant.sid) {
                    // Lecturer asked me to unmute
                    const shouldUnmute = confirm('The lecturer is asking you to unmute your microphone. Allow?');
                    if (shouldUnmute) {
                        liveKitRoom.localParticipant.setMicrophoneEnabled(true);
                    }
                }

                if (data.type === 'kick_request' && data.targetId === liveKitRoom.localParticipant.sid) {
                    // Lecturer kicked me
                    console.log('Lecturer kicked me out');
                    alert('You have been removed from the class by the lecturer.');
                    leaveClass();
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

    return (
        <ClassroomContext.Provider value={{
            sessionId,
            title,
            userName,
            userRole,
            userId,
            isMini,
            isFloating,
            isChatOpen, // Added to context
            isActive: !!sessionId,
            participants,
            liveKitRoom,
            jitsiApi: liveKitRoom, // Backward compatibility
            joinClass,
            leaveClass,
            toggleMini,
            toggleFloating,
            toggleMinimize,
            setLiveKitRoom,
            setJitsiApi, // Backward compatibility
            muteParticipant,
            muteAllParticipants,
            kickParticipant,
            askToUnmute,
            grantModerator,
            toggleChat,
        }}>
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
