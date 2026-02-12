'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

const STORAGE_KEYS = {
    CAMERA: 'podium_camera_state',
    MICROPHONE: 'podium_mic_state',
    LEGACY: 'podium_media_state',
};

interface MediaState {
    camera: boolean;
    microphone: boolean;
}

export const useMediaPersistence = () => {
    // Context hooks that might throw if called outside LiveKitRoom
    let localParticipant: any = null;
    let room: any = { state: 'disconnected' };

    try {
        // These will throw if not inside a <LiveKitRoom>
        const roomContext = useRoomContext();
        const lpContext = useLocalParticipant();
        room = roomContext;
        localParticipant = lpContext.localParticipant;
    } catch (e) {
        // Gracefully handle missing context if called from a parent (like GlobalClassroom)
        // This prevents the "No room provided" runtime crash.
    }

    const isInitializedRef = useRef(false);
    const isRestoringRef = useRef(false);
    const [restorationStatus, setRestorationStatus] = useState<'pending' | 'success' | 'error'>('pending');

    // Load states helper
    const loadStates = useCallback((): MediaState | null => {
        const savedCamera = localStorage.getItem(STORAGE_KEYS.CAMERA);
        const savedMic = localStorage.getItem(STORAGE_KEYS.MICROPHONE);

        if (savedCamera === null && savedMic === null) {
            const legacy = localStorage.getItem(STORAGE_KEYS.LEGACY);
            if (legacy) {
                try {
                    const parsed = JSON.parse(legacy);
                    return { camera: !!parsed.videoEnabled, microphone: !!parsed.audioEnabled };
                } catch (e) { }
            }
            // NEW USERS: Default to ON to ensure hardware actually tries to start
            console.log('🆕 [MediaPersistence] New user detected, defaulting media to ON');
            return { camera: true, microphone: true };
        }

        return {
            camera: savedCamera === 'true',
            microphone: savedMic === 'true',
        };
    }, []);

    // Save states helper
    const saveStates = useCallback(() => {
        // Strict guards to prevent overwriting with "off" states during/before restoration
        if (!localParticipant || isRestoringRef.current || !isInitializedRef.current) return;

        // Don't save if room isn't fully connected (states might be transient/incorrect)
        if (room.state !== ConnectionState.Connected) return;

        const state: MediaState = {
            camera: localParticipant.isCameraEnabled,
            microphone: localParticipant.isMicrophoneEnabled,
        };

        localStorage.setItem(STORAGE_KEYS.CAMERA, String(state.camera));
        localStorage.setItem(STORAGE_KEYS.MICROPHONE, String(state.microphone));
        console.log('💾 [MediaPersistence] State saved:', state);
    }, [localParticipant, room.state]);

    // Main restoration logic - Robustly waits for Room and Participant
    const restore = useCallback(async () => {
        if (isInitializedRef.current || isRestoringRef.current) return;

        const savedState = loadStates();
        if (!savedState) {
            console.log('ℹ️ [MediaPersistence] No saved state. Initialized.');
            isInitializedRef.current = true;
            setRestorationStatus('success');
            return;
        }

        console.log('🚀 [MediaPersistence] Starting restoration search...');
        isRestoringRef.current = true;
        setRestorationStatus('pending');

        try {
            // 1. Wait for stable Room connection, LocalParticipant, and User Interaction
            let attempts = 0;
            const maxAttempts = 60; // 60 seconds max (increased to allow for Welcome Prompt UX)

            while (attempts < maxAttempts) {
                const isConnected = room.state === ConnectionState.Connected;
                const hasParticipant = !!localParticipant && !!localParticipant.sid;
                const hasInteracted = typeof window !== 'undefined' && sessionStorage.getItem('podium_user_interacted') === 'true';

                if (isConnected && hasParticipant && hasInteracted) {
                    console.log('✅ [MediaPersistence] Room, Participant & Interaction ready.');
                    break;
                }

                // Log specific waiting reason for better debugging
                if (!isConnected) {
                    console.log(`⏳ [MediaPersistence] Waiting for connection... (Room: ${room.state}, Attempt ${attempts + 1}/${maxAttempts})`);
                } else if (!hasParticipant) {
                    console.log(`⏳ [MediaPersistence] Waiting for participant identity... (Attempt ${attempts + 1}/${maxAttempts})`);
                } else if (!hasInteracted) {
                    console.log(`⏳ [MediaPersistence] Waiting for user to click Join... (Attempt ${attempts + 1}/${maxAttempts})`);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }

            if (attempts >= maxAttempts) {
                throw new Error('Restoration timeout: Room, Participant or Interaction not ready');
            }

            // 2. Extra buffer for LiveKit signaling and browser permissions to settle
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Small hack for AudioContext issues: notify if suspended
            if (typeof window !== 'undefined' && (window as any).AudioContext) {
                // LiveKit uses internal contexts, but general check is helpful
                console.log('🔈 [MediaPersistence] Browser Audio State:', document.hidden ? 'Hidden' : 'Visible');
            }

            // 3. Restore Microphone
            if (savedState.microphone) {
                console.log('🎤 [MediaPersistence] Restoring Microphone...');
                try {
                    await localParticipant.setMicrophoneEnabled(true);
                } catch (error: any) {
                    console.error('🎤 [MediaPersistence] Mic restoration failed:', error);
                    // If device is in use or blocked, don't try again next time
                    localStorage.setItem(STORAGE_KEYS.MICROPHONE, 'false');
                }
            } else {
                console.log('🎤 [MediaPersistence] Mic was OFF, skipping.');
            }

            // 4. Restore Camera
            if (savedState.camera) {
                console.log('📹 [MediaPersistence] Restoring Camera...');
                // Increased stagger to 3s to ensure hardware stability between Mic and Cam
                await new Promise(resolve => setTimeout(resolve, 3000));

                let camAttempts = 0;
                const maxCamAttempts = 3;
                let camSuccess = false;

                while (camAttempts < maxCamAttempts && !camSuccess) {
                    try {
                        console.log(`📹 [MediaPersistence] Camera attempt ${camAttempts + 1}...`);
                        await localParticipant.setCameraEnabled(true);
                        camSuccess = true;
                        console.log('📹 [MediaPersistence] Camera restored successfully');
                    } catch (error: any) {
                        camAttempts++;
                        const isReadableError = error.name === 'NotReadableError' || error.message?.includes('Could not start');

                        if (isReadableError && camAttempts < maxCamAttempts) {
                            console.warn(`📹 [MediaPersistence] Camera busy/locked (Attempt ${camAttempts}), waiting 1.5s for cool-down...`);
                            await new Promise(resolve => setTimeout(resolve, 1500));
                        } else {
                            console.error('📹 [MediaPersistence] Camera restoration failed definitively:', error);
                            // If hardware is truly locked after retries or blocked, disable auto-restore
                            // but keep the error status so the UI can react
                            localStorage.setItem(STORAGE_KEYS.CAMERA, 'false');
                            throw error; // Propagate to trigger status error
                        }
                    }
                }
            } else {
                console.log('📹 [MediaPersistence] Camera was OFF, skipping.');
            }

            console.log('🎉 [MediaPersistence] Media states successfully applied.');
            setRestorationStatus('success');
        } catch (error) {
            console.error('❌ [MediaPersistence] Restoration failed:', error);
            setRestorationStatus('error');
        } finally {
            isRestoringRef.current = false;
            // IMPORTANT: Mark as initialized even on error to stop the high-frequency 
            // useEffect from re-triggering and hammering the hardware/CPU.
            isInitializedRef.current = true;
        }
    }, [localParticipant, room.state, loadStates]);

    // Manual Retry Function
    const retryRestoration = useCallback(() => {
        console.log('🔄 [MediaPersistence] Manual retry requested');
        isInitializedRef.current = false;
        isRestoringRef.current = false;
        setRestorationStatus('pending');
        // The useEffect below will detect isInitializedRef.current === false and call restore()
    }, []);

    // Handle Restoration Timing - High frequency trigger to ensure we don't miss the window
    useEffect(() => {
        if (!isInitializedRef.current && !isRestoringRef.current) {
            restore();
        }
    }, [room.state, localParticipant?.sid, restore]);

    // Auto-save cycle
    useEffect(() => {
        if (!localParticipant) return;
        const interval = setInterval(saveStates, 5000);
        return () => clearInterval(interval);
    }, [localParticipant, saveStates]);

    return {
        isInitialized: isInitializedRef.current,
        restorationStatus,
        retryRestoration, // Export for UI button
    };
};
