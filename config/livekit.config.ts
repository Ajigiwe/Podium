// config/livekit.config.ts
import { RoomOptions, VideoPresets } from 'livekit-client';

export const roomOptions: RoomOptions = {
    // Adaptive streaming for better network handling
    adaptiveStream: true,

    // Dynamic broadcasting - adjusts quality based on network
    dynacast: true,

    // Audio settings
    audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
    },

    // Video settings - start lower for mobile stability
    videoCaptureDefaults: {
        resolution: VideoPresets.h360.resolution, // Start at 360p to reduce initial pressure
    },

    // Reconnection settings - persistent for mobile and flaky networks
    reconnectPolicy: {
        nextRetryDelayInMs: (context) => {
            if (context.retryCount > 50) return 15000;
            return Math.min(300 * Math.pow(1.3, context.retryCount), 15000);
        }
    },

    // Publish defaults
    publishDefaults: {
        // Broad compatibility and low hardware cost
        videoCodec: 'vp8',

        // Automatically manage video quality
        videoSimulcastLayers: [
            VideoPresets.h180, // Low bitrate backup
            VideoPresets.h360, // Standard mobile
            VideoPresets.h720, // High quality
        ],
        // Screen share at higher quality
        screenShareSimulcastLayers: [
            VideoPresets.h720,
            VideoPresets.h1080,
        ],
        // Backup codec
        backupCodec: true,
        // Stop tracks when muted
        stopMicTrackOnMute: false,
    },
};
