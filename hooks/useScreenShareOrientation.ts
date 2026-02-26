'use client';

import { useEffect, useState } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';

export const useScreenShareOrientation = () => {
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const remoteParticipants = useRemoteParticipants();

    // Detect if mobile
    useEffect(() => {
        const checkMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        setIsMobile(checkMobile);
    }, []);

    // Monitor for screen share
    useEffect(() => {
        if (!isMobile) return;

        let hasScreenShare = false;

        // Check all remote participants for screen share tracks
        for (const participant of remoteParticipants) {
            const screenSharePublication = Array.from(participant.videoTrackPublications.values())
                .find(pub => pub.source === Track.Source.ScreenShare);

            if (screenSharePublication && screenSharePublication.isSubscribed) {
                hasScreenShare = true;
                break;
            }
        }

        setIsScreenSharing(hasScreenShare);
    }, [remoteParticipants, isMobile]);

    return {
        isScreenSharing,
        isMobile,
    };
};
