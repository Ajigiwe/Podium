# Co-Host Feature Implementation

## Overview

Allow the main host to assign co-hosts who have the same moderator privileges. Multiple co-hosts can be active simultaneously, all with equal control over the classroom.

---

## Database Schema Updates

### Update Moderator Types

```sql
-- Modify class_moderators table to include co-host type
ALTER TABLE class_moderators 
  DROP CONSTRAINT IF EXISTS moderator_type_check;

ALTER TABLE class_moderators
  ADD CONSTRAINT moderator_type_check 
  CHECK (moderator_type IN ('host', 'co-host', 'backup'));

-- Add priority field for hierarchy
ALTER TABLE class_moderators
  ADD COLUMN priority INT DEFAULT 2;
  -- priority: 0 = host, 1 = co-host, 2 = backup

-- Update existing records
UPDATE class_moderators 
SET priority = CASE 
  WHEN moderator_type = 'host' THEN 0
  WHEN moderator_type = 'backup' THEN 2
  ELSE 2
END;

-- Add index for faster queries
CREATE INDEX idx_moderators_priority ON class_moderators(session_id, priority, is_active);
```

### Co-Host Management Table (Optional - for detailed tracking)

```sql
-- Track co-host assignments and their permissions
CREATE TABLE co_host_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES class_sessions(id) ON DELETE CASCADE,
  co_host_id VARCHAR(255) NOT NULL,
  co_host_name VARCHAR(255) NOT NULL,
  assigned_by VARCHAR(255) NOT NULL,  -- Host who assigned them
  assigned_at TIMESTAMP DEFAULT NOW(),
  
  -- Specific permissions (all true for co-hosts, but allows granular control)
  can_mute_participants BOOLEAN DEFAULT true,
  can_remove_participants BOOLEAN DEFAULT true,
  can_grant_permissions BOOLEAN DEFAULT true,
  can_record BOOLEAN DEFAULT true,
  can_manage_attendance BOOLEAN DEFAULT true,
  can_assign_backup_mods BOOLEAN DEFAULT true,
  can_assign_cohosts BOOLEAN DEFAULT false,  -- Only host can assign co-hosts
  
  is_active BOOLEAN DEFAULT true,
  removed_at TIMESTAMP,
  removed_by VARCHAR(255),
  
  UNIQUE(session_id, co_host_id)
);

CREATE INDEX idx_cohost_session ON co_host_permissions(session_id, is_active);
```

---

## Backend API Routes

### 1. Assign Co-Host

```typescript
// api/moderators/assign-cohost/route.ts
export async function POST(request: Request) {
  const { sessionId, hostUserId, targetUserId, targetUserName } = await request.json();

  try {
    // Verify requester is the main host
    const requesterMod = await db.class_moderators.findFirst({
      where: {
        session_id: sessionId,
        user_id: hostUserId,
        moderator_type: 'host',  // Must be main host
        is_active: true,
      }
    });

    if (!requesterMod) {
      return Response.json({ 
        error: 'Only the main host can assign co-hosts' 
      }, { status: 403 });
    }

    // Check if target is already a moderator
    const existingMod = await db.class_moderators.findFirst({
      where: {
        session_id: sessionId,
        user_id: targetUserId,
      }
    });

    if (existingMod) {
      // Upgrade existing moderator to co-host
      await db.class_moderators.update({
        where: { id: existingMod.id },
        data: {
          moderator_type: 'co-host',
          priority: 1,
          is_active: true,
          assigned_by: hostUserId,
          assigned_at: new Date(),
        }
      });
    } else {
      // Create new co-host
      await db.class_moderators.create({
        session_id: sessionId,
        user_id: targetUserId,
        user_name: targetUserName,
        moderator_type: 'co-host',
        priority: 1,
        assigned_by: hostUserId,
        is_active: true,
      });
    }

    // Create detailed permissions record
    await db.co_host_permissions.upsert({
      where: {
        session_id_co_host_id: {
          session_id: sessionId,
          co_host_id: targetUserId,
        }
      },
      update: {
        is_active: true,
        assigned_by: hostUserId,
        assigned_at: new Date(),
      },
      create: {
        session_id: sessionId,
        co_host_id: targetUserId,
        co_host_name: targetUserName,
        assigned_by: hostUserId,
        // All permissions true by default
        can_mute_participants: true,
        can_remove_participants: true,
        can_grant_permissions: true,
        can_record: true,
        can_manage_attendance: true,
        can_assign_backup_mods: true,
        can_assign_cohosts: false,  // Only host assigns co-hosts
      }
    });

    // Log action
    await db.moderator_actions.create({
      session_id: sessionId,
      moderator_id: hostUserId,
      action_type: 'assign_cohost',
      target_user_id: targetUserId,
      metadata: { 
        co_host_name: targetUserName,
        permissions: 'full'
      },
    });

    // Broadcast to the new co-host
    await broadcastToUser(sessionId, targetUserId, {
      type: 'COHOST_ASSIGNED',
      message: 'You are now a co-host with full classroom control',
      permissions: {
        can_mute: true,
        can_remove: true,
        can_grant_permissions: true,
        can_record: true,
        can_manage_attendance: true,
      }
    });

    // Broadcast to all participants
    await broadcastToAll(sessionId, {
      type: 'COHOST_ADDED',
      coHostId: targetUserId,
      coHostName: targetUserName,
    });

    return Response.json({
      success: true,
      message: `${targetUserName} is now a co-host`,
    });

  } catch (error) {
    console.error('Failed to assign co-host:', error);
    return Response.json({ error: 'Failed to assign co-host' }, { status: 500 });
  }
}
```

