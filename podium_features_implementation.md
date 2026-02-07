# Podium Classroom Platform - Feature Implementation Guide

## Project Context
I have an online classroom platform called **Podium** (podiumclass.online) that uses:
- **Frontend**: Next.js, TypeScript, React
- **Video Infrastructure**: LiveKit (self-hosted on Contabo Ubuntu servers)
- **Target Capacity**: 350+ students per session

## Features to Implement

### 1. Dynamic Grid Layout System
Students should be able to toggle between different view modes:
- **2x2 Grid**: See themselves + lecturer + 2 others (4 total)
- **5x5 Grid**: See up to 25 participants
- **10x10 Grid**: See up to 100 participants
- **Spotlight Mode**: Click any participant to enlarge them, with others in sidebar

### 2. Spotlight/Enlargement Feature
- Click on any participant's video tile to enlarge them to full screen
- All other participants move to a sidebar on the right
- Click again to exit spotlight mode
- Smooth transitions between modes

### 3. Raise Hand System
- Add "Raise Hand" button to the control bar (alongside mic/video buttons)
- When a student raises their hand:
  - A notification banner appears across the top of the screen
  - Shows student name(s) with raised hands
  - Banner persists until lecturer acknowledges or student lowers hand
- Lecturer can dismiss all raised hands at once
- Student can lower their own hand

---

## Implementation Code

### File Structure
```
/components
  ├── VideoGrid.tsx          # Main grid component
  ├── VideoTile.tsx          # Individual participant tile
  ├── ControlBar.tsx         # Mic, video, raise hand controls
  ├── LayoutSelector.tsx     # Grid layout toggle buttons
  └── RaisedHandsBanner.tsx  # Raised hands notification

/hooks
  ├── useLayoutConfig.ts     # Grid layout state management
  └── useRaisedHands.ts      # Raise hand functionality

/types
  └── layout.ts              # TypeScript types
```

---

## Code Implementation

### 1. Types Definition
```typescript
// types/layout.ts
export type GridLayout = '2x2' | '5x5' | '10x10' | 'spotlight';

export interface LayoutConfig {
  columns: number;
  rows: number;
  maxVisible: number;
}

export interface RaisedHand {
  participantId: string;
  participantName: string;
  timestamp: number;
}
```

### 2. Layout Configuration Hook
```typescript
// hooks/useLayoutConfig.ts
import { useState } from 'react';
import { GridLayout, LayoutConfig } from '@/types/layout';

const LAYOUT_CONFIGS: Record<GridLayout, LayoutConfig> = {
  '2x2': { columns: 2, rows: 2, maxVisible: 4 },
  '5x5': { columns: 5, rows: 5, maxVisible: 25 },
  '10x10': { columns: 10, rows: 10, maxVisible: 100 },
  'spotlight': { columns: 1, rows: 1, maxVisible: 1 }
};

export const useLayoutConfig = () => {
  const [layout, setLayout] = useState<GridLayout>('5x5');
  const [spotlightParticipant, setSpotlightParticipant] = useState<string | null>(null);
  
  return {
    layout,
    setLayout,
    config: LAYOUT_CONFIGS[layout],
    spotlightParticipant,
    setSpotlightParticipant
  };
};
```

