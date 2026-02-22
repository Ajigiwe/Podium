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

    // Reconnection settings - more aggressive for mobile hangovers
    reconnectPolicy: {
        nextRetryDelayInMs: (context) => {
            if (context.retryCount > 15) return null; // Increase to 15 attempts for flaky mobile
            return Math.min(500 * Math.pow(1.4, context.retryCount), 20000); // Faster initial retries
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