### 2. Remove Co-Host

```typescript
// api/moderators/remove-cohost/route.ts
export async function POST(request: Request) {
  const { sessionId, hostUserId, coHostUserId } = await request.json();

  try {
    // Verify requester is the main host
    const requesterMod = await db.class_moderators.findFirst({
      where: {
        session_id: sessionId,
        user_id: hostUserId,
        moderator_type: 'host',
        is_active: true,
      }
    });

    if (!requesterMod) {
      return Response.json({ 
        error: 'Only the main host can remove co-hosts' 
      }, { status: 403 });
    }

    // Verify target is a co-host
    const coHostMod = await db.class_moderators.findFirst({
      where: {
        session_id: sessionId,
        user_id: coHostUserId,
        moderator_type: 'co-host',
        is_active: true,
      }
    });

    if (!coHostMod) {
      return Response.json({ 
        error: 'User is not a co-host' 
      }, { status: 400 });
    }

    // Deactivate co-host
    await db.class_moderators.update({
      where: { id: coHostMod.id },
      data: {
        is_active: false,
      }
    });

    // Update permissions record
    await db.co_host_permissions.updateMany({
      where: {
        session_id: sessionId,
        co_host_id: coHostUserId,
      },
      data: {
        is_active: false,
        removed_at: new Date(),
        removed_by: hostUserId,
      }
    });

    // Log action
    await db.moderator_actions.create({
      session_id: sessionId,
      moderator_id: hostUserId,
      action_type: 'remove_cohost',
      target_user_id: coHostUserId,
    });

    // Notify removed co-host
    await broadcastToUser(sessionId, coHostUserId, {
      type: 'COHOST_REMOVED',
      message: 'You have been removed as co-host',
    });

    // Broadcast to all
    await broadcastToAll(sessionId, {
      type: 'COHOST_REMOVED',
      coHostId: coHostUserId,
    });

    return Response.json({
      success: true,
      message: 'Co-host removed',
    });

  } catch (error) {
    console.error('Failed to remove co-host:', error);
    return Response.json({ error: 'Failed to remove co-host' }, { status: 500 });
  }
}
```

### 3. List Co-Hosts

```typescript
// api/moderators/cohosts/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return Response.json({ error: 'Session ID required' }, { status: 400 });
  }

  try {
    const coHosts = await db.class_moderators.findMany({
      where: {
        session_id: sessionId,
        moderator_type: 'co-host',
        is_active: true,
      },
      orderBy: {
        assigned_at: 'asc',
      }
    });

    return Response.json({
      success: true,
      coHosts: coHosts.map(ch => ({
        userId: ch.user_id,
        userName: ch.user_name,
        assignedAt: ch.assigned_at,
        assignedBy: ch.assigned_by,
      })),
    });

  } catch (error) {
    console.error('Failed to list co-hosts:', error);
    return Response.json({ error: 'Failed to list co-hosts' }, { status: 500 });
  }
}
```

### 4. Check Co-Host Permissions

