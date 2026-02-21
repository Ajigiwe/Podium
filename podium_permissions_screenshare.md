# Permission-Based Audio/Video Access & Persistent Screen Share

## Overview

Two major features:
1. **Permission-based access** - Students must request permission to unmute mic/camera
2. **Persistent screen share** - Screen share continues after network reconnection

---

## Feature 1: Permission-Based Mic/Camera Access

### Database Schema

```sql
-- Participant permissions table
CREATE TABLE participant_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(255) NOT NULL,
  participant_id VARCHAR(255) NOT NULL,
  mic_permission BOOLEAN DEFAULT false,
  camera_permission BOOLEAN DEFAULT false,
  granted_by VARCHAR(255),  -- Lecturer ID who granted permission
  granted_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(room_id, participant_id)
);

-- Permission requests table
CREATE TABLE permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(255) NOT NULL,
  participant_id VARCHAR(255) NOT NULL,
  participant_name VARCHAR(255) NOT NULL,
  request_type VARCHAR(50) NOT NULL,  -- 'microphone', 'camera', 'both'
  status VARCHAR(50) DEFAULT 'pending',  -- pending, approved, denied
  requested_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  responded_by VARCHAR(255)  -- Lecturer ID
);

CREATE INDEX idx_permissions_room ON participant_permissions(room_id);
CREATE INDEX idx_requests_room_status ON permission_requests(room_id, status);
```

---

## Backend API Routes

### 1. Check Permissions on Join

```typescript
// api/permissions/check/route.ts
export async function POST(request: Request) {
  const { roomId, participantId, isLecturer } = await request.json();

  try {
    // Lecturers have full permissions automatically
    if (isLecturer) {
      return Response.json({
        success: true,
        micPermission: true,
        cameraPermission: true,
      });
    }

    // Check student permissions
    const permissions = await db.participant_permissions.findUnique({
      where: {
        room_id_participant_id: {
          room_id: roomId,
          participant_id: participantId,
        }
      }
    });

    return Response.json({
      success: true,
      micPermission: permissions?.mic_permission || false,
      cameraPermission: permissions?.camera_permission || false,
    });

  } catch (error) {
    console.error('Failed to check permissions:', error);
    return Response.json({ error: 'Failed to check permissions' }, { status: 500 });
  }
}
```

### 2. Request Permission

```typescript
// api/permissions/request/route.ts
export async function POST(request: Request) {
  const { roomId, participantId, participantName, requestType } = await request.json();

  try {
    // Create permission request
    const request = await db.permission_requests.create({
      room_id: roomId,
      participant_id: participantId,
      participant_name: participantName,
      request_type: requestType,  // 'microphone', 'camera', 'both'
      status: 'pending',
      requested_at: new Date(),
    });

    // Broadcast to lecturer via data channel
    await broadcastToLecturer(roomId, {
      type: 'PERMISSION_REQUEST',
      requestId: request.id,
      participantId,
      participantName,
      requestType,
    });

    return Response.json({
      success: true,
      requestId: request.id,
      message: 'Permission request sent to lecturer',
    });

  } catch (error) {
    console.error('Failed to request permission:', error);
    return Response.json({ error: 'Failed to request permission' }, { status: 500 });
  }
}
```

### 3. Grant Permission

