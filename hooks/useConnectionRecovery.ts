// hooks/useConnectionRecovery.ts
import { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

/**
 * useConnectionRecovery
 * 
 * Simple hook to monitor and report the current LiveKit connection state.
 * Media restoration is handled by useMediaPersistence.
 */
export const useConnectionRecovery = () => {
    const room = useRoomContext();
    const [connectionState, setConnectionState] = useState<ConnectionState>(
        ConnectionState.Connected
    );

    useEffect(() => {
        if (!room) return;

        const handleConnectionStateChange = (state: ConnectionState) => {
            setConnectionState(state);
        };

        room.on('connectionStateChanged', handleConnectionStateChange);

        return () => {
            room.off('connectionStateChanged', handleConnectionStateChange);
        };
    }, [room]);

    return {
        connectionState,
        // Derived from connectionState instead of a ref. Reading a ref during render
        // meant consumers never re-rendered when recovery started or stopped.
        isRecovering: connectionState === ConnectionState.Reconnecting,
    };
};