```typescript
// api/moderators/check-permissions/route.ts
export async function POST(request: Request) {
  const { sessionId, userId } = await request.json();

  try {
    // Check if user is host or co-host
    const moderator = await db.class_moderators.findFirst({
      where: {
        session_id: sessionId,
        user_id: userId,
        is_active: true,
        moderator_type: {
          in: ['host', 'co-host']
        }
      }
    });

    if (!moderator) {
      return Response.json({
        success: true,
        isModerator: false,
        isHost: false,
        isCoHost: false,
        permissions: {},
      });
    }

    const isHost = moderator.moderator_type === 'host';
    const isCoHost = moderator.moderator_type === 'co-host';

    // Get detailed permissions if co-host
    let permissions = {};
    if (isCoHost) {
      const coHostPerms = await db.co_host_permissions.findFirst({
        where: {
          session_id: sessionId,
          co_host_id: userId,
          is_active: true,
        }
      });

      permissions = {
        can_mute_participants: coHostPerms?.can_mute_participants ?? true,
        can_remove_participants: coHostPerms?.can_remove_participants ?? true,
        can_grant_permissions: coHostPerms?.can_grant_permissions ?? true,
        can_record: coHostPerms?.can_record ?? true,
        can_manage_attendance: coHostPerms?.can_manage_attendance ?? true,
        can_assign_backup_mods: coHostPerms?.can_assign_backup_mods ?? true,
        can_assign_cohosts: false,  // Only host can assign co-hosts
      };
    } else if (isHost) {
      // Host has all permissions
      permissions = {
        can_mute_participants: true,
        can_remove_participants: true,
        can_grant_permissions: true,
        can_record: true,
        can_manage_attendance: true,
        can_assign_backup_mods: true,
        can_assign_cohosts: true,  // Only host
      };
    }

    return Response.json({
      success: true,
      isModerator: true,
      isHost,
      isCoHost,
      moderatorType: moderator.moderator_type,
      permissions,
    });

  } catch (error) {
    console.error('Failed to check permissions:', error);
    return Response.json({ error: 'Failed to check permissions' }, { status: 500 });
  }
}
```

---

## Frontend Implementation

### 1. Enhanced Moderator Hook

```typescript
// hooks/useModeratorStatus.ts
import { useEffect, useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';

interface ModeratorStatus {
  isModerator: boolean;
  isHost: boolean;
  isCoHost: boolean;
  moderatorType: 'host' | 'co-host' | 'backup' | null;
  permissions: {
    can_mute_participants: boolean;
    can_remove_participants: boolean;
    can_grant_permissions: boolean;
    can_record: boolean;
    can_manage_attendance: boolean;
    can_assign_backup_mods: boolean;
    can_assign_cohosts: boolean;
  };
}

export const useModeratorStatus = (sessionId: string) => {
  const { localParticipant } = useLocalParticipant();
  const [status, setStatus] = useState<ModeratorStatus>({
    isModerator: false,
    isHost: false,
    isCoHost: false,
    moderatorType: null,
    permissions: {
      can_mute_participants: false,
      can_remove_participants: false,
      can_grant_permissions: false,
      can_record: false,
      can_manage_attendance: false,
      can_assign_backup_mods: false,
      can_assign_cohosts: false,
    },
  });

  useEffect(() => {
    if (!localParticipant) return;

    const checkPermissions = async () => {
      try {
        const response = await fetch('/api/moderators/check-permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userId: localParticipant.identity,
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          setStatus({
            isModerator: data.isModerator,
            isHost: data.isHost,
            isCoHost: data.isCoHost,
            moderatorType: data.moderatorType,
            permissions: data.permissions || {},
          });
        }
      } catch (error) {
        console.error('Failed to check moderator status:', error);
      }
    };

    checkPermissions();

    // Listen for co-host assignment/removal
    const handleModeratorMessage = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        
        if (data.type === 'COHOST_ASSIGNED' && 
            localParticipant.identity === data.coHostId) {
          // Refresh permissions
          checkPermissions();
        }

        if (data.type === 'COHOST_REMOVED' && 
            localParticipant.identity === data.coHostId) {
          // Revoke permissions
          setStatus({
            isModerator: false,
            isHost: false,
            isCoHost: false,
            moderatorType: null,
            permissions: {
              can_mute_participants: false,
              can_remove_participants: false,
              can_grant_permissions: false,
              can_record: false,
              can_manage_attendance: false,
              can_assign_backup_mods: false,
              can_assign_cohosts: false,
            },
          });
        }
      } catch (error) {
        console.error('Error handling moderator message:', error);
      }
    };

    // Subscribe to data channel
    // Implementation depends on your LiveKit setup

    return () => {
      // Cleanup
    };
  }, [localParticipant, sessionId]);

  return status;
};
```

