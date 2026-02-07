import { useRoomContext } from '@livekit/components-react';
import { useState, useCallback, useEffect } from 'react';
import { DataPacket_Kind, RoomEvent, Participant } from 'livekit-client';
import { RaisedHand } from '@/types/layout';

export const useRaisedHands = () => {
    const room = useRoomContext();
    const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);

    // Handle incoming data
    useEffect(() => {
        if (!room) return;

        const handleData = (payload: Uint8Array, participant?: Participant, kind?: DataPacket_Kind, topic?: string) => {
            if (topic !== 'raise-hand') return;

            try {
                const data = JSON.parse(new TextDecoder().decode(payload));

                if (data.type === 'HAND_RAISED') {
                    setRaisedHands(prev => {
                        if (prev.some(h => h.participantId === data.participantId)) return prev;
                        return [...prev, {
                            participantId: data.participantId,
                            participantName: data.participantName,
                            timestamp: data.timestamp
                        }];
                    });
                } else if (data.type === 'HAND_LOWERED') {
                    setRaisedHands(prev => prev.filter(h => h.participantId !== data.participantId));
                } else if (data.type === 'CLEAR_ALL_HANDS') {
                    setRaisedHands([]);
                }
            } catch (error) {
                console.error('Error parsing raise hand message:', error);
            }
        };

        room.on(RoomEvent.DataReceived, handleData);
        return () => {
            room.off(RoomEvent.DataReceived, handleData);
        };
    }, [room]);

    const broadcast = useCallback(async (data: any) => {
        if (!room || !room.localParticipant) return;

        try {
            const encoder = new TextEncoder();
            const payload = encoder.encode(JSON.stringify(data));

            await room.localParticipant.publishData(payload, {
                reliable: true,
                topic: 'raise-hand'
            });
        } catch (error) {
            console.error('Error broadcasting raise hand signal:', error);
        }
    }, [room]);

    const raiseHand = useCallback((participantId: string, participantName: string) => {
        const timestamp = Date.now();
        broadcast({
            type: 'HAND_RAISED',
            participantId,
            participantName,
            timestamp
        });

        // Optimistic update
        setRaisedHands(prev => {
            if (prev.some(h => h.participantId === participantId)) return prev;
            return [...prev, {
                participantId,
                participantName,
                timestamp
            }];
        });
    }, [broadcast]);

    const lowerHand = useCallback((participantId: string) => {
        broadcast({
            type: 'HAND_LOWERED',
            participantId
        });

        setRaisedHands(prev => prev.filter(h => h.participantId !== participantId));
    }, [broadcast]);

    const clearAllHands = useCallback(() => {
        broadcast({
            type: 'CLEAR_ALL_HANDS'
        });
        setRaisedHands([]);
    }, [broadcast]);

    return {
        raisedHands,
        raiseHand,
        lowerHand,
        clearAllHands
    };
};