```typescript
// api/permissions/grant/route.ts
export async function POST(request: Request) {
  const { roomId, participantIds, lecturerId, permissionType, grantAll } = await request.json();

  try {
    const participantsToGrant = grantAll 
      ? await getAllStudentsInRoom(roomId)
      : participantIds;

    // Update permissions for each participant
    for (const participantId of participantsToGrant) {
      await db.participant_permissions.upsert({
        where: {
          room_id_participant_id: {
            room_id: roomId,
            participant_id: participantId,
          }
        },
        update: {
          mic_permission: permissionType === 'microphone' || permissionType === 'both',
          camera_permission: permissionType === 'camera' || permissionType === 'both',
          granted_by: lecturerId,
          granted_at: new Date(),
          updated_at: new Date(),
        },
        create: {
          room_id: roomId,
          participant_id: participantId,
          mic_permission: permissionType === 'microphone' || permissionType === 'both',
          camera_permission: permissionType === 'camera' || permissionType === 'both',
          granted_by: lecturerId,
          granted_at: new Date(),
        }
      });

      // Update any pending requests
      await db.permission_requests.updateMany({
        where: {
          room_id: roomId,
          participant_id: participantId,
          status: 'pending',
        },
        data: {
          status: 'approved',
          responded_at: new Date(),
          responded_by: lecturerId,
        }
      });
    }

    // Broadcast permission grant to affected participants
    await broadcastPermissionGrant(roomId, participantsToGrant, permissionType);

    return Response.json({
      success: true,
      message: grantAll 
        ? 'Permissions granted to all students'
        : `Permissions granted to ${participantsToGrant.length} student(s)`,
    });

  } catch (error) {
    console.error('Failed to grant permission:', error);
    return Response.json({ error: 'Failed to grant permission' }, { status: 500 });
  }
}
```

### 4. Revoke Permission

```typescript
// api/permissions/revoke/route.ts
export async function POST(request: Request) {
  const { roomId, participantId, permissionType } = await request.json();

  try {
    await db.participant_permissions.update({
      where: {
        room_id_participant_id: {
          room_id: roomId,
          participant_id: participantId,
        }
      },
      data: {
        mic_permission: permissionType === 'microphone' ? false : undefined,
        camera_permission: permissionType === 'camera' ? false : undefined,
        updated_at: new Date(),
      }
    });

    // Broadcast permission revocation
    await broadcastPermissionRevoked(roomId, participantId, permissionType);

    return Response.json({
      success: true,
      message: 'Permission revoked',
    });

  } catch (error) {
    console.error('Failed to revoke permission:', error);
    return Response.json({ error: 'Failed to revoke permission' }, { status: 500 });
  }
}
```

---

## Frontend Implementation

### 1. Permission Manager Hook

```typescript
// hooks/usePermissions.ts
import { useEffect, useState, useCallback } from 'react';
import { useLocalParticipant, useDataChannel } from '@livekit/components-react';

interface Permissions {
  mic: boolean;
  camera: boolean;
}

export const usePermissions = (roomId: string, isLecturer: boolean) => {
  const { localParticipant } = useLocalParticipant();
  const [permissions, setPermissions] = useState<Permissions>({
    mic: isLecturer,  // Lecturers have permission by default
    camera: isLecturer,
  });
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  // Load permissions on mount
  useEffect(() => {
    if (!localParticipant || isLecturer) return;

    const checkPermissions = async () => {
      try {
        const response = await fetch('/api/permissions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            participantId: localParticipant.identity,
            isLecturer,
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          setPermissions({
            mic: data.micPermission,
            camera: data.cameraPermission,
          });

          // If no permissions, ensure mic and camera are off
          if (!data.micPermission) {
            await localParticipant.setMicrophoneEnabled(false);
          }
          if (!data.cameraPermission) {
            await localParticipant.setCameraEnabled(false);
          }
        }
      } catch (error) {
        console.error('Failed to check permissions:', error);
      }
    };

    checkPermissions();
  }, [localParticipant, roomId, isLecturer]);

  // Listen for permission grants
  useEffect(() => {
    if (!localParticipant) return;

    const handlePermissionMessage = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        
        if (data.type === 'PERMISSION_GRANTED' && 
            data.participantId === localParticipant.identity) {
          
          console.log('✅ Permission granted:', data.permissionType);
          
          setPermissions(prev => ({
            ...prev,
            mic: data.permissionType === 'microphone' || data.permissionType === 'both' ? true : prev.mic,
            camera: data.permissionType === 'camera' || data.permissionType === 'both' ? true : prev.camera,
          }));

          setHasPendingRequest(false);
        }

        if (data.type === 'PERMISSION_REVOKED' && 
            data.participantId === localParticipant.identity) {
          
          console.log('❌ Permission revoked:', data.permissionType);
          
          setPermissions(prev => ({
            ...prev,
            mic: data.permissionType === 'microphone' ? false : prev.mic,
            camera: data.permissionType === 'camera' ? false : prev.camera,
          }));

          // Force mute
          if (data.permissionType === 'microphone' || data.permissionType === 'both') {
            localParticipant.setMicrophoneEnabled(false);
          }
          if (data.permissionType === 'camera' || data.permissionType === 'both') {
            localParticipant.setCameraEnabled(false);
          }
        }
      } catch (error) {
        console.error('Error handling permission message:', error);
      }
    };

    // Subscribe to data channel
    // Implementation depends on your LiveKit setup

    return () => {
      // Cleanup
    };
  }, [localParticipant]);

  const requestPermission = useCallback(async (type: 'microphone' | 'camera' | 'both') => {
    if (!localParticipant || isLecturer) return;

    setHasPendingRequest(true);

    try {
      const response = await fetch('/api/permissions/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          participantId: localParticipant.identity,
          participantName: localParticipant.name || 'Student',
          requestType: type,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Permission request sent');
      }
    } catch (error) {
      console.error('Failed to request permission:', error);
      setHasPendingRequest(false);
    }
  }, [localParticipant, roomId, isLecturer]);

  return {
    permissions,
    hasPendingRequest,
    requestPermission,
  };
};
```

