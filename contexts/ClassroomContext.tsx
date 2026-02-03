'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Participant } from 'livekit-client';

interface ClassroomContextType {
    sessionId: string | null;
    token: string | null;
    title: string | null;
    isMini: boolean;
    participants: Participant[];
    isActive: boolean; // True if connected/connecting
    joinClass: (sessionId: string, token: string, title?: string) => void;
    leaveClass: () => void;
    setParticipants: (participants: Participant[]) => void;
    toggleMini: (isMini: boolean) => void;
}

const ClassroomContext = createContext<ClassroomContextType | undefined>(undefined);

export function ClassroomProvider({ children }: { children: ReactNode }) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [title, setTitle] = useState<string | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isMini, setIsMini] = useState(false);

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

    const joinClass = (newSessionId: string, newToken: string, newTitle?: string) => {
        setSessionId(newSessionId);
        setToken(newToken);
        if (newTitle) setTitle(newTitle);
        setIsMini(false);
    };

    const leaveClass = () => {
        setSessionId(null);
        setToken(null);
        setTitle(null);
        setParticipants([]);
        setIsMini(false);
    };

    const toggleMini = (mini: boolean) => {
        setIsMini(mini);
        if (!mini && sessionId) {
            router.push(`/classroom/${sessionId}`);
        } else if (mini && pathname.startsWith('/classroom/')) {
            router.push('/');
        }
    };

    return (
        <ClassroomContext.Provider value={{
            sessionId,
            token,
            title,
            isMini,
            participants,
            isActive: !!token,
            joinClass,
            leaveClass,
            setParticipants,
            toggleMini
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