### 2. Co-Host Management Panel

```typescript
// components/CoHostManagementPanel.tsx
import { useState, useEffect } from 'react';
import { useParticipants } from '@livekit/components-react';
import { UserPlus, UserMinus, Crown, Shield, X } from 'lucide-react';

interface CoHost {
  userId: string;
  userName: string;
  assignedAt: string;
  assignedBy: string;
}

interface CoHostManagementPanelProps {
  sessionId: string;
  hostUserId: string;
  isHost: boolean;
}

export const CoHostManagementPanel = ({ 
  sessionId, 
  hostUserId, 
  isHost 
}: CoHostManagementPanelProps) => {
  const [showPanel, setShowPanel] = useState(false);
  const [coHosts, setCoHosts] = useState<CoHost[]>([]);
  const participants = useParticipants();

  // Load co-hosts
  useEffect(() => {
    if (!showPanel) return;

    const loadCoHosts = async () => {
      try {
        const response = await fetch(
          `/api/moderators/cohosts?sessionId=${sessionId}`
        );
        const data = await response.json();
        
        if (data.success) {
          setCoHosts(data.coHosts);
        }
      } catch (error) {
        console.error('Failed to load co-hosts:', error);
      }
    };

    loadCoHosts();

    // Refresh every 30 seconds
    const interval = setInterval(loadCoHosts, 30000);
    return () => clearInterval(interval);
  }, [sessionId, showPanel]);

  const assignCoHost = async (userId: string, userName: string) => {
    try {
      const response = await fetch('/api/moderators/assign-cohost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          hostUserId,
          targetUserId: userId,
          targetUserName: userName,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh co-hosts list
        const refreshResponse = await fetch(
          `/api/moderators/cohosts?sessionId=${sessionId}`
        );
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setCoHosts(refreshData.coHosts);
        }

        alert(`✅ ${userName} is now a co-host`);
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to assign co-host:', error);
      alert('Failed to assign co-host');
    }
  };

  const removeCoHost = async (userId: string, userName: string) => {
    if (!confirm(`Remove ${userName} as co-host?`)) return;

    try {
      const response = await fetch('/api/moderators/remove-cohost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          hostUserId,
          coHostUserId: userId,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setCoHosts(prev => prev.filter(ch => ch.userId !== userId));
        alert(`✅ ${userName} removed as co-host`);
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to remove co-host:', error);
      alert('Failed to remove co-host');
    }
  };

  if (!isHost) return null;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="fixed top-4 right-4 z-40 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 font-medium"
      >
        <Crown className="w-5 h-5" />
        Co-Hosts
        {coHosts.length > 0 && (
          <span className="bg-purple-800 text-xs px-2 py-0.5 rounded-full">
            {coHosts.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {showPanel && (
        <div className="fixed top-20 right-4 z-40 w-96 bg-gray-900 rounded-xl shadow-2xl border border-gray-700 max-h-96 overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-400" />
              Co-Host Management
            </h3>
            <button
              onClick={() => setShowPanel(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Co-Hosts */}
          {coHosts.length > 0 && (
            <div className="p-4 border-b border-gray-700">
              <h4 className="text-gray-400 text-sm font-medium mb-3">
                Current Co-Hosts ({coHosts.length})
              </h4>

              <div className="space-y-2">
                {coHosts.map((coHost) => (
                  <div
                    key={coHost.userId}
                    className="bg-gray-800 rounded-lg p-3 border border-purple-600/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-purple-400" />
                        <p className="text-white font-medium text-sm">
                          {coHost.userName}
                        </p>
                      </div>
                      <button
                        onClick={() => removeCoHost(coHost.userId, coHost.userName)}
                        className="text-red-400 hover:text-red-300"
                        title="Remove co-host"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-gray-400 text-xs">
                      Assigned {new Date(coHost.assignedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assign New Co-Host */}
          <div className="flex-1 overflow-y-auto p-4">
            <h4 className="text-gray-400 text-sm font-medium mb-3">
              Assign Co-Host
            </h4>

            <div className="space-y-2">
              {participants
                .filter(p => {
                  // Exclude yourself and existing co-hosts
                  return p.identity !== hostUserId && 
                         !coHosts.some(ch => ch.userId === p.identity);
                })
                .map((participant) => (
                  <div
                    key={participant.identity}
                    className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-purple-600/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium text-sm">
                        {participant.name || 'Unnamed'}
                      </p>
                      <button
                        onClick={() => assignCoHost(
                          participant.identity,
                          participant.name || 'User'
                        )}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium py-1.5 px-3 rounded flex items-center gap-1"
                      >
                        <UserPlus className="w-3 h-3" />
                        Make Co-Host
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Info Footer */}
          <div className="p-3 bg-purple-900/20 border-t border-purple-600/30">
            <p className="text-purple-200 text-xs flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Co-hosts have full classroom control except assigning other co-hosts
            </p>
          </div>
        </div>
      )}
    </>
  );
};
```

