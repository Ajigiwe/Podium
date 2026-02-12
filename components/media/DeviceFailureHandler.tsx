'use client';

import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { useAlert } from '@/contexts/AlertContext';
import { useMediaPersistence } from '@/hooks/useMediaPersistence';

export const DeviceFailureHandler = () => {
    const room = useRoomContext();
    const { showAlert, customAlert } = useAlert();
    const { restorationStatus } = useMediaPersistence();

    useEffect(() => {
        if (!room) return;

        const handleMediaFailure = (e: any) => {
            const errorName = (e as any)?.name || '';
            const errorMessage = (e as any)?.message || String(e || '');

            // SILENCE: If we are currently in the middle of our custom "Media Restoration" 
            // retry loop, we DON'T want to show a modal alert because it interrupts 
            // the automated recovery. We only log it for technical inspection.
            if (restorationStatus === 'pending') {
                console.log('🛡️ [DeviceFailureHandler] Silencing device failure modal during active restoration:', errorName, errorMessage);
                return;
            }

            console.error('Media device failure:', e);

            const isPermissionError = errorName === 'NotAllowedError' ||
                errorMessage.includes('PermissionDenied') ||
                errorName === 'PermissionDeniedError';

            const isDeviceInUseError = errorName === 'AbortError' ||
                errorName === 'NotReadableError' ||
                errorMessage.includes('DeviceInUse') ||
                errorMessage.includes('Could not start video source');

            if (isPermissionError) {
                customAlert({
                    title: 'Camera/Mic Access Blocked',
                    message: 'Podium needs access to your camera and microphone to let you participate. Please click the camera/lock icon in your browser address bar and select "Allow".',
                    type: 'warning',
                    confirmText: 'Try Again',
                    cancelText: 'Join without Media',
                    onConfirm: () => {
                        window.location.reload();
                    },
                    onCancel: () => {
                        // Clear stored states so we don't try to auto-restore next time
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('podium_camera_state', 'false');
                            localStorage.setItem('podium_mic_state', 'false');
                        }
                    }
                });
            } else if (isDeviceInUseError) {
                customAlert({
                    title: 'Camera/Mic Already in Use',
                    message: 'Another application or ANOTHER BROWSER TAB is already using your camera or microphone. Please close all other apps (Zoom, Teams) and tabs, then try again.',
                    type: 'error',
                    confirmText: 'Dismiss',
                    cancelText: 'Join without Media', // Allow joining anyway
                    onConfirm: () => {
                        // Just dismiss, don't reload
                    },
                    onCancel: () => {
                        // Disable auto-restore if user chooses to skip
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('podium_camera_state', 'false');
                            localStorage.setItem('podium_mic_state', 'false');
                        }
                    }
                });
            } else {
                showAlert('Could not access camera or microphone. Please check your device connections.', 'error');
            }
        };

        room.on(RoomEvent.MediaDevicesError, handleMediaFailure);

        return () => {
            room.off(RoomEvent.MediaDevicesError, handleMediaFailure);
        };
    }, [room, customAlert, showAlert, restorationStatus]);

    return null;
};
