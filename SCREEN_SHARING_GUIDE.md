# Screen Sharing Guide for Lecturers

## Overview

Lite-LMS uses **YouTube Live** for video streaming, which means you can easily share your screen, webcam, or both using **OBS Studio** (free, open-source software).

This guide will walk you through setting up screen sharing for your live classes.

---

## Prerequisites

- YouTube account
- YouTube channel (created automatically if you don't have one)
- OBS Studio installed on your computer

---

## Step 1: Install OBS Studio

1. Download OBS Studio from [https://obsproject.com/](https://obsproject.com/)
2. Install it on your computer (Windows, Mac, or Linux)
3. Launch OBS Studio

---

## Step 2: Set Up YouTube Live Streaming

### Enable Live Streaming on YouTube

1. Go to [YouTube Studio](https://studio.youtube.com/)
2. Click on **Create** → **Go Live**
3. If this is your first time, you'll need to verify your account and wait 24 hours
4. Once enabled, you'll see the live streaming dashboard

### Get Your Stream Key

1. In YouTube Studio, go to **Create** → **Go Live**
2. Select **Stream** (not Webcam or Manage)
3. Copy your **Stream Key** (keep this private!)
4. Copy your **Stream URL** (usually `rtmp://a.rtmp.youtube.com/live2`)

---

## Step 3: Configure OBS Studio

### Add Stream Settings

1. Open OBS Studio
2. Go to **Settings** → **Stream**
3. Select **Service**: YouTube - RTMPS
4. Paste your **Stream Key**
5. Click **OK**

### Add Screen Capture Source

1. In the **Sources** panel, click **+**
2. Select **Display Capture** (for entire screen) or **Window Capture** (for specific window)
3. Name it (e.g., "My Screen")
4. Click **OK**
5. Select your display/window
6. Click **OK**

### Optional: Add Webcam

1. Click **+** in Sources
2. Select **Video Capture Device**
3. Name it (e.g., "Webcam")
4. Select your webcam
5. Resize and position it (usually in a corner)

### Optional: Add Microphone

1. Go to **Settings** → **Audio**
2. Select your **Mic/Auxiliary Audio Device**
3. Click **OK**

---

## Step 4: Start Streaming

### In OBS Studio

1. Click **Start Streaming** button
2. Wait a few seconds for the stream to connect
3. You should see "LIVE" indicator turn green

### Get Your YouTube Video ID

1. Go back to YouTube Studio
2. Your live stream should now show as "Live"
3. Click on the stream
4. Copy the **Video ID** from the URL
   - URL format: `https://www.youtube.com/watch?v=VIDEO_ID_HERE`
   - Example: If URL is `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - Video ID is: `dQw4w9WgXcQ`

### Add Video ID to Lite-LMS

1. Go to your Lecturer Dashboard
2. Find your session
3. Paste the **Video ID** in the "YouTube Video ID" field
4. Click **Start Class**

---

## Step 5: During the Class

### What Students See

- Students will see your screen/webcam in real-time
- There's a 10-30 second delay (normal for live streaming)
- They can interact via the live chat

### Controls

- **Pause/Resume**: Click "Start/Stop Streaming" in OBS
- **Mute Mic**: Click the speaker icon next to your mic in OBS
- **Hide Screen**: Right-click the source → Hide
- **Switch Scenes**: Create multiple scenes for different layouts

---

## Step 6: End the Class

1. In OBS Studio, click **Stop Streaming**
2. In Lite-LMS, click **Stop Class**
3. Your stream will end on YouTube

---

## Tips for Better Streaming

### Video Quality

- **Resolution**: 1920x1080 (1080p) recommended
- **FPS**: 30 fps is sufficient for screen sharing
- **Bitrate**: 4500-6000 Kbps for 1080p

To adjust:
1. Go to **Settings** → **Video**
2. Set **Base Resolution**: 1920x1080
3. Set **Output Resolution**: 1920x1080
4. Set **FPS**: 30

### Audio Quality

- Use a good microphone (headset or USB mic)
- Test audio levels before starting
- Speak clearly and at a moderate pace

### Internet Connection

- **Minimum**: 5 Mbps upload speed
- **Recommended**: 10+ Mbps upload speed
- Use wired connection (Ethernet) if possible
- Close other apps using internet

### Scene Layouts

Create multiple scenes for different purposes:

1. **Full Screen**: Just your screen
2. **Screen + Webcam**: Screen with webcam in corner
3. **Webcam Only**: For introductions/discussions
4. **Slides**: PowerPoint or PDF presentation

---

## Troubleshooting

### Stream Won't Connect

- Check your internet connection
- Verify your Stream Key is correct
- Try restarting OBS
- Check YouTube Studio for errors

### Students Can't See Video

- Verify the Video ID is correct in Lite-LMS
- Make sure the stream is set to "Public" or "Unlisted" on YouTube
- Check if the class is marked as "Active" in Lite-LMS

### Poor Video Quality

- Lower the resolution (try 720p)
- Reduce bitrate to 2500-3500 Kbps
- Close other applications
- Check your internet speed

### Audio Issues

- Check mic is selected in OBS Settings
- Verify mic isn't muted in OBS
- Test audio levels (should be in green/yellow range)
- Check system audio settings

---

## Alternative: Simple Webcam Streaming

If you don't need screen sharing, you can use YouTube's built-in webcam streaming:

1. Go to YouTube Studio → **Create** → **Go Live**
2. Select **Webcam** (not Stream)
3. Set up your webcam and mic
4. Click **Go Live**
5. Copy the Video ID and add it to Lite-LMS

---

## Resources

- [OBS Studio Documentation](https://obsproject.com/wiki/)
- [YouTube Live Streaming Guide](https://support.google.com/youtube/answer/2474026)
- [OBS Studio Tutorials](https://www.youtube.com/results?search_query=obs+studio+tutorial)

---

## Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Search YouTube for "OBS Studio [your issue]"
3. Visit the [OBS Forums](https://obsproject.com/forum/)
4. Contact Lite-LMS support

---

**Happy Teaching! 🎓**
