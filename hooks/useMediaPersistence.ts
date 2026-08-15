'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMaybeRoomContext } from '@livekit/components-react';
import { ConnectionState, LocalParticipant } from 'livekit-client';

import { useClassroom } from '@/contexts/ClassroomContext';

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
    const { userRole } = useClassroom();
    // This hook can be mounted outside of a <LiveKitRoom> (e.g. from GlobalClassroom),
    // so use the "maybe" variant of the context hook, which returns undefined instead
    // of throwing. Hooks must always be called unconditionally and in the same order,
    // so they cannot be wrapped in try/catch.
    const room = useMaybeRoomContext();
    const localParticipant = room?.localParticipant ?? null;

    const isInitializedRef = useRef(false);
    const isRestoringRef = useRef(false);
    const [restorationStatus, setRestorationStatus] = useState<'pending' | 'success' | 'error'>('pending');
    const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);

    // Keep refs of the LIVE objects so our async while-loop doesn't read stale closures
    const liveRoomRef = useRef(room);
    const liveParticipantRef = useRef(localParticipant);
    liveRoomRef.current = room;
    liveParticipantRef.current = localParticipant;

    // Load states helper
    const loadStates = useCallback((): MediaState | null => {
        // Students should NEVER auto-start media to respect lecturer permissions
        if (userRole !== 'lecturer') {
            console.log('🎓 [MediaPersistence] Student detected, keeping media OFF on join');
            return { camera: false, microphone: false };
        }

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
            // NEW LECTURERS: Default to ON to ensure hardware actually tries to start
            console.log('🆕 [MediaPersistence] New lecturer detected, defaulting media to ON');
            return { camera: true, microphone: true };
        }

        return {
            camera: savedCamera === 'true',
            microphone: savedMic === 'true',
        };
    }, [userRole]);

    // Save states helper
    const saveStates = useCallback(() => {
        // Strict guards to prevent overwriting with "off" states during/before restoration
        if (!localParticipant || isRestoringRef.current || !isInitializedRef.current) return;

        // Don't save if room isn't fully connected (states might be transient/incorrect)
        if (room?.state !== ConnectionState.Connected) return;

        const state: MediaState = {
            camera: localParticipant.isCameraEnabled,
            microphone: localParticipant.isMicrophoneEnabled,
        };

        localStorage.setItem(STORAGE_KEYS.CAMERA, String(state.camera));
        localStorage.setItem(STORAGE_KEYS.MICROPHONE, String(state.microphone));
        console.log('💾 [MediaPersistence] State saved:', state);
    }, [localParticipant, room?.state]);

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
            const maxAttempts = 180; // 3 minutes max for technical readiness
            let readyParticipant: LocalParticipant | null = null;

            while (true) {
                const currentRoom = liveRoomRef.current;
                const currentParticipant = liveParticipantRef.current;

                const isConnected = currentRoom?.state === ConnectionState.Connected;
                const hasParticipant = !!currentParticipant && !!currentParticipant.sid;
                const hasInteracted = typeof window !== 'undefined' && sessionStorage.getItem('podium_user_interacted') === 'true';

                if (isConnected && hasParticipant && hasInteracted) {
                    console.log('✅ [MediaPersistence] Room, Participant & Interaction ready.');
                    readyParticipant = currentParticipant;
                    break;
                }

                // If technical things are ready but just waiting for interaction, 
                // we don't count these as "timeout attempts" as harshly.
                if (isConnected && hasParticipant && !hasInteracted) {
                    setIsWaitingForInteraction(true);
                    console.log(`⏳ [MediaPersistence] Technical readiness achieved. Waiting for user interaction (Join button)...`);
                    // We check forever here, OR we can have a very long timeout (e.g. 10 mins)
                    if (attempts > 600) throw new Error('Interaction timeout: User did not interact with the page for 10 minutes');
                } else {
                    setIsWaitingForInteraction(false);
                    if (attempts >= maxAttempts) {
                        console.warn(`⚠️ [MediaPersistence] Restoration timed out after ${maxAttempts}s. Proceeding without auto-restoration.`);
                        isInitializedRef.current = true;
                        setRestorationStatus('success'); // Fallback to success to allow normal join
                        return;
                    }

                    if (!isConnected) {
                        console.log(`⏳ [MediaPersistence] Waiting for connection... (Room: ${currentRoom?.state ?? 'no room'}, Attempt ${attempts + 1}/${maxAttempts})`);
                    } else if (!hasParticipant) {
                        console.log(`⏳ [MediaPersistence] Waiting for participant identity... (Attempt ${attempts + 1}/${maxAttempts})`);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }

            // 2. Extra buffer for LiveKit signaling and browser permissions to settle
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Small hack for AudioContext issues: notify if suspended
            if (typeof window !== 'undefined' && (window as any).AudioContext) {
                // LiveKit uses internal contexts, but general check is helpful
                console.log('🔈 [MediaPersistence] Browser Audio State:', document.hidden ? 'Hidden' : 'Visible');
            }

            // 3. Restore Microphone
            if (savedState.microphone && readyParticipant) {
                console.log('🎤 [MediaPersistence] Restoring Microphone...');
                try {
                    await readyParticipant.setMicrophoneEnabled(true);
                } catch (error) {
                    console.error('🎤 [MediaPersistence] Mic restoration failed:', error);
                    // If device is in use or blocked, don't try again next time
                    localStorage.setItem(STORAGE_KEYS.MICROPHONE, 'false');
                }
            } else {
                console.log('🎤 [MediaPersistence] Mic was OFF, skipping.');
            }

            // 4. Camera Restoration (REMOVED)
            // By user request, camera is always OFF when joining a class, regardless of previous state.
            console.log('📹 [MediaPersistence] Camera auto-restoration disabled (defaults to OFF).');

            console.log('🎉 [MediaPersistence] Media states successfully applied.');
            setRestorationStatus('success');
        } catch (error) {
            console.error('❌ [MediaPersistence] Restoration failed:', error);
            setRestorationStatus('error');
        } finally {
            isRestoringRef.current = false;
            setIsWaitingForInteraction(false);
            // IMPORTANT: Mark as initialized even on error to stop the high-frequency 
            // useEffect from re-triggering and hammering the hardware/CPU.
            isInitializedRef.current = true;
        }
    }, [localParticipant, room?.state, loadStates]);

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

        // Add a one-time listener to session storage or some event that marks interaction
        // to speed up restoration when the user finally clicks.
        const checkInteraction = () => {
            if (sessionStorage.getItem('podium_user_interacted') === 'true' && !isInitializedRef.current && !isRestoringRef.current) {
                restore();
            }
        };

        window.addEventListener('click', checkInteraction);
        window.addEventListener('touchstart', checkInteraction);

        return () => {
            window.removeEventListener('click', checkInteraction);
            window.removeEventListener('touchstart', checkInteraction);
        };
    }, [room?.state, localParticipant?.sid, restore]);

    // Auto-save cycle
    useEffect(() => {
        if (!localParticipant) return;
        const interval = setInterval(saveStates, 5000);
        return () => clearInterval(interval);
    }, [localParticipant, saveStates]);

    return {
        isInitialized: isInitializedRef.current,
        restorationStatus,
        isWaitingForInteraction,
        retryRestoration, // Export for UI button
    };
};
