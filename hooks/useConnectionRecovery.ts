// hooks/useConnectionRecovery.ts
import { useEffect, useState, useRef } from 'react';
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
    const isRecoveringRef = useRef(false);

    useEffect(() => {
        if (!room) return;

        const handleConnectionStateChange = (state: ConnectionState) => {
            setConnectionState(state);

            if (state === ConnectionState.Reconnecting) {
                isRecoveringRef.current = true;
            }

            if (state === ConnectionState.Connected) {
                isRecoveringRef.current = false;
            }
        };

        room.on('connectionStateChanged', handleConnectionStateChange);

        return () => {
            room.off('connectionStateChanged', handleConnectionStateChange);
        };
    }, [room]);

    return {
        connectionState,
        isRecovering: isRecoveringRef.current,
    };
};
