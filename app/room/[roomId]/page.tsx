'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Session } from '@/lib/firebase/types';
import ClassroomContent from '@/components/ClassroomContent';
import { useClassroom } from '@/contexts/ClassroomContext';
import { Skeleton } from '@/components/ui/Skeleton';
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
                    joinClass(roomId, sessionData.title, profile.fullName, profile.role, user.uid, profile.photoURL);
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
            <div className="min-h-screen bg-gray-950 p-8 space-y-8">
                <div className="max-w-7xl mx-auto">
                    <div className="h-10 w-48 bg-gray-800 rounded-lg mb-12 animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[600px]">
                        <Skeleton className="h-full w-full rounded-2xl bg-gray-800" />
                        <Skeleton className="h-full w-full rounded-2xl bg-gray-800" />
                    </div>
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