### 2. Student Control Bar with Permission Requests

```typescript
// components/StudentControlBar.tsx
import { useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Mic, MicOff, Video, VideoOff, Hand } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

export const StudentControlBar = ({ roomId }: { roomId: string }) => {
  const { localParticipant } = useLocalParticipant();
  const { permissions, hasPendingRequest, requestPermission } = usePermissions(roomId, false);

  const isMicEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const isCameraEnabled = localParticipant?.isCameraEnabled ?? false;

  const toggleMic = async () => {
    if (!localParticipant) return;

    if (!permissions.mic) {
      // Request permission
      await requestPermission('microphone');
      return;
    }

    // Toggle normally if has permission
    await localParticipant.setMicrophoneEnabled(!isMicEnabled);
  };

  const toggleCamera = async () => {
    if (!localParticipant) return;

    if (!permissions.camera) {
      // Request permission
      await requestPermission('camera');
      return;
    }

    // Toggle normally if has permission
    await localParticipant.setCameraEnabled(!isCameraEnabled);
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="flex gap-3 bg-gray-900/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-2xl border border-gray-700">
        
        {/* Microphone */}
        <div className="relative">
          <button
            onClick={toggleMic}
            className={`p-4 rounded-full transition-all ${
              isMicEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : permissions.mic
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-800 text-gray-500'
            }`}
            title={
              !permissions.mic 
                ? 'Request microphone permission' 
                : isMicEnabled 
                ? 'Mute microphone' 
                : 'Unmute microphone'
            }
          >
            {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          
          {/* Permission Lock Indicator */}
          {!permissions.mic && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}

          {/* Pending Request Indicator */}
          {hasPendingRequest && !permissions.mic && (
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
              <span className="text-xs text-yellow-400">Requesting...</span>
            </div>
          )}
        </div>

        {/* Camera */}
        <div className="relative">
          <button
            onClick={toggleCamera}
            className={`p-4 rounded-full transition-all ${
              isCameraEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : permissions.camera
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-800 text-gray-500'
            }`}
            title={
              !permissions.camera 
                ? 'Request camera permission' 
                : isCameraEnabled 
                ? 'Turn off camera' 
                : 'Turn on camera'
            }
          >
            {isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Permission Lock Indicator */}
          {!permissions.camera && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Raise Hand */}
        <button className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white">
          <Hand className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
```

