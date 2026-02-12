'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface InstantPiPOptions {
    enabled: boolean;
}

export const useInstantPiP = ({ enabled }: InstantPiPOptions) => {
    const [isActive, setIsActive] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const wakeLockRef = useRef<any>(null);
    const isActivatingRef = useRef(false);

    useEffect(() => {
        const checkMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        setIsMobile(checkMobile);
    }, []);

    const exitPiP = useCallback(async () => {
        if (typeof document !== 'undefined' && document.pictureInPictureElement) {
            try {
                console.log('🧹 [InstantPiP] Exiting PiP mode');
                await document.exitPictureInPicture();
            } catch (err) {
                console.warn('⚠️ [InstantPiP] Failed to exit PiP:', err);
            }
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;
        console.log('🚀 [InstantPiP] Hook Mounting...');

        const primeVideoForPiP = (video: HTMLVideoElement) => {
            if ('autoPictureInPicture' in video) {
                if (!(video as any).autoPictureInPicture) {
                    console.log('🎯 [InstantPiP] Priming video for auto-PiP:', video);
                    (video as any).autoPictureInPicture = true;
                }
            }

            // RECOVERY: When user manually closes PiP, the browser often disables auto-PiP.
            // We listen for this and re-prime immediately.
            const handleLeavePiP = () => {
                console.log('🔄 [InstantPiP] PiP closed (likely manual). Re-priming...');
                (video as any).autoPictureInPicture = true;
                setIsActive(false);
            };

            video.removeEventListener('leavepictureinpicture', handleLeavePiP);
            video.addEventListener('leavepictureinpicture', handleLeavePiP);

            // Ensure video is playing if it has a source
            if (video.paused && (video.srcObject || video.src)) {
                video.play().catch(e => console.debug('Priming playback deferred:', e));
            }
        };

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLVideoElement) {
                        primeVideoForPiP(node);
                    } else if (node instanceof HTMLElement) {
                        node.querySelectorAll('video').forEach(primeVideoForPiP);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        document.querySelectorAll('video').forEach(primeVideoForPiP);

        const activateDesktopPiP = async () => {
            console.log('🎭 [InstantPiP] visibilitychange: hidden');
            if (isActivatingRef.current) return;

            // Handle stale or "zombie" PiP elements
            if (document.pictureInPictureElement) {
                const pipElem = document.pictureInPictureElement as HTMLVideoElement;
                // If the element in PiP is paused or has no source, it's a zombie
                if (pipElem.paused || !pipElem.srcObject) {
                    console.log('ℹ️ [InstantPiP] Stale/Inactive PiP detected. Clearing...');
                    await exitPiP();
                } else {
                    console.log('ℹ️ [InstantPiP] Valid PiP already active');
                    setIsActive(true);
                    return;
                }
            }

            isActivatingRef.current = true;
            try {
                const videos = Array.from(document.querySelectorAll('video'));
                console.log(`🔍 [InstantPiP] Candidate count: ${videos.length}`);

                // Filter for playing, non-muted (or active) videos
                const targetVideo = videos.find(v => (v.srcObject || v.src) && !v.paused && v.readyState >= 2);

                if (targetVideo) {
                    console.log('📺 [InstantPiP] Found target. Requesting Manual PiP...');
                    try {
                        await targetVideo.requestPictureInPicture();
                        setIsActive(true);
                    } catch (err) {
                        console.debug('⚠️ [InstantPiP] Manual trigger failed (expected without recent gesture)');
                    }
                } else {
                    console.log('❌ [InstantPiP] No suitable playing video found');
                }
            } finally {
                isActivatingRef.current = false;
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (isMobile) {
                    // Mobile audio persistence
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = 'playing';
                    }
                    setIsActive(true);
                } else {
                    activateDesktopPiP();
                }
            } else {
                console.log('🎭 [InstantPiP] visibilitychange: visible');
                setIsActive(false);
                // On desktop, we want the PiP to close when we return to the tab
                if (!isMobile) exitPiP();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange, { capture: true });
        window.addEventListener('pagehide', handleVisibilityChange, { capture: true });

        // Reset state on window focus
        const handleFocus = () => {
            setIsActive(false);
            if (!isMobile) exitPiP();
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            console.log('🧹 [InstantPiP] Hook Unmounting...');
            observer.disconnect();
            document.removeEventListener('visibilitychange', handleVisibilityChange, { capture: true });
            window.removeEventListener('pagehide', handleVisibilityChange, { capture: true });
            window.removeEventListener('focus', handleFocus);
        };
    }, [enabled, isMobile, exitPiP]);

    return { isActive, isMobile };
};
