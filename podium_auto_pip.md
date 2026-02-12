# Automatic PiP / Mobile Background Audio Integration

## Feature Overview

This feature ensures students never miss a moment of class by automatically transitioning to **Picture-in-Picture (Desktop)** or **Enhanced Background Audio (Mobile)** when the browser tab is hidden or minimized.

### Triggers:
- Switching to another tab
- Minimizing the browser
- Locking the phone screen (Mobile)
- Switching to another app (Mobile)

---

## Technical Components

### 1. The Instant PiP Hook (`useInstantPiP.ts`)
This hook monitors visibility changes and "primes" video elements to use the browser's native **Auto-PiP** feature where supported.

```typescript
// hooks/useInstantPiP.ts
export const useInstantPiP = ({ enabled }: { enabled: boolean }) => {
    // 1. Detects Mobile vs Desktop
    // 2. Uses MutationObserver to "prime" all <video> elements with:
    //    video.autoPictureInPicture = true;
    // 3. Fallback: Manually requests PiP on visibilitychange if native auto fails
    // 4. Mobile: Resumes AudioContext and configures MediaSession for background play
}
```

### 2. Enhanced Mobile Audio Component
A specialized UI component and logic handler for mobile users to ensure the stream stays alive in the background.

```typescript
// components/media/EnhancedMobileAudio.tsx
export default function EnhancedMobileAudio({ title, userName, isActive }) {
    // - Configures navigator.mediaSession (Title, Artist, Artwork)
    // - Requests Screen WakeLock to prevent device from sleeping
    // - Provides visual "Background Audio Active" indicator
}
```

---

## Mobile Features

### ✅ Background Audio Persistence
On mobile, video technically pauses when the browser is hidden. We overcome this by:
1.  **Media Session API**: Registering the "play" state so the OS doesn't kill the process.
2.  **AudioContext Resume**: Ensuring the audio stream is "primed" while the tab is still visible.
3.  **WakeLock**: Preventing the mobile device from entering deep sleep while the class is active.

### ✅ Lock Screen Controls
Users can see the class title and lecturer name directly on their lock screen or notification tray, allowing them to manage the audio without unlocking their phone.

### ✅ Auto-PiP (Native Chrome Support)
On supported mobile browsers (like Chrome on Android), minimizing the browser can trigger the native OS Picture-in-Picture window if the video element is primed correctly.

---

## Integration in `GlobalClassroom.tsx`

The components are integrated at the root of the classroom to ensure global availability:

```tsx
<InstantPiPManager />
{/* Mobile specialized controls */}
{isMobile && (
    <div className="absolute top-20 right-4">
        <EnhancedMobileAudio 
            title={session?.title} 
            userName={userName} 
            isActive={true} 
        />
    </div>
)}
```

---

## Testing & Verification

### Desktop
1.  Join class -> Turn on Camera.
2.  Switch to another tab -> PiP window should pop up immediately.
3.  Switch back -> PiP window closes.

### Mobile
1.  Join class on Android/iOS.
2.  Lock the screen or press the Home button.
3.  **Verify**: Audio continues playing.
4.  **Verify**: Notification tray shows "Podium Class in Session".

---

> [!NOTE]
> **Performance**: This system uses a `MutationObserver` to watch for LiveKit dynamic video mounts, ensuring that even if a lecturer starts sharing their screen *after* you've joined, the new video is immediately ready for PiP.