### 3. Updated Moderator Control Bar

```typescript
// components/ModeratorControlBar.tsx
import { useModeratorStatus } from '@/hooks/useModeratorStatus';
import { Shield, Crown, Users, MicOff, UserX } from 'lucide-react';

interface ModeratorControlBarProps {
  sessionId: string;
  userId: string;
}

export const ModeratorControlBar = ({ 
  sessionId, 
  userId 
}: ModeratorControlBarProps) => {
  const { 
    isModerator, 
    isHost, 
    isCoHost, 
    moderatorType, 
    permissions 
  } = useModeratorStatus(sessionId);

  if (!isModerator) return null;

  const muteAll = async () => {
    if (!permissions.can_mute_participants) {
      alert('You do not have permission to mute participants');
      return;
    }

    if (!confirm('Mute all participants?')) return;

    try {
      const response = await fetch('/api/moderators/mute-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, moderatorId: userId }),
      });

      const data = await response.json();
      if (data.success) {
        alert('All participants muted');
      }
    } catch (error) {
      console.error('Failed to mute all:', error);
    }
  };

  return (
    <div className="fixed top-4 left-4 z-40 flex items-center gap-3">
      {/* Role Badge */}
      <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
        isHost 
          ? 'bg-yellow-600 border-2 border-yellow-400' 
          : 'bg-purple-600 border-2 border-purple-400'
      }`}>
        {isHost ? (
          <>
            <Crown className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm">HOST</span>
          </>
        ) : (
          <>
            <Shield className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm">CO-HOST</span>
          </>
        )}
      </div>

      {/* Quick Actions */}
      {permissions.can_mute_participants && (
        <button
          onClick={muteAll}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg"
          title="Mute all participants"
        >
          <MicOff className="w-5 h-5" />
          <span className="hidden md:inline">Mute All</span>
        </button>
      )}

      {/* Moderator Panel Button */}
      <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg">
        <Users className="w-5 h-5" />
        <span className="hidden md:inline">Manage Class</span>
      </button>
    </div>
  );
};
```

### 4. Participant List with Co-Host Indicators

```typescript
// components/ParticipantsList.tsx
import { useParticipants } from '@livekit/components-react';
import { Crown, Shield, User } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ParticipantRole {
  userId: string;
  role: 'host' | 'co-host' | 'participant';
}

