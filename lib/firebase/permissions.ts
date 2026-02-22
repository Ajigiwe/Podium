import { db } from './config';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

export type PermissionType = 'microphone' | 'camera' | 'both';

export interface ParticipantPermissions {
  micPermission: boolean;
  cameraPermission: boolean;
  grantedBy?: string;
  grantedAt?: any;
}

export interface PermissionRequest {
  id: string;
  participantId: string;
  participantName: string;
  requestType: PermissionType;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: any;
}

// Subscribe to a participant's permissions
export const subscribeToPermissions = (
  sessionId: string,
  participantId: string,
  onUpdate: (permissions: ParticipantPermissions | null) => void
) => {
  const permDocRef = doc(db, 'sessions', sessionId, 'permissions', participantId);
  return onSnapshot(permDocRef, (doc) => {
    if (doc.exists()) {
      onUpdate(doc.data() as ParticipantPermissions);
    } else {
      // Default to no permissions if doc doesn't exist yet
      onUpdate({ micPermission: false, cameraPermission: false });
    }
  }, (error) => {
    console.error(`[Permissions:Participant] Error subscribing to participant ${participantId}:`, error);
    onUpdate({ micPermission: false, cameraPermission: false });
  });
};

// Subscribe to incoming permission requests for a lecturer
export const subscribeToPermissionRequests = (
  sessionId: string,
  onUpdate: (requests: PermissionRequest[]) => void
) => {
  const requestsRef = collection(db, 'sessions', sessionId, 'permission_requests');
  const q = query(
    requestsRef,
    where('status', '==', 'pending'),
    orderBy('requestedAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PermissionRequest[];

    // Sorting is now handled by Firestore query
    onUpdate(requests);
  }, (error) => {
    console.error(`[Permissions:Requests] Error subscribing to permission requests:`, error);
    onUpdate([]);
  });
};

// Subscribe to all active participant permissions in a session
export const subscribeToAllPermissions = (
  sessionId: string,
  onUpdate: (permissionsList: { participantId: string; permissions: ParticipantPermissions }[]) => void
) => {
  const permsRef = collection(db, 'sessions', sessionId, 'permissions');

  return onSnapshot(permsRef, (snapshot) => {
    const permissionsList = snapshot.docs.map(doc => ({
      participantId: doc.id,
      permissions: doc.data() as ParticipantPermissions
    }));
    onUpdate(permissionsList);
  }, (error) => {
    console.error(`[Permissions:All] Error subscribing to all session permissions:`, error);
    onUpdate([]);
  });
};

// Request permission (Student)
export const requestPermission = async (
  sessionId: string,
  participantId: string,
  participantName: string,
  requestType: PermissionType
) => {
  const requestsRef = collection(db, 'sessions', sessionId, 'permission_requests');
  // Use a predictable ID or auto-gen. We'll auto-gen by using doc() empty, 
  // but to avoid spam, we'll use participantId as the doc ID for the request
  // so a student can only have one pending request at a time.
  const studentRequestRef = doc(requestsRef, participantId);

  await setDoc(studentRequestRef, {
    participantId,
    participantName,
    requestType,
    status: 'pending',
    requestedAt: serverTimestamp()
  });
};

// Grant permission (Lecturer)
export const grantPermission = async (
  sessionId: string,
  participantId: string,
  lecturerId: string,
  permissionType: PermissionType
) => {
  // Update the permission doc
  const permDocRef = doc(db, 'sessions', sessionId, 'permissions', participantId);

  // Create or update
  const permDocSnap = await getDoc(permDocRef);

  const updates: any = {
    grantedBy: lecturerId,
    grantedAt: serverTimestamp()
  };

  if (permissionType === 'microphone' || permissionType === 'both') {
    updates.micPermission = true;
  }
  if (permissionType === 'camera' || permissionType === 'both') {
    updates.cameraPermission = true;
  }

  console.log(`[Lecturer] Granting ${permissionType} to ${participantId}...`, updates);
  try {
    await setDoc(permDocRef, updates, { merge: true });
    console.log(`[Lecturer] Successfully granted permission to ${participantId}!`);
  } catch (err) {
    console.error(`[Lecturer] Failed to grant permission to ${participantId}:`, err);
  }

  // Resolve the pending request if it exists
  const requestDocRef = doc(db, 'sessions', sessionId, 'permission_requests', participantId);
  // We just delete it upon granting to clear it from the queue
  await deleteDoc(requestDocRef).catch(() => { });
};

// Deny request (Lecturer)
export const denyPermission = async (
  sessionId: string,
  participantId: string
) => {
  const requestDocRef = doc(db, 'sessions', sessionId, 'permission_requests', participantId);
  await deleteDoc(requestDocRef).catch(() => { });
};

// Revoke permission (Lecturer)
export const revokePermission = async (
  sessionId: string,
  participantId: string,
  permissionType: PermissionType
) => {
  const permDocRef = doc(db, 'sessions', sessionId, 'permissions', participantId);

  const updates: any = {};
  if (permissionType === 'microphone' || permissionType === 'both') {
    updates.micPermission = false;
  }
  if (permissionType === 'camera' || permissionType === 'both') {
    updates.cameraPermission = false;
  }

  await updateDoc(permDocRef, updates).catch(() => { });
};

// Optional: Grant to all (Lecturer)
export const grantAllPermissions = async (
  sessionId: string,
  lecturerId: string,
  participantIds: string[],
  permissionType: PermissionType
) => {
  // Note: in a real large-scale app (300+), batch writes are better,
  // but for simplicity we'll just loop and grant.
  const promises = participantIds.map(pid => grantPermission(sessionId, pid, lecturerId, permissionType));
  await Promise.all(promises);
};
// Revoke from all (Lecturer)
export const revokeAllPermissions = async (
  sessionId: string,
  participantIds: string[],
  permissionType: PermissionType
) => {
  const promises = participantIds.map(pid => revokePermission(sessionId, pid, permissionType));
  await Promise.all(promises);
};
