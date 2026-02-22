'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRoomContext, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';

export function usePiPPersistence() {
    const room = useRoomContext();
    const [isPiPActive, setIsPiPActive] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Get all tracks to find a suitable one for PiP
    const tracks = useTracks([
        { source: Track.Source.ScreenShare, withPlaceholder: false },
        { source: Track.Source.Camera, withPlaceholder: false },
    ], { onlySubscribed: true });

    // Automatically find the best video element for PiP
    useEffect(() => {
        const findVideoElement = () => {
            // Priority 1: A focused video element or screen share
            // For now, we search the DOM for the most relevant LiveKit video element
            const videoElements = document.querySelectorAll('video');

            // Try to find the one that is currently "large" or "visible"
            let bestVideo = null;
            let maxArea = 0;

            videoElements.forEach(video => {
                const rect = video.getBoundingClientRect();
                const area = rect.width * rect.height;
                if (area > maxArea) {
                    maxArea = area;
                    bestVideo = video;
                }
            });

            if (bestVideo) {
                videoRef.current = bestVideo;
            }
        };

        const interval = setInterval(findVideoElement, 2000);
        findVideoElement();

        return () => clearInterval(interval);
    }, [tracks]);

    const togglePiP = useCallback(async () => {
        if (!videoRef.current) {
            console.warn('No video element found for PiP');
            return;
        }

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await videoRef.current.requestPictureInPicture();
            }
        } catch (error) {
            console.error('[PiP] Failed to toggle PiP:', error);
        }
    }, []);

    return {
        videoRef,
        isPiPActive,
        setIsPiPActive,
        togglePiP,
        room
    };
}
