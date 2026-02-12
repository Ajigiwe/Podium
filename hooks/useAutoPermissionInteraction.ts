'use client';

import { useEffect, useRef } from 'react';

/**
 * useAutoPermissionInteraction
 * 
 * Automatically requests camera/microphone permissions as a way to establish 
 * "user interaction" for the browser. This allows PiP and AudioContext to work 
 * even if the user hasn't explicitly clicked a button yet.
 */
export const useAutoPermissionInteraction = () => {
    const hasRequestedRef = useRef(false);

    useEffect(() => {
        const requestPermissions = async () => {
            // Check if already interacted or already requested
            if (hasRequestedRef.current || sessionStorage.getItem('podium_user_interacted') === 'true') {
                return;
            }

            hasRequestedRef.current = true;

            try {
                console.log('🔒 [AutoInteraction] Requesting permissions to establish user intent...');

                // Browser permission prompt counts as user interaction!
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true
                });

                console.log('✅ [AutoInteraction] Permissions processed - interaction established');

                // Stop the stream immediately if we successfully got it
                // We just needed the gesture/interaction. Actual media is handled by LiveKit.
                stream.getTracks().forEach(track => track.stop());

                // Now PiP will work without additional interaction
                sessionStorage.setItem('podium_user_interacted', 'true');

            } catch (error: any) {
                // If denied, we can't use this method, but the attempt itself might satisfy some browsers
                console.debug('[AutoInteraction] Permission flow result:', error.name);
            }
        };

        // Wait a small moment for page to stabilize
        const timer = setTimeout(requestPermissions, 1500);
        return () => clearTimeout(timer);
    }, []);
};
