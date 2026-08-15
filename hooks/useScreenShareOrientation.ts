'use client';

import { useRemoteParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';

import { useIsMobile } from '@/hooks/useIsMobile';

export const useScreenShareOrientation = () => {
    const isMobile = useIsMobile();
    const remoteParticipants = useRemoteParticipants();

    // Derived directly from the participant list during render. useRemoteParticipants
    // already re-renders on participant/track changes, so mirroring this into state via
    // an effect only caused an extra render pass.
    const isScreenSharing = isMobile && remoteParticipants.some((participant) =>
        Array.from(participant.videoTrackPublications.values()).some(
            (pub) => pub.source === Track.Source.ScreenShare && pub.isSubscribed
        )
    );

    return {
        isScreenSharing,
        isMobile,
    };
};