export const ParticipantsList = ({ sessionId }: { sessionId: string }) => {
  const participants = useParticipants();
  const [roles, setRoles] = useState<Map<string, ParticipantRole>>(new Map());

  useEffect(() => {
    // Load moderator list to show badges
    const loadRoles = async () => {
      try {
        const response = await fetch(`/api/moderators/list?sessionId=${sessionId}`);
        const data = await response.json();
        
        if (data.success) {
          const roleMap = new Map<string, ParticipantRole>();
          
          data.moderators.forEach((mod: any) => {
            roleMap.set(mod.userId, {
              userId: mod.userId,
              role: mod.moderatorType,
            });
          });
          
          setRoles(roleMap);
        }
      } catch (error) {
        console.error('Failed to load roles:', error);
      }
    };

    loadRoles();

    // Listen for role changes
    const handleRoleChange = (payload: Uint8Array) => {
      const data = JSON.parse(new TextDecoder().decode(payload));
      
      if (data.type === 'COHOST_ADDED') {
        setRoles(prev => new Map(prev).set(data.coHostId, {
          userId: data.coHostId,
          role: 'co-host',
        }));
      }
      
      if (data.type === 'COHOST_REMOVED') {
        setRoles(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.coHostId);
          return newMap;
        });
      }
    };

    // Subscribe to data channel
    // Implementation depends on your LiveKit setup

    return () => {
      // Cleanup
    };
  }, [sessionId]);

  const getRoleBadge = (userId: string) => {
    const role = roles.get(userId);
    
    if (!role) {
      return (
        <div className="flex items-center gap-1 text-gray-400">
          <User className="w-3 h-3" />
          <span className="text-xs">Student</span>
        </div>
      );
    }

    if (role.role === 'host') {
      return (
        <div className="flex items-center gap-1 text-yellow-400">
          <Crown className="w-4 h-4" />
          <span className="text-xs font-bold">HOST</span>
        </div>
      );
    }

    if (role.role === 'co-host') {
      return (
        <div className="flex items-center gap-1 text-purple-400">
          <Shield className="w-4 h-4" />
          <span className="text-xs font-bold">CO-HOST</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <h3 className="text-white font-bold mb-4 flex items-center gap-2">
        <User className="w-5 h-5" />
        Participants ({participants.length})
      </h3>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {participants.map((participant) => (
          <div
            key={participant.identity}
            className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
          >
            <div>
              <p className="text-white font-medium">
                {participant.name || 'Unnamed'}
              </p>
              {getRoleBadge(participant.identity)}
            </div>
            
            <div className="flex items-center gap-2">
              {participant.isMicrophoneEnabled ? (
                <span className="text-green-400 text-xs">🎤</span>
              ) : (
                <span className="text-red-400 text-xs">🔇</span>
              )}
              {participant.isCameraEnabled ? (
                <span className="text-green-400 text-xs">🎥</span>
              ) : (
                <span className="text-gray-400 text-xs">📷❌</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## Key Features

### Co-Host Capabilities:

✅ **Full Classroom Control:**
- Mute/unmute participants
- Remove participants from class
- Grant/revoke mic and camera permissions
- Start/stop recording
- Manage attendance
- Assign backup moderators

❌ **Limited to Host Only:**
- Assign/remove co-hosts (only main host)
- End class permanently (only main host)

### Visual Indicators:

**Host Badge:**
- 👑 Crown icon
- Yellow/gold background
- "HOST" label

**Co-Host Badge:**
- 🛡️ Shield icon
- Purple background
- "CO-HOST" label

**Student:**
- 👤 User icon
- Gray text
- "Student" label

---

## User Experience Flow

### Assigning Co-Host:

```
Host opens Co-Host Panel →
Clicks "Make Co-Host" on participant →
Confirmation shown →
Co-host receives notification →
Co-host badge appears →
Co-host gains full controls
```

### Co-Host Using Powers:

```
Co-host sees "CO-HOST" badge →
Opens moderator panel →
All controls available (mute, remove, grant, etc.) →
Actions logged with co-host's name →
Host can see who performed action
```

### Removing Co-Host:

```
Host clicks "Remove" on co-host →
Confirmation dialog →
Co-host immediately loses powers →
Badge changes to "Student" →
Notification sent to removed co-host
```

---

## Security & Audit

### Permission Checks:
- Every moderator action verifies permissions
- Co-hosts can't assign other co-hosts
- Only host can remove co-hosts
- All actions require valid session

### Audit Trail:
```sql
-- Every action logged
INSERT INTO moderator_actions (
  session_id,
  moderator_id,
  action_type,
  target_user_id,
  metadata
) VALUES (...);
```

### Action Types:
- `assign_cohost`
- `remove_cohost`
- `cohost_mute_participant`
- `cohost_grant_permission`
- `cohost_remove_participant`

---

## Testing Checklist

- [ ] Host can assign co-hosts
- [ ] Co-hosts receive notification
- [ ] Co-hosts see purple badge
- [ ] Co-hosts can mute participants
- [ ] Co-hosts can grant permissions
- [ ] Co-hosts can remove participants
- [ ] Co-hosts CANNOT assign other co-hosts
- [ ] Host can remove co-hosts
- [ ] Removed co-hosts lose powers immediately
- [ ] Multiple co-hosts work simultaneously
- [ ] Co-host actions appear in audit log
- [ ] Co-host panel shows all co-hosts
- [ ] Participant list shows role badges

---

This gives you flexible, powerful co-hosting with full classroom control! 🛡️👑
