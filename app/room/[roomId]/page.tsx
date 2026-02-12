'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Session } from '@/lib/firebase/types';
import ClassroomContent from '@/components/ClassroomContent';
import { useClassroom } from '@/contexts/ClassroomContext';
import { useAlert } from '@/contexts/AlertContext';

export default function RoomPage() {
    const params = useParams();
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const { joinClass, sessionId: currentSessionId } = useClassroom();
    const { showAlert } = useAlert();
    const roomId = params.roomId as string;

    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;

        if (!user || !profile) {
            const currentPath = window.location.pathname + window.location.search;
            router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
            return;
        }

        const loadSession = async () => {
            try {
                const sessionDoc = await getDoc(doc(db, 'sessions', roomId));
                if (!sessionDoc.exists()) {
                    showAlert('Session not found', 'error');
                    router.push('/');
                    return;
                }

                const sessionData = { id: sessionDoc.id, ...sessionDoc.data() } as Session;
                setSession(sessionData);

                // Join the LiveKit room via context
                if (currentSessionId !== roomId) {
                    joinClass(roomId, sessionData.title, profile.fullName, profile.role, user.uid);
                }

                setLoading(false);
            } catch (error) {
                console.error('Error loading session:', error);
                showAlert('Failed to load session', 'error');
                router.push('/');
            }
        };

        loadSession();
    }, [user, profile, roomId, router, authLoading, currentSessionId, joinClass]);

    if (loading || !session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600/30 border-t-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-400">Entering room...</p>
                </div>
            </div>
        );
    }

    return (
        <ClassroomContent
            session={session}
            user={user}
            profile={profile}
            sessionId={roomId}
        />
    );
}
