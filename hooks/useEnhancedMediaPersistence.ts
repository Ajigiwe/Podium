import { useEffect, useRef, useState } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

const STORAGE_KEYS = {
    CAMERA: 'podium_camera_state',
    MICROPHONE: 'podium_mic_state',
};

interface MediaState {
    camera: boolean;
    microphone: boolean;
}

export const useEnhancedMediaPersistence = () => {
    // Safe destructuring with fallback? No, the hook itself throws.
    // I will use a different approach.
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    const isInitializedRef = useRef(false);
    const isRestoringRef = useRef(false);
    const [restorationStatus, setRestorationStatus] = useState<'pending' | 'success' | 'error'>('pending');

    // Load saved states
    const loadStates = (): MediaState | null => {
        if (typeof window === 'undefined') return null;

        const savedCamera = localStorage.getItem(STORAGE_KEYS.CAMERA);
        const savedMic = localStorage.getItem(STORAGE_KEYS.MICROPHONE);

        if (savedCamera === null && savedMic === null) {
            return null;
        }

        return {
            camera: savedCamera === 'true',
            microphone: savedMic === 'true',
        };
    };

    // Save current states
    const saveStates = () => {
        // Critical: Don't save if we haven't finished restoring yet!
        if (!localParticipant || isRestoringRef.current || !isInitializedRef.current || restorationStatus !== 'success') {
            // console.log('⏹️ Skipping save (restoring or not initialized)');
            return;
        }

        if (room?.state !== ConnectionState.Connected) {
            // console.log('⏹️ Skipping save (room not connected)');
            return;
        }

        const state: MediaState = {
            camera: localParticipant.isCameraEnabled,
            microphone: localParticipant.isMicrophoneEnabled,
        };

        // console.log('💾 Saving media states:', state);
        localStorage.setItem(STORAGE_KEYS.CAMERA, String(state.camera));
        localStorage.setItem(STORAGE_KEYS.MICROPHONE, String(state.microphone));
    };

    // Restore states with retry logic
    const restoreStates = async (retryCount = 0): Promise<boolean> => {
        if (!localParticipant || isInitializedRef.current) {
            return false;
        }

        isRestoringRef.current = true;

        try {
            const savedState = loadStates();

            if (!savedState) {
                console.log('ℹ️ No saved media states found');
                isInitializedRef.current = true;
                isRestoringRef.current = false;
                setRestorationStatus('success');
                return true;
            }

            console.log('🔄 Restoring media states:', savedState);

            // Wait for room to be fully connected
            if (room?.state !== ConnectionState.Connected) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                if (retryCount < 5) {
                    isRestoringRef.current = false;
                    return restoreStates(retryCount + 1);
                }
            }

            // Stabilization delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 1. Restore microphone
            if (savedState.microphone) {
                console.log('🎤 Restoring microphone...');
                try {
                    await localParticipant.setMicrophoneEnabled(true);
                    console.log('✅ Microphone restored');
                } catch (error) {
                    console.error('❌ Failed to restore microphone:', error);
                }
            }

            // Delay between devices to prevent hardware contention
            await new Promise(resolve => setTimeout(resolve, 800));

            // 2. Restore camera
            if (savedState.camera) {
                console.log('📹 Restoring camera...');
                try {
                    await localParticipant.setCameraEnabled(true);
                    console.log('✅ Camera restored');
                } catch (error) {
                    console.error('❌ Failed to restore camera:', error);
                    // Minimal fallback for permissions
                    if (savedState.camera) {
                        try {
                            await navigator.mediaDevices.getUserMedia({ video: true });
                            await localParticipant.setCameraEnabled(true);
                        } catch (e) {
                            console.error('Manual camera fallback failed:', e);
                        }
                    }
                }
            }

            // Final stabilization
            await new Promise(resolve => setTimeout(resolve, 500));

            // Verify if we actually achieved the desired state
            // If we failed to enable a device that was supposed to be on, 
            // we don't mark as "success" immediately but we also don't want to infinite loop.
            const achievedState = {
                camera: localParticipant.isCameraEnabled,
                microphone: localParticipant.isMicrophoneEnabled
            };

            console.log('🏁 Restoration check:', achievedState);

            isInitializedRef.current = true;
            setRestorationStatus('success');
            console.log('✅ Media state restoration complete');
            return true;

        } catch (error) {
            console.error('❌ Error during media state restoration:', error);
            setRestorationStatus('error');
            return false;
        } finally {
            isRestoringRef.current = false;
        }
    };

    // Restore when room is connected
    useEffect(() => {
        if (room?.state === ConnectionState.Connected && localParticipant && !isInitializedRef.current && !isRestoringRef.current) {
            restoreStates();
        }
    }, [room?.state, localParticipant]);

    // Save periodically and on unmount
    useEffect(() => {
        if (!localParticipant) return;

        // Save every 5 seconds (less frequent to avoid race conditions)
        const interval = setInterval(saveStates, 5000);

        // Save before page unload
        const handleBeforeUnload = () => {
            saveStates();
        };

        // Save on visibility change (page hidden)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                saveStates();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // DO NOT save on cleanup, as it might save "false" during unmount
        };
    }, [localParticipant]);

    return {
        isInitialized: isInitializedRef.current,
        restorationStatus,
    };
};
