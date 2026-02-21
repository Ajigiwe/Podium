import { useEffect, useRef, useState } from 'react';

interface AutoPiPOptions {
    enabled: boolean;
    delayMs?: number; // Delay before triggering PiP (to avoid accidental triggers)
}

export const useAutoPiP = ({ enabled, delayMs = 500 }: AutoPiPOptions) => {
    const [isActive, setIsActive] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const wakeLockRef = useRef<any>(null);
    // Ref to track if we've already set the attributes to avoid constant DOM thrashing
    const processedVideosRef = useRef<Set<HTMLVideoElement>>(new Set());

    useEffect(() => {
        // Detect mobile
        const checkMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        setIsMobile(checkMobile);
    }, []);

    // Desktop: Auto PiP Attribute Management
    useEffect(() => {
        if (!enabled || isMobile) return;

        // Register Media Session Action (Required for Chrome Auto PiP)
        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.setActionHandler('enterpictureinpicture' as any, () => {
                    console.log('Enter PiP action triggered via Media Session');
                });
            } catch (e) {
                console.log('Media Session action handler error:', e);
            }
        }

        // Desktop: Force Attribute Application
        const applyAutoPiPAttribute = () => {
            const videos = document.querySelectorAll('video');
            videos.forEach((video) => {
                try {
                    // Force enable PiP capabilities
                    if (video.hasAttribute('disablePictureInPicture')) {
                        video.removeAttribute('disablePictureInPicture');
                    }
                    if ((video as any).disablePictureInPicture) {
                        (video as any).disablePictureInPicture = false;
                    }

                    // Apply Auto PiP
                    if (!video.hasAttribute('autopictureinpicture')) {
                        video.setAttribute('autopictureinpicture', '');
                        (video as any).autoPictureInPicture = true;
                        console.log('✅ Applied autopictureinpicture to video:', video);
                    }
                } catch (e) {
                    // console.error('Failed to set autopictureinpicture', e);
                }
            });
        };

        // Run initially
        applyAutoPiPAttribute();

        // Run periodically to catch new videos (LiveKit adds them dynamically)
        // A MutationObserver would be better but global DOM observation is expensive.
        // Interval of 2s is a reasonable trade-off.
        const interval = setInterval(applyAutoPiPAttribute, 1000);

        return () => {
            clearInterval(interval);
            // We technically don't need to unset it, but for cleanliness:
            // We can't really track removed nodes easily without MutationObserver.
            // Let's just leave the interval cleanup.
        };
    }, [enabled, isMobile]);


    // Logic Handlers
    useEffect(() => {
        if (!enabled) return;

        // Sync local state with actual browser PiP state
        const checkPiPState = () => {
            const isPiP = !!document.pictureInPictureElement;
            if (isActive !== isPiP && !isMobile) {
                setIsActive(isPiP);
            }
        };

        if (!isMobile) {
            document.addEventListener('enterpictureinpicture', checkPiPState);
            document.addEventListener('leavepictureinpicture', checkPiPState);
            const pipInterval = setInterval(checkPiPState, 500); // Polling for robust UI state
            return () => {
                document.removeEventListener('enterpictureinpicture', checkPiPState);
                document.removeEventListener('leavepictureinpicture', checkPiPState);
                clearInterval(pipInterval);
            };
        }

        // Mobile Background Audio Logic
        const handleVisibilityChange = async () => {
            if (!isMobile) return;  // Desktop handled strictly by attribute now

            // Clear any pending timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            if (document.hidden) {
                // User left the page - wait a moment then activate
                timeoutRef.current = setTimeout(async () => {
                    console.log('📱 Mobile: activating background audio...');
                    await activateMobileBackgroundAudio();
                    setIsActive(true);
                }, delayMs);
            } else {
                // User returned to the page
                console.log('User returned to browser');

                // Release wake lock when returning
                if (wakeLockRef.current) {
                    wakeLockRef.current.release().catch(console.error);
                    wakeLockRef.current = null;
                }
                setIsActive(false);
            }
        };

        const activateMobileBackgroundAudio = async () => {
            try {
                console.log('Activating mobile background audio...');

                // Setup Media Session API
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: 'Podium Class in Session',
                        artist: 'Live Class',
                        album: 'Podium Classroom',
                    });
                    navigator.mediaSession.playbackState = 'playing';
                }

                // Request wake lock to prevent sleep
                if ('wakeLock' in navigator && !wakeLockRef.current) {
                    // ... (keep existing wake lock logic)
                    try {
                        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                        console.log('✅ Wake lock acquired');
                    } catch (err) {
                        console.log('Wake lock failed (not critical):', err);
                    }
                }

                // Show notification
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Podium Class', {
                        body: 'Audio is running in background',
                        tag: 'podium-auto-audio',
                        requireInteraction: false,
                        silent: true
                    });
                }

                console.log('✅ Mobile background audio activated');
            } catch (error) {
                console.error('Failed to activate background audio:', error);
            }
        };

        // Listen for visibility changes (Mobile Only now)
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleVisibilityChange);
        window.addEventListener('focus', () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = undefined;
            }
            if (document.hidden === false && isMobile) {
                setIsActive(false);
            }
        });

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleVisibilityChange);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (wakeLockRef.current) {
                wakeLockRef.current.release().catch((e: any) => console.log('Wake lock release error', e));
                wakeLockRef.current = null;
            }
        };
    }, [enabled, isMobile, delayMs]);

    return {
        isActive,
        isMobile,
    };
};
