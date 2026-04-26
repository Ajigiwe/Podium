'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { useAuth } from '@/contexts/AuthContext';
import { useClassroom } from '@/contexts/ClassroomContext';

interface VerificationPayload {
    verificationId: string;
    verificationNumber: number;
    expiresAt: number;
    timeLimitSeconds: number;
}

export const useAttendanceVerification = (sessionId: string) => {
    const room = useRoomContext();
    const { user, profile } = useAuth();
    const { userRole, isHost } = useClassroom();
    const [activeVerification, setActiveVerification] = useState<VerificationPayload | null>(null);
    const [isResponding, setIsResponding] = useState(false);
    const [isJoined, setIsJoined] = useState(false);

    const joinAttendance = useCallback(async () => {
        if (!sessionId || !user || isHost || isJoined) return;

        try {
            const response = await fetch('/api/attendance/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    studentId: user.uid,
                    studentName: profile?.fullName || 'Student',
                    studentIndexNumber: profile?.indexNumber || ''
                })
            });

            if (response.ok) {
                console.log('Successfully joined attendance tracking');
                setIsJoined(true);
            }
        } catch (error) {
            console.error('Error joining attendance:', error);
        }
    }, [sessionId, user, profile, isJoined]);

    // Join when room is connected and role is student
    useEffect(() => {
        if (room?.state === 'connected' && !isHost) {
            joinAttendance();
        }
    }, [room?.state, userRole, joinAttendance]);

    const handleDataReceived = useCallback((payload: Uint8Array, participant: any) => {
        try {
            const decoder = new TextDecoder();
            const data = JSON.parse(decoder.decode(payload));

            if (data.type === 'VERIFICATION_TRIGGERED' && !isHost) {
                console.log('Attendance verification triggered:', data.payload);
                setActiveVerification(data.payload);

                // Play notification sound
                try {
                    const audio = new Audio('/sounds/notification.mp3');
                    audio.play().catch(e => console.warn('Could not play notification sound:', e));
                } catch (e) { }
            }
        } catch (error) {
            console.error('Error parsing attendance data message:', error);
        }
    }, [profile?.role]);

    useEffect(() => {
        if (!room) return;

        room.on(RoomEvent.DataReceived, handleDataReceived);
        return () => {
            room.off(RoomEvent.DataReceived, handleDataReceived);
        };
    }, [room, handleDataReceived]);

    const respondToVerification = async (): Promise<boolean> => {
        if (!activeVerification || !user || isResponding) return false;

        setIsResponding(true);
        try {
            const response = await fetch('/api/attendance/verification/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    verificationId: activeVerification.verificationId,
                    studentId: user.uid
                })
            });

            if (response.ok) {
                // Return true so UI can show success state
                return true;
            } else {
                const error = await response.json();
                console.error('Failed to respond to verification:', error);
                return false;
            }
        } catch (error) {
            console.error('Error responding to verification:', error);
            return false;
        } finally {
            setIsResponding(false);
        }
    };

    return {
        activeVerification,
        respondToVerification,
        isResponding,
        dismissVerification: () => setActiveVerification(null)
    };
};
