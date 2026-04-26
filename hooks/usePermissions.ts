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

    // Update permissions if isLecturer changes (e.g. promoted to co-host)
    useEffect(() => {
        if (isLecturer) {
            setPermissions({ mic: true, camera: true });
            setHasPendingRequest(false);
        }
    }, [isLecturer]);

    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const prevPermissionsRef = useRef<Permissions>({ mic: isLecturer, camera: isLecturer });
    const isInitialLoadRef = useRef(true); // Track if this is the first doc fetch

    // STABLE REF for localParticipant so effects don't re-run on reference changes
    const participantRef = useRef(localParticipant);
    participantRef.current = localParticipant;

    // Extract identity as a stable primitive for the dependency array
    const identity = localParticipant?.identity;

    useEffect(() => {
        if (!identity || isLecturer) return;

        console.log(`[usePermissions] Initializing listener for identity: ${identity} in room: ${roomId}`);
        isInitialLoadRef.current = true; // Reset on new identity

        // Subscribe to Firestore for changes
        const unsubscribe = subscribeToPermissions(
            roomId,
            identity,
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
                    prevPermissionsRef.current = { mic: newMicPerm, camera: newCamPerm };
                    return; // SKIP all auto-enable/revoke on first load
                }

                const lp = participantRef.current;
                if (!lp) return;

                // Handle granting by auto-enabling local participant media
                if (!prev.mic && newMicPerm) {
                    console.log('🎙️ Mic permission granted, auto-enabling');
                    setTimeout(async () => {
                        await participantRef.current?.setMicrophoneEnabled(true).catch(console.error);
                    }, 500);
                }
                if (!prev.camera && newCamPerm) {
                    console.log('📸 Camera permission granted, auto-enabling');
                    setTimeout(async () => {
                        await participantRef.current?.setCameraEnabled(true).catch(console.error);
                    }, 500);
                }

                // Handle revokes by forcing local participant mute
                if (prev.mic && !newMicPerm) {
                    console.log('🔇 Mic permission revoked, force muting');
                    await lp.setMicrophoneEnabled(false).catch(console.error);
                }
                if (prev.camera && !newCamPerm) {
                    console.log('📷 Camera permission revoked, force muting');
                    await lp.setCameraEnabled(false).catch(console.error);
                }

                prevPermissionsRef.current = { mic: newMicPerm, camera: newCamPerm };
            }
        );

        return () => {
            unsubscribe();
        };
    }, [identity, roomId, isLecturer]); // STABLE deps: primitive identity, not object ref

    // Handle requesting permissions
    const requestPerm = useCallback(async (type: PermissionType) => {
        const lp = participantRef.current;
        if (!lp || !lp.identity || isLecturer) return;

        setHasPendingRequest(true);

        try {
            await requestPermission(
                roomId,
                lp.identity,
                lp.name || 'Student',
                type
            );
            console.log('Sent permission request for', type);
        } catch (error) {
            console.error('[Permissions:Request:Failed] Failed to request permission:', error);
            setHasPendingRequest(false);
        }
    }, [roomId, isLecturer]); // STABLE deps: no localParticipant object

    return {
        permissions,
        hasPendingRequest,
        requestPermission: requestPerm,
    };
};
