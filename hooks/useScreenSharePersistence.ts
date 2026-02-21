import { useEffect, useRef } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';

// Helper to show a UI notification when screen share restores
function showScreenShareRestoreNotification() {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-xl z-[9999] animate-in slide-in-from-top-4 flex items-center gap-2';
    notification.innerHTML = `
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12zm-1-5h2v2H9v-2zm0-6h2v4H9V5z"/>
      </svg>
      <span class="font-medium text-sm">Screen share restored automatically</span>
  `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 4000);
}

// Helper to prompt user if auto-restore fails
function showManualScreenSharePrompt() {
    const prompt = document.createElement('div');
    prompt.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-yellow-600/90 backdrop-blur-sm text-white px-6 py-4 rounded-xl shadow-2xl z-[9999] max-w-md border border-yellow-500 flex items-start gap-4 animate-in zoom-in-95';
    prompt.innerHTML = `
      <svg class="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <div class="flex-1">
        <p class="font-bold text-lg mb-1">Screen share paused</p>
        <p class="text-sm opacity-90">Your network dropped briefly. Please click the <strong class="text-white bg-yellow-700/50 px-1 rounded border border-yellow-600">Screen Share</strong> button again to resume.</p>
      </div>
      <button onclick="this.parentElement.remove()" class="text-white/80 hover:text-white transition-colors bg-yellow-700/30 p-1.5 rounded-md hover:bg-yellow-700/50">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
  `;
    document.body.appendChild(prompt);

    setTimeout(() => {
        prompt.remove();
    }, 12000); // 12 seconds to ensure they see it
}

export const useScreenSharePersistence = () => {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    const wasScreenSharingRef = useRef(false);

    // Monitors and persists the screen sharing state
    useEffect(() => {
        if (!localParticipant || !room) return;

        const saveScreenShareState = () => {
            const isScreenSharing = localParticipant.isScreenShareEnabled;
            wasScreenSharingRef.current = isScreenSharing;

            if (isScreenSharing) {
                localStorage.setItem('podium_was_screen_sharing', 'true');
            } else {
                localStorage.removeItem('podium_was_screen_sharing');
            }
        };

        // Save state on an interval to ensure accuracy just before accidental disconnects
        const interval = setInterval(saveScreenShareState, 2000);

        const handleConnectionChange = (state: ConnectionState) => {
            if (state === ConnectionState.Reconnecting || state === ConnectionState.Disconnected) {
                saveScreenShareState();
            }
        };

        room.on('connectionStateChanged', handleConnectionChange);

        return () => {
            clearInterval(interval);
            room.off('connectionStateChanged', handleConnectionChange);
        };
    }, [localParticipant, room]);

    // Attempts to restore screen share after reconnection
    useEffect(() => {
        if (!localParticipant || !room) return;

        const handleReconnected = async () => {
            // Small cooldown mapping to LiveKit propagation time
            await new Promise(resolve => setTimeout(resolve, 2000));

            const wasSharing = wasScreenSharingRef.current ||
                localStorage.getItem('podium_was_screen_sharing') === 'true';

            if (wasSharing && !localParticipant.isScreenShareEnabled) {
                console.log('🔄 Attempting to restore screen share...');

                try {
                    // Attempting automatic recovery. Note: Browser security may still block this
                    // if it wasn't triggered by a recent user interaction, hence the fallback.
                    await localParticipant.setScreenShareEnabled(true);
                    console.log('✅ Screen share restored automatically via API');
                    showScreenShareRestoreNotification();
                    localStorage.removeItem('podium_was_screen_sharing');
                } catch (error) {
                    console.warn('❌ Auto-restore for screen share failed (expected browser security limitation).', error);
                    showManualScreenSharePrompt();
                }
            }
        };

        const handleConnectionChange = (state: ConnectionState) => {
            if (state === ConnectionState.Connected) {
                handleReconnected();
            }
        };

        room.on('connectionStateChanged', handleConnectionChange);

        return () => {
            room.off('connectionStateChanged', handleConnectionChange);
        };
    }, [localParticipant, room]);
};
