// hooks/useAutoReconnect.ts
import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

export const useAutoReconnect = (url: string, token: string, maxAttempts = 5) => {
    const room = useRoomContext();
    let reconnectAttempts = 0;

    useEffect(() => {
        if (!room || !url || !token) return;

        const handleDisconnect = async () => {
            if (room.state !== ConnectionState.Disconnected) return;
            console.log('Disconnected from room, initiating auto-reconnect...');

            // Wait before attempting reconnect
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Try to reconnect
            while (reconnectAttempts < maxAttempts && (room.state as any) !== ConnectionState.Connected) {
                try {
                    console.log(`Reconnect attempt ${reconnectAttempts + 1}/${maxAttempts}`);

                    await room.connect(url, token);

                    console.log('✅ Reconnected successfully');
                    reconnectAttempts = 0;
                    break;

                } catch (error) {
                    console.error('Reconnect failed:', error);
                    reconnectAttempts++;

                    if (reconnectAttempts < maxAttempts) {
                        // Exponential backoff
                        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } else {
                        console.error('Max reconnect attempts reached');
                        // We can't really do an alert here easily if it blocks execution, 
                        // but we can log it. The UI should show the Disconnected state.
                    }
                }
            }
        };

        room.on('disconnected', handleDisconnect);

        return () => {
            room.off('disconnected', handleDisconnect);
        };
    }, [room, url, token, maxAttempts]);
};
