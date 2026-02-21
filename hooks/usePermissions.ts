import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import {
    subscribeToPermissions,
    requestPermission,
    ParticipantPermissions,
    PermissionType
} from '@/lib/firebase/permissions';

export interface Permissions {
    mic: boolean;
    camera: boolean;
}

export const usePermissions = (roomId: string, isLecturer: boolean) => {
    const { localParticipant } = useLocalParticipant();
    // Lecturers automatically have full permissions
    const [permissions, setPermissions] = useState<Permissions>({
        mic: isLecturer,
        camera: isLecturer,
    });

    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const prevPermissionsRef = useRef<Permissions>({ mic: isLecturer, camera: isLecturer });
    const isInitialLoadRef = useRef(true); // Track if this is the first doc fetch

    useEffect(() => {
        if (!localParticipant || !localParticipant.identity || isLecturer) return;

        console.log(`[usePermissions] Initializing listener for identity: ${localParticipant.identity} in room: ${roomId}`);

        // Subscribe to Firestore for changes
        const fetchPermissions = subscribeToPermissions(
            roomId,
            localParticipant.identity,
            async (participantPerms) => {
                if (!participantPerms) return;

                const newMicPerm = participantPerms.micPermission;
                const newCamPerm = participantPerms.cameraPermission;
                console.log('📡 [usePermissions] Received Firestore update:', participantPerms);

                setPermissions({
                    mic: newMicPerm,
                    camera: newCamPerm,
                });

                // Clear pending request status if permission was granted
                if (newMicPerm || newCamPerm) {
                    setHasPendingRequest(false);
                }

                const prev = prevPermissionsRef.current;
                const isInitial = isInitialLoadRef.current;

                if (isInitial) {
                    isInitialLoadRef.current = false;
                    console.log('📡 [usePermissions] Initial load complete. Skipping auto-enables.');
                }

                // Handle granting by auto-enabling local participant media
                if (!isInitial && !prev.mic && newMicPerm) {
                    console.log('🎙️ Mic permission granted, auto-enabling');
                    setTimeout(async () => {
                        await localParticipant.setMicrophoneEnabled(true).catch(console.error);
                    }, 500);
                }
                if (!isInitial && !prev.camera && newCamPerm) {
                    console.log('📸 Camera permission granted, auto-enabling');
                    setTimeout(async () => {
                        await localParticipant.setCameraEnabled(true).catch(console.error);
                    }, 500);
                }

                // Handle revokes by forcing local participant mute
                if (prev.mic && !newMicPerm) {
                    console.log('🔇 Mic permission revoked, force muting');
                    await localParticipant.setMicrophoneEnabled(false).catch(console.error);
                }
                if (prev.camera && !newCamPerm) {
                    console.log('📷 Camera permission revoked, force muting');
                    await localParticipant.setCameraEnabled(false).catch(console.error);
                }

                prevPermissionsRef.current = { mic: newMicPerm, camera: newCamPerm };
            }
        );

        return () => {
            fetchPermissions();
        };
    }, [localParticipant, localParticipant?.identity, roomId, isLecturer]);

    // Handle requesting permissions
    const requestPerm = useCallback(async (type: PermissionType) => {
        if (!localParticipant || !localParticipant.identity || isLecturer) return;

        setHasPendingRequest(true);

        try {
            await requestPermission(
                roomId,
                localParticipant.identity,
                localParticipant.name || 'Student',
                type
            );
            console.log('Sent permission request for', type);
        } catch (error) {
            console.error('Failed to request permission:', error);
            setHasPendingRequest(false);
        }
    }, [localParticipant, localParticipant?.identity, roomId, isLecturer]);

    return {
        permissions,
        hasPendingRequest,
        requestPermission: requestPerm,
    };
};