### 3. Lecturer Permission Manager Panel

```typescript
// components/LecturerPermissionPanel.tsx
import { useState, useEffect } from 'react';
import { useParticipants } from '@livekit/components-react';
import { UserCheck, Users, Mic, Video, Check, X } from 'lucide-react';

interface PermissionRequest {
  id: string;
  participantId: string;
  participantName: string;
  requestType: string;
  requestedAt: string;
}

export const LecturerPermissionPanel = ({ roomId, lecturerId }: { roomId: string; lecturerId: string }) => {
  const participants = useParticipants();
  const [pendingRequests, setPendingRequests] = useState<PermissionRequest[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  // Listen for permission requests
  useEffect(() => {
    const handlePermissionRequest = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        
        if (data.type === 'PERMISSION_REQUEST') {
          setPendingRequests(prev => [...prev, {
            id: data.requestId,
            participantId: data.participantId,
            participantName: data.participantName,
            requestType: data.requestType,
            requestedAt: new Date().toISOString(),
          }]);

          // Auto-show panel when request comes in
          setShowPanel(true);
        }
      } catch (error) {
        console.error('Error handling permission request:', error);
      }
    };

    // Subscribe to data channel messages
    // Implementation depends on your LiveKit setup

    return () => {
      // Cleanup
    };
  }, []);

  const grantPermission = async (participantId: string, requestType: string) => {
    try {
      await fetch('/api/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          participantIds: [participantId],
          lecturerId,
          permissionType: requestType,
          grantAll: false,
        }),
      });

      // Remove from pending requests
      setPendingRequests(prev => prev.filter(r => r.participantId !== participantId));
    } catch (error) {
      console.error('Failed to grant permission:', error);
    }
  };

  const grantAllPermissions = async () => {
    try {
      await fetch('/api/permissions/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          lecturerId,
          permissionType: 'both',
          grantAll: true,
        }),
      });

      setPendingRequests([]);
    } catch (error) {
      console.error('Failed to grant all permissions:', error);
    }
  };

  const denyRequest = (participantId: string) => {
    setPendingRequests(prev => prev.filter(r => r.participantId !== participantId));
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="fixed top-24 left-4 z-40 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 font-medium"
      >
        <UserCheck className="w-5 h-5" />
        Permissions
        {pendingRequests.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pendingRequests.length}
          </span>
        )}
      </button>

      {/* Permission Panel */}
      {showPanel && (
        <div className="fixed top-40 left-4 z-40 w-96 bg-gray-900 rounded-xl shadow-2xl border border-gray-700 max-h-96 overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-white font-bold">Permission Requests</h3>
            <button
              onClick={() => setShowPanel(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grant All Button */}
          {participants.length > 1 && (
            <div className="p-4 border-b border-gray-700">
              <button
                onClick={grantAllPermissions}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5" />
                Grant All Students Full Access
              </button>
            </div>
          )}

          {/* Pending Requests List */}
          <div className="flex-1 overflow-y-auto">
            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No pending requests
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-white font-semibold">{request.participantName}</p>
                        <p className="text-gray-400 text-sm">
                          Requesting {request.requestType}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {request.requestType.includes('microphone') && (
                          <Mic className="w-4 h-4 text-blue-400" />
                        )}
                        {request.requestType.includes('camera') && (
                          <Video className="w-4 h-4 text-purple-400" />
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => grantPermission(request.participantId, request.requestType)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Grant
                      </button>
                      <button
                        onClick={() => denyRequest(request.participantId)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
```

---

## Feature 2: Persistent Screen Share After Reconnection

### Enhanced Connection Recovery Hook