### 3. Raised Hands Hook
```typescript
// hooks/useRaisedHands.ts
import { useDataChannel } from '@livekit/components-react';
import { useState, useCallback } from 'react';
import { DataPacket_Kind } from 'livekit-client';
import { RaisedHand } from '@/types/layout';

export const useRaisedHands = () => {
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);
  const { send } = useDataChannel('raise-hand');

  const raiseHand = useCallback((participantId: string, participantName: string) => {
    const data = JSON.stringify({
      type: 'HAND_RAISED',
      participantId,
      participantName,
      timestamp: Date.now()
    });
    
    send(new TextEncoder().encode(data), {
      kind: DataPacket_Kind.RELIABLE
    });

    // Optimistic update
    setRaisedHands(prev => [...prev, {
      participantId,
      participantName,
      timestamp: Date.now()
    }]);
  }, [send]);

  const lowerHand = useCallback((participantId: string) => {
    const data = JSON.stringify({
      type: 'HAND_LOWERED',
      participantId
    });
    
    send(new TextEncoder().encode(data), {
      kind: DataPacket_Kind.RELIABLE
    });

    // Optimistic update
    setRaisedHands(prev => prev.filter(h => h.participantId !== participantId));
  }, [send]);

  const clearAllHands = useCallback(() => {
    raisedHands.forEach(hand => lowerHand(hand.participantId));
  }, [raisedHands, lowerHand]);

  // Listen for data channel messages
  const onMessage = useCallback((payload: Uint8Array) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(payload));
      
      if (data.type === 'HAND_RAISED') {
        setRaisedHands(prev => {
          // Avoid duplicates
          if (prev.some(h => h.participantId === data.participantId)) return prev;
          return [...prev, {
            participantId: data.participantId,
            participantName: data.participantName,
            timestamp: data.timestamp
          }];
        });
      } else if (data.type === 'HAND_LOWERED') {
        setRaisedHands(prev => prev.filter(h => h.participantId !== data.participantId));
      }
    } catch (error) {
      console.error('Error parsing raise hand message:', error);
    }
  }, []);

  return { 
    raisedHands, 
    raiseHand, 
    lowerHand,
    clearAllHands,
    onMessage 
  };
};
```

