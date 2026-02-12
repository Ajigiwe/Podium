// components/NetworkQualityIndicator.tsx
import { useEffect, useState } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { ConnectionQuality, ConnectionState } from 'livekit-client';
import { Wifi, WifiOff } from 'lucide-react';

export const NetworkQualityIndicator = () => {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    const [quality, setQuality] = useState<ConnectionQuality>(ConnectionQuality.Excellent);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const connectionState = room?.state || ConnectionState.Disconnected;
    const isLost = !isOnline || connectionState === ConnectionState.Disconnected || connectionState === ConnectionState.Reconnecting;

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (!localParticipant) return;

        const handleQualityChange = (newQuality: ConnectionQuality) => {
            setQuality(newQuality);

            if (newQuality === ConnectionQuality.Poor) {
                console.warn('⚠️ Poor network quality detected');
            }
        };

        localParticipant.on('connectionQualityChanged', handleQualityChange);

        return () => {
            localParticipant.off('connectionQualityChanged', handleQualityChange);
        };
    }, [localParticipant]);

    const getQualityColor = () => {
        if (isLost) return 'text-red-500';
        switch (quality) {
            case ConnectionQuality.Excellent:
                return 'text-green-500';
            case ConnectionQuality.Good:
                return 'text-blue-500';
            case ConnectionQuality.Poor:
                return 'text-yellow-500';
            case ConnectionQuality.Lost:
                return 'text-red-500';
            default:
                return 'text-gray-500';
        }
    };

    const getQualityText = () => {
        if (connectionState === ConnectionState.Disconnected) return 'Disconnected';
        if (connectionState === ConnectionState.Reconnecting) return 'Lost';

        switch (quality) {
            case ConnectionQuality.Excellent:
                return 'Excellent';
            case ConnectionQuality.Good:
                return 'Good';
            case ConnectionQuality.Poor:
                return 'Poor';
            case ConnectionQuality.Lost:
                return 'Lost';
            default:
                return 'Unknown';
        }
    };

    return (
        <div className="fixed top-20 left-4 z-[100]">
            <div className={`bg-gray-900/90 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2 border ${isLost ? 'border-red-500/50' : 'border-white/10'}`}>
                {isLost ? <WifiOff className={`w-4 h-4 ${getQualityColor()}`} /> : <Wifi className={`w-4 h-4 ${getQualityColor()}`} />}
                <span className="text-white text-[10px] font-bold uppercase tracking-wider">{getQualityText()}</span>
            </div>
        </div>
    );
};