```typescript
// hooks/useScreenSharePersistence.ts
import { useEffect, useRef } from 'react';
import { useLocalParticipant, useRoomContext, ConnectionState } from '@livekit/components-react';

export const useScreenSharePersistence = () => {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const wasScreenSharingRef = useRef(false);
  const screenShareStreamRef = useRef<MediaStream | null>(null);

  // Save screen share state
  useEffect(() => {
    if (!localParticipant) return;

    const saveScreenShareState = () => {
      const isScreenSharing = localParticipant.isScreenShareEnabled;
      wasScreenSharingRef.current = isScreenSharing;

      if (isScreenSharing) {
        // Try to get reference to screen share track
        const screenTrack = Array.from(localParticipant.videoTrackPublications.values())
          .find(pub => pub.source === 'screen_share');
        
        if (screenTrack?.track) {
          console.log('📺 Saving screen share state');
        }
      }

      // Save to localStorage as backup
      localStorage.setItem('podium_was_screen_sharing', String(isScreenSharing));
    };

    // Save state periodically
    const interval = setInterval(saveScreenShareState, 2000);

    // Save on connection changes
    const handleConnectionChange = (state: ConnectionState) => {
      if (state === ConnectionState.Reconnecting) {
        saveScreenShareState();
      }
    };

    room?.on('connectionStateChanged', handleConnectionChange);

    return () => {
      clearInterval(interval);
      room?.off('connectionStateChanged', handleConnectionChange);
    };
  }, [localParticipant, room]);

  // Restore screen share after reconnection
  useEffect(() => {
    if (!localParticipant || !room) return;

    const handleReconnected = async () => {
      console.log('✅ Connection restored, checking screen share...');

      // Wait a moment for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check if was screen sharing before disconnect
      const wasSharing = wasScreenSharingRef.current || 
                        localStorage.getItem('podium_was_screen_sharing') === 'true';

      if (wasSharing && !localParticipant.isScreenShareEnabled) {
        console.log('🔄 Restoring screen share...');

        try {
          // Request screen share again
          // Note: This will prompt user to select screen again - unavoidable browser security
          await localParticipant.setScreenShareEnabled(true);
          
          console.log('✅ Screen share restored');
          
          // Show notification to user
          showScreenShareRestoreNotification();

        } catch (error) {
          console.error('❌ Failed to restore screen share:', error);
          
          // Show manual restore prompt
          showManualScreenSharePrompt();
        }
      }
    };

    const handleConnectionChange = (state: ConnectionState) => {
      if (state === ConnectionState.Connected && 
          room.state === ConnectionState.Reconnecting) {
        handleReconnected();
      }
    };

    room.on('connectionStateChanged', handleConnectionChange);

    return () => {
      room.off('connectionStateChanged', handleConnectionChange);
    };
  }, [localParticipant, room]);
};

// Notification helpers
function showScreenShareRestoreNotification() {
  // Create toast notification
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-xl z-50 animate-slide-in';
  notification.innerHTML = `
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12zm-1-5h2v2H9v-2zm0-6h2v4H9V5z"/>
      </svg>
      <span>Screen share restored</span>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function showManualScreenSharePrompt() {
  // Show prompt for user to manually restart screen share
  const prompt = document.createElement('div');
  prompt.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-600 text-white px-6 py-4 rounded-lg shadow-xl z-50 max-w-md';
  prompt.innerHTML = `
    <div class="flex items-start gap-3">
      <svg class="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
      <div>
        <p class="font-bold mb-1">Screen share was disconnected</p>
        <p class="text-sm">Click the screen share button to resume presenting</p>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-auto text-white hover:text-yellow-200">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
        </svg>
      </button>
    </div>
  `;
  document.body.appendChild(prompt);
  
  setTimeout(() => {
    prompt.remove();
  }, 10000);
}
```

### Alternative: Keep Screen Share Stream Alive

```typescript
// hooks/useScreenShareKeepAlive.ts
import { useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';

export const useScreenShareKeepAlive = () => {
  const { localParticipant } = useLocalParticipant();
  const screenStreamRef = useRef<MediaStream | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!localParticipant) return;

    // Monitor screen share state
    const checkScreenShare = () => {
      if (localParticipant.isScreenShareEnabled) {
        // Get screen share track
        const screenPublication = Array.from(localParticipant.videoTrackPublications.values())
          .find(pub => pub.source === 'screen_share');

        if (screenPublication?.track?.mediaStreamTrack) {
          const stream = new MediaStream([screenPublication.track.mediaStreamTrack]);
          screenStreamRef.current = stream;
          
          // Keep stream reference alive
          console.log('📺 Screen share stream captured');
        }
      } else {
        screenStreamRef.current = null;
      }
    };

    // Check periodically
    keepAliveIntervalRef.current = setInterval(checkScreenShare, 1000);

    return () => {
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
    };
  }, [localParticipant]);

  // Attempt to maintain screen share during reconnection
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save screen share state
      if (localParticipant?.isScreenShareEnabled) {
        sessionStorage.setItem('podium_screen_share_active', 'true');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [localParticipant]);
};
```

---

## Integration in Room Component

```typescript
// app/room/[roomId]/page.tsx
import { LiveKitRoom } from '@livekit/components-react';
import { StudentControlBar } from '@/components/StudentControlBar';
import { LecturerPermissionPanel } from '@/components/LecturerPermissionPanel';
import { usePermissions } from '@/hooks/usePermissions';
import { useScreenSharePersistence } from '@/hooks/useScreenSharePersistence';
import { useEffect } from 'react';