### 4. Video Grid Component
```typescript
// components/VideoGrid.tsx
import { useParticipants } from '@livekit/components-react';
import { VideoTile } from './VideoTile';
import { useLayoutConfig } from '@/hooks/useLayoutConfig';

export const VideoGrid = () => {
  const participants = useParticipants();
  const { layout, config, spotlightParticipant, setSpotlightParticipant } = useLayoutConfig();
  
  const isSpotlightMode = spotlightParticipant !== null;
  
  // Filter spotlight participant
  const spotlight = participants.find(p => p.identity === spotlightParticipant);
  const sidebarParticipants = isSpotlightMode 
    ? participants.filter(p => p.identity !== spotlightParticipant)
    : [];
  
  const displayParticipants = isSpotlightMode 
    ? (spotlight ? [spotlight] : []) 
    : participants;

  return (
    <div className="flex h-full w-full gap-2 bg-gray-950">
      {/* Main Grid or Spotlight */}
      <div 
        className={`${isSpotlightMode ? 'flex-1' : 'w-full'} grid gap-2 p-4 auto-rows-fr`}
        style={{
          gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${config.rows}, minmax(0, 1fr))`,
        }}
      >
        {displayParticipants.slice(0, config.maxVisible).map((participant) => (
          <VideoTile
            key={participant.identity}
            participant={participant}
            isSpotlight={participant.identity === spotlightParticipant}
            onClickEnlarge={() => {
              if (isSpotlightMode && participant.identity === spotlightParticipant) {
                setSpotlightParticipant(null); // Exit spotlight
              } else {
                setSpotlightParticipant(participant.identity); // Enter spotlight
              }
            }}
          />
        ))}
      </div>

      {/* Sidebar for other participants in spotlight mode */}
      {isSpotlightMode && sidebarParticipants.length > 0 && (
        <div className="w-48 flex flex-col gap-2 p-4 overflow-y-auto bg-gray-900 scrollbar-thin">
          {sidebarParticipants.map((participant) => (
            <VideoTile
              key={participant.identity}
              participant={participant}
              isSidebarView
              onClickEnlarge={() => setSpotlightParticipant(participant.identity)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

### 5. Video Tile Component
```typescript
// components/VideoTile.tsx
import { VideoTrack, useTrackToggle } from '@livekit/components-react';
import { Participant, Track } from 'livekit-client';
import { Maximize2, Mic, MicOff } from 'lucide-react';

interface VideoTileProps {
  participant: Participant;
  isSpotlight?: boolean;
  isSidebarView?: boolean;
  onClickEnlarge: () => void;
}

export const VideoTile = ({ 
  participant, 
  isSpotlight = false, 
  isSidebarView = false,
  onClickEnlarge 
}: VideoTileProps) => {
  const videoPublication = Array.from(participant.videoTrackPublications.values())[0];
  const audioPublication = Array.from(participant.audioTrackPublications.values())[0];
  
  const hasVideo = videoPublication?.isSubscribed && !videoPublication?.isMuted;
  const isMicMuted = audioPublication?.isMuted ?? true;

  return (
    <div 
      className={`relative rounded-lg overflow-hidden bg-gray-800 cursor-pointer group transition-all
        ${isSpotlight ? 'h-full' : isSidebarView ? 'aspect-video' : ''}
        hover:ring-2 hover:ring-blue-500`}
      onClick={onClickEnlarge}
    >
      {/* Video or placeholder */}
      {hasVideo && videoPublication?.track ? (
        <VideoTrack
          trackRef={{
            participant,
            source: Track.Source.Camera,
            publication: videoPublication
          }}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-700">
          <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-white text-2xl font-bold">
            {(participant.name || participant.identity).charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      
      {/* Enlarge button */}
      {!isSidebarView && (
        <button
          className="absolute top-2 right-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          onClick={(e) => {
            e.stopPropagation();
            onClickEnlarge();
          }}
          title={isSpotlight ? "Exit spotlight" : "Enlarge"}
        >
          <Maximize2 className="w-4 h-4 text-white" />
        </button>
      )}

      {/* Participant info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
        <div className="flex items-center justify-between">
          <p className="text-white text-sm font-medium truncate flex-1">
            {participant.name || participant.identity}
          </p>
          
          {/* Mic indicator */}
          <div className="flex items-center gap-1">
            {isMicMuted ? (
              <MicOff className="w-4 h-4 text-red-500" />
            ) : (
              <Mic className="w-4 h-4 text-green-500" />
            )}
          </div>
        </div>
      </div>

      {/* Speaking indicator */}
      {!isMicMuted && audioPublication?.track && (
        <div className="absolute top-2 left-2 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
      )}
    </div>
  );
};
```

### 6. Layout Selector Component
```typescript
// components/LayoutSelector.tsx
import { Grid2X2, Grid3X3, LayoutGrid } from 'lucide-react';
import { GridLayout } from '@/types/layout';

interface LayoutSelectorProps {
  currentLayout: GridLayout;
  onLayoutChange: (layout: GridLayout) => void;
}

export const LayoutSelector = ({ currentLayout, onLayoutChange }: LayoutSelectorProps) => {
  return (
    <div className="flex gap-2 bg-gray-800 p-2 rounded-lg">
      <button
        onClick={() => onLayoutChange('2x2')}
        className={`p-2 rounded transition-colors ${
          currentLayout === '2x2' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
        }`}
        title="2x2 Grid (4 participants)"
      >
        <Grid2X2 className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => onLayoutChange('5x5')}
        className={`p-2 rounded transition-colors ${
          currentLayout === '5x5' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
        }`}
        title="5x5 Grid (25 participants)"
      >
        <Grid3X3 className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => onLayoutChange('10x10')}
        className={`p-2 rounded transition-colors ${
          currentLayout === '10x10' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
        }`}
        title="10x10 Grid (100 participants)"
      >
        <LayoutGrid className="w-5 h-5" />
      </button>
    </div>
  );
};
```

### 7. Control Bar Component
```typescript
// components/ControlBar.tsx
import { useLocalParticipant } from '@livekit/components-react';
import { Mic, MicOff, Video, VideoOff, Hand, PhoneOff } from 'lucide-react';
import { useState } from 'react';
import { useRaisedHands } from '@/hooks/useRaisedHands';

export const ControlBar = () => {
  const { localParticipant } = useLocalParticipant();
  const [handRaised, setHandRaised] = useState(false);
  const { raiseHand, lowerHand } = useRaisedHands();

  const isMicEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const isCameraEnabled = localParticipant?.isCameraEnabled ?? false;

  const toggleMic = async () => {
    if (!localParticipant) return;
    await localParticipant.setMicrophoneEnabled(!isMicEnabled);
  };

  const toggleVideo = async () => {
    if (!localParticipant) return;
    await localParticipant.setCameraEnabled(!isCameraEnabled);
  };

  const toggleHand = () => {
    if (!localParticipant) return;
    
    if (handRaised) {
      lowerHand(localParticipant.identity);
    } else {
      raiseHand(localParticipant.identity, localParticipant.name || 'Student');
    }
    setHandRaised(!handRaised);
  };

  const leaveRoom = () => {
    // Implement leave room logic
    window.location.href = '/';
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="flex gap-3 bg-gray-900/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-2xl border border-gray-700">
        {/* Microphone */}
        <button
          onClick={toggleMic}
          className={`p-4 rounded-full transition-all ${
            isMicEnabled 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera */}
        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all ${
            isCameraEnabled 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Raise Hand */}
        <button
          onClick={toggleHand}
          className={`p-4 rounded-full transition-all ${
            handRaised 
              ? 'bg-yellow-500 hover:bg-yellow-600 text-black' 
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className={`w-5 h-5 ${handRaised ? 'animate-bounce' : ''}`} />
        </button>

        {/* Divider */}
        <div className="w-px bg-gray-700 mx-1" />

        {/* Leave Room */}
        <button
          onClick={leaveRoom}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
          title="Leave room"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
```

### 8. Raised Hands Banner Component
```typescript
// components/RaisedHandsBanner.tsx
import { useRaisedHands } from '@/hooks/useRaisedHands';
import { X, Hand } from 'lucide-react';

interface RaisedHandsBannerProps {
  isLecturer: boolean;
}

export const RaisedHandsBanner = ({ isLecturer }: RaisedHandsBannerProps) => {
  const { raisedHands, clearAllHands } = useRaisedHands();

  if (raisedHands.length === 0) return null;

  // Sort by timestamp (oldest first)
  const sortedHands = [...raisedHands].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 max-w-2xl w-full px-4">
      <div className="bg-yellow-500 text-black p-4 rounded-xl shadow-2xl flex items-center justify-between animate-slide-down border-2 border-yellow-600">
        <div className="flex items-center gap-3">
          <Hand className="w-6 h-6 animate-bounce" />
          <div>
            <p className="font-bold text-lg">
              {sortedHands.length} student{sortedHands.length > 1 ? 's' : ''} raised their hand
            </p>
            <p className="text-sm font-medium mt-1">
              {sortedHands.map(h => h.participantName).join(', ')}
            </p>
          </div>
        </div>
        
        {isLecturer && (
          <button
            onClick={clearAllHands}
            className="p-2 hover:bg-yellow-600 rounded-full transition-colors ml-4"
            title="Clear all raised hands"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
```

### 9. Main Room Component (Integration Example)
```typescript
// app/room/[roomId]/page.tsx or components/Room.tsx
import { LiveKitRoom } from '@livekit/components-react';
import { VideoGrid } from '@/components/VideoGrid';
import { ControlBar } from '@/components/ControlBar';
import { LayoutSelector } from '@/components/LayoutSelector';
import { RaisedHandsBanner } from '@/components/RaisedHandsBanner';
import { useLayoutConfig } from '@/hooks/useLayoutConfig';

export default function RoomPage() {
  const { layout, setLayout } = useLayoutConfig();
  const isLecturer = false; // Determine based on your user role logic

  return (
    <LiveKitRoom
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      token={/* your token */}
      connect={true}
      className="h-screen w-screen"
    >
      {/* Raised Hands Banner */}
      <RaisedHandsBanner isLecturer={isLecturer} />

      {/* Layout Selector - Top Right */}
      <div className="absolute top-4 right-4 z-30">
        <LayoutSelector currentLayout={layout} onLayoutChange={setLayout} />
      </div>

      {/* Video Grid */}
      <VideoGrid />

      {/* Control Bar */}
      <ControlBar />
    </LiveKitRoom>
  );
}
```

---

## Performance Optimizations for 350+ Students

### 1. Enable Simulcast in LiveKit
```typescript
// LiveKit room options
const roomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
  },
};
```

### 2. Implement Virtual Scrolling (for 10x10 grid)
```bash
npm install @tanstack/react-virtual
```

```typescript
// In VideoGrid.tsx for large grids
import { useVirtualizer } from '@tanstack/react-virtual';

// Use virtualizer for grids with 50+ participants
const virtualizer = useVirtualizer({
  count: participants.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 200,
  overscan: 5,
});
```

### 3. Optimize Re-renders
```typescript
// Memoize VideoTile component
import { memo } from 'react';

export const VideoTile = memo(({ participant, ... }: VideoTileProps) => {
  // component code
}, (prevProps, nextProps) => {
  return prevProps.participant.identity === nextProps.participant.identity &&
         prevProps.isSpotlight === nextProps.isSpotlight;
});
```

### 4. LiveKit Server Configuration (Contabo)
Ensure your LiveKit server has these settings in `livekit.yaml`:

```yaml
room:
  auto_create: true
  max_participants: 400
  
rtc:
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  
video:
  dynacast: true
  
turn:
  enabled: true
  
redis:
  address: localhost:6379  # For scalability
```

---

## Styling Requirements

Add these animations to your `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      keyframes: {
        'slide-down': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-down': 'slide-down 0.3s ease-out',
      },
    },
  },
};
```

---

## Testing Checklist

- [ ] Grid layouts switch correctly (2x2, 5x5, 10x10)
- [ ] Click-to-enlarge works and exits properly
- [ ] Sidebar shows all other participants in spotlight mode
- [ ] Raise hand button toggles correctly
- [ ] Banner appears when hands are raised
- [ ] Banner shows correct student names
- [ ] Lecturer can clear all raised hands
- [ ] Student can lower their own hand
- [ ] Banner disappears when all hands are lowered
- [ ] All features work with 350+ participants (test with fake participants)
- [ ] Video quality adapts based on grid size
- [ ] No memory leaks during long sessions

---

## Next Steps

1. **Install dependencies** (if not already installed):
   ```bash
   npm install @livekit/components-react livekit-client lucide-react
   ```

2. **Create the file structure** as shown above

3. **Copy each code block** into the respective files

4. **Integrate into your existing room component**

5. **Test with multiple participants** (use LiveKit's test tools or create fake participants)

6. **Monitor performance** on your Contabo server with 350+ participants

---

## Additional Recommendations

### For Better UX:
- Add keyboard shortcuts (spacebar to mute, Cmd+E to toggle video, etc.)
- Add connection quality indicators
- Add participant list with search
- Add screen sharing with similar spotlight mode
- Add recording indicator

### For Performance:
- Implement pagination for 10x10 grid (show 100 at a time, allow navigation)
- Use WebGL-accelerated video rendering for high participant counts
- Consider SFU cascading if you need to scale beyond 400 participants

---

## Troubleshooting

**Issue**: Raised hands not syncing across clients
- **Solution**: Check LiveKit data channel is enabled, verify reliable transport is used

**Issue**: Grid looks broken with many participants
- **Solution**: Implement virtual scrolling for grids > 50 participants

**Issue**: Video quality degrades
- **Solution**: Enable simulcast and dynacast in LiveKit config

**Issue**: High CPU usage
- **Solution**: Reduce video resolution for non-spotlight tiles, enable hardware acceleration

---

Good luck with the implementation! Let me know if you need any clarifications.
