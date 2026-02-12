// components/ConnectionStatus.tsx
import { useConnectionRecovery } from '@/hooks/useConnectionRecovery';
import { ConnectionState } from 'livekit-client';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

export const ConnectionRecoveryStatus = () => {
    const { connectionState, isRecovering } = useConnectionRecovery();

    if (connectionState === ConnectionState.Connected && !isRecovering) {
        return null; // Don't show anything when connection is good
    }

    return (
        <div className="fixed top-20 right-4 z-[100]">
            {connectionState === ConnectionState.Reconnecting && (
                <div className="bg-yellow-500 text-black px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <div>
                        <p className="font-semibold">Reconnecting...</p>
                        <p className="text-xs">Please wait, restoring connection</p>
                    </div>
                </div>
            )}

            {connectionState === ConnectionState.Disconnected && (
                <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
                    <WifiOff className="w-5 h-5" />
                    <div>
                        <p className="font-semibold">Connection Lost</p>
                        <p className="text-xs">Attempting to reconnect...</p>
                    </div>
                </div>
            )}

            {isRecovering && connectionState === ConnectionState.Connected && (
                <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <div>
                        <p className="font-semibold">Recovering Tracks</p>
                        <p className="text-xs">Restoring audio and video...</p>
                    </div>
                </div>
            )}
        </div>
    );
};