export default function RoomPage({ roomId, userId, userRole }: RoomPageProps) {
  const isLecturer = userRole === 'lecturer';

  // Enable permission management
  usePermissions(roomId, isLecturer);

  // Enable screen share persistence
  useScreenSharePersistence();

  return (
    <LiveKitRoom
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
      token={/* your token */}
      connect={true}
      className="h-screen w-screen"
      options={{
        // Important: Configure to restore tracks
        reconnectPolicy: {
          maxRetries: 0, // Infinite retries
          initialDelay: 1000,
          maxDelay: 30000,
          backoffFactor: 1.5,
        },
        // Don't stop tracks on mute
        publishDefaults: {
          stopMicTrackOnMute: false,
        },
      }}
    >
      {/* Lecturer: Permission Manager */}
      {isLecturer && (
        <LecturerPermissionPanel roomId={roomId} lecturerId={userId} />
      )}

      {/* Student: Permission-based controls */}
      {!isLecturer && (
        <StudentControlBar roomId={roomId} />
      )}

      {/* Video Grid */}
      <VideoGrid />
    </LiveKitRoom>
  );
}
```

---

## Important Notes

### Screen Share Limitation
**Browser security prevents automatic screen share restoration.** Even with these solutions:

1. ❌ Cannot automatically resume screen share without user interaction
2. ✅ Can detect when it was active and prompt user
3. ✅ Can auto-click the screen share button (requires user to select screen again)
4. ✅ Can show prominent notification to manually resume

**Best approach**: Show clear notification prompting lecturer to click screen share button again.

### Permission System Flow
1. Student joins → Mic/camera automatically muted
2. Student clicks mic/camera → Sends request to lecturer
3. Lecturer sees notification → Grants/denies
4. Student receives permission → Can now toggle mic/camera
5. Lecturer can revoke permission anytime

---

## Testing Checklist

- [ ] Students join with mic/camera muted
- [ ] Students see lock icon on mic/camera buttons
- [ ] Permission requests appear in lecturer panel
- [ ] Lecturer can grant individual permissions
- [ ] Lecturer can grant all at once
- [ ] Students can toggle after permission granted
- [ ] Screen share state saved during network issues
- [ ] Notification shown when screen share disconnects
- [ ] Lecturer can easily resume screen share

This gives you full control over student audio/video while maintaining screen share continuity! 🎯
