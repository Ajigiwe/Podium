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

    // Video settings
    videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
    },

    // Reconnection settings
    reconnectPolicy: {
        // Initial retry delay (1 second) with exponential backoff
        nextRetryDelayInMs: (context) => {
            if (context.retryCount > 10) return null; // Stop after 10 attempts
            return Math.min(1000 * Math.pow(1.5, context.retryCount), 30000);
        }
    },

    // Publish defaults
    publishDefaults: {
        // Automatically manage video quality
        videoSimulcastLayers: [
            VideoPresets.h180,
            VideoPresets.h360,
            VideoPresets.h720,
        ],
        // Screen share at higher quality
        screenShareSimulcastLayers: [
            VideoPresets.h720,
            VideoPresets.h1080,
        ],
        // Backup codec
        backupCodec: true,
        // Stop tracks when muted
        stopMicTrackOnMute: false, // Important: keep false to maintain connection
    },
};
