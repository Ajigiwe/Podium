'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Jitsi participant type
export interface JitsiParticipant {
    participantId: string;
    displayName: string;
    formattedDisplayName?: string;
    avatarURL?: string;
    role?: string;
    isLocal?: boolean;
    audioMuted?: boolean;
    videoMuted?: boolean;
}

interface ClassroomContextType {
    sessionId: string | null;
    title: string | null;
    userName: string | null;
    userRole: 'student' | 'lecturer' | null;
    isMini: boolean;
    isActive: boolean;
    isFloating: boolean;
    participants: JitsiParticipant[];
    jitsiApi: any;
    joinClass: (sessionId: string, title: string, userName: string, userRole: 'student' | 'lecturer') => void;
    leaveClass: () => void;
    toggleMini: (isMini: boolean) => void;
    toggleFloating: (floating: boolean) => void;
    setJitsiApi: (api: any) => void;
    // Moderation functions
    muteParticipant: (participantId: string) => void;
    muteAllParticipants: () => void;
    kickParticipant: (participantId: string) => void;
    askToUnmute: (participantId: string) => void;
    grantModerator: (participantId: string) => void;
}

const ClassroomContext = createContext<ClassroomContextType | undefined>(undefined);

export function ClassroomProvider({ children }: { children: ReactNode }) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [title, setTitle] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<'student' | 'lecturer' | null>(null);
    const [isMini, setIsMini] = useState(false);
    const [isFloating, setIsFloating] = useState(false);
    const [participants, setParticipants] = useState<JitsiParticipant[]>([]);
    const [jitsiApi, setJitsiApiState] = useState<any>(null);

    const router = useRouter();
    const pathname = usePathname();

    // Auto-detect mini mode based on route
    useEffect(() => {
        if (sessionId && pathname !== `/classroom/${sessionId}`) {
            setIsMini(true);
        } else {
            setIsMini(false);
        }
    }, [pathname, sessionId]);

    // Listen to Jitsi participant events
    useEffect(() => {
        if (!jitsiApi) return;

        const updateParticipants = () => {
            try {
                const participantInfo = jitsiApi.getParticipantsInfo();
                if (participantInfo && Array.isArray(participantInfo)) {
                    setParticipants(participantInfo.map((p: any) => ({
                        participantId: p.participantId,
                        displayName: p.displayName || 'Guest',
                        formattedDisplayName: p.formattedDisplayName,
                        avatarURL: p.avatarURL,
                        role: p.role,
                        isLocal: p.isLocal,
                        audioMuted: false, // Will be updated by mute events
                        videoMuted: false,
                    })));
                }
            } catch (e) {
                console.error('Error getting participants:', e);
            }
        };

        // Initial load
        updateParticipants();

        // Listen for participant changes
        jitsiApi.addListener('participantJoined', updateParticipants);
        jitsiApi.addListener('participantLeft', updateParticipants);
        jitsiApi.addListener('participantRoleChanged', updateParticipants);
        
        // Listen for mute status changes
        jitsiApi.addListener('audioMuteStatusChanged', (event: any) => {
            setParticipants(prev => prev.map(p => 
                p.isLocal ? { ...p, audioMuted: event.muted } : p
            ));
        });
        
        jitsiApi.addListener('videoMuteStatusChanged', (event: any) => {
            setParticipants(prev => prev.map(p => 
                p.isLocal ? { ...p, videoMuted: event.muted } : p
            ));
        });

        return () => {
            try {
                jitsiApi.removeListener('participantJoined', updateParticipants);
                jitsiApi.removeListener('participantLeft', updateParticipants);
                jitsiApi.removeListener('participantRoleChanged', updateParticipants);
            } catch (e) {
                // API might be disposed
            }
        };
    }, [jitsiApi]);

    const setJitsiApi = useCallback((api: any) => {
        setJitsiApiState(api);
    }, []);

    const joinClass = (newSessionId: string, newTitle: string, newUserName: string, newUserRole: 'student' | 'lecturer') => {
        setSessionId(newSessionId);
        setTitle(newTitle);
        setUserName(newUserName);
        setUserRole(newUserRole);
        setIsMini(false);
    };

    const leaveClass = () => {
        if (jitsiApi) {
            try {
                jitsiApi.executeCommand('hangup');
            } catch (e) {
                // Ignore errors
            }
        }
        setSessionId(null);
        setTitle(null);
        setUserName(null);
        setUserRole(null);
        setParticipants([]);
        setJitsiApiState(null);
        setIsMini(false);
        setIsFloating(false);
    };

    const toggleMini = (mini: boolean) => {
        setIsMini(mini);
        if (!mini && sessionId) {
            router.push(`/classroom/${sessionId}`);
        } else if (mini && pathname.startsWith('/classroom/')) {
            router.push('/');
        }
    };

    const toggleFloating = (floating: boolean) => {
        setIsFloating(floating);
    };

    // Moderation functions using Jitsi IFrame API
    const muteParticipant = useCallback((participantId: string) => {
        if (jitsiApi) {
            try {
                jitsiApi.executeCommand('muteEveryone', 'audio', participantId);
            } catch (e) {
                console.error('Error muting participant:', e);
            }
        }
    }, [jitsiApi]);

    const muteAllParticipants = useCallback(() => {
        if (jitsiApi) {
            try {
                jitsiApi.executeCommand('muteEveryone', 'audio');
            } catch (e) {
                console.error('Error muting all:', e);
            }
        }
    }, [jitsiApi]);

    const kickParticipant = useCallback((participantId: string) => {
        if (jitsiApi) {
            try {
                jitsiApi.executeCommand('kickParticipant', participantId);
            } catch (e) {
                console.error('Error kicking participant:', e);
            }
        }
    }, [jitsiApi]);

    const askToUnmute = useCallback((participantId: string) => {
        if (jitsiApi) {
            try {
                jitsiApi.executeCommand('askToUnmute', participantId);
            } catch (e) {
                console.error('Error asking to unmute:', e);
            }
        }
    }, [jitsiApi]);

    const grantModerator = useCallback((participantId: string) => {
        if (jitsiApi) {
            try {
                jitsiApi.executeCommand('grantModerator', participantId);
            } catch (e) {
                console.error('Error granting moderator:', e);
            }
        }
    }, [jitsiApi]);

    return (
        <ClassroomContext.Provider value={{
            sessionId,
            title,
            userName,
            userRole,
            isMini,
            isFloating,
            isActive: !!sessionId,
            participants,
            jitsiApi,
            joinClass,
            leaveClass,
            toggleMini,
            toggleFloating,
            setJitsiApi,
            muteParticipant,
            muteAllParticipants,
            kickParticipant,
            askToUnmute,
            grantModerator,
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
