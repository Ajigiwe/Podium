// config/livekit.config.ts
import { RoomOptions, ScreenSharePresets, VideoPresets } from 'livekit-client';

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

        // Keep full detail under congestion instead of dropping to a blur -
        // resolution matters far more than framerate for slides and text
        degradationPreference: 'maintain-resolution',

        // Redundant audio encoding (RED) - recovers lost audio packets on flaky mobile links
        red: true,
        // Discontinuous transmission - no packets while silent, saves bandwidth and battery
        dtx: true,

        // Automatically manage video quality
        videoSimulcastLayers: [
            VideoPresets.h180, // Low bitrate backup
            VideoPresets.h360, // Standard mobile
            VideoPresets.h720, // High quality
        ],
        // Screen share at lower fps - slides are nearly static, so 15fps keeps text
        // sharp at a fraction of the 30fps bitrate
        screenShareSimulcastLayers: [
            ScreenSharePresets.h720fps15,
            ScreenSharePresets.h1080fps15,
        ],
        // Backup codec
        backupCodec: true,
        // Keep mic hardware open while muted (faster unmute); small battery cost on phones
        stopMicTrackOnMute: false,
    },
};