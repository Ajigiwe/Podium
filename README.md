# Podium — Virtual Classroom Platform

A scalable, low-latency, zero-ops virtual classroom platform designed specifically for students and lecturers in resource-constrained environments (like Ghana). Supporting **500+ concurrent users** per room, the platform integrates live video streaming, mobile money payments, and granular classroom moderation.

---

## 🎯 The Problem Landscape & Solutions

Podium is architected to address the unique infrastructural and economic challenges faced by students and educators in developing markets:

### 1. High Internet Data Costs
* **The Problem:** Video conferencing services like Zoom or Google Meet consume massive amounts of mobile data, which is prohibitively expensive for students.
* **Our Solution:** 
  * **YouTube Live Integration:** Podium supports broadcasting live lectures via unlisted YouTube streams. Students can use cheap, network-provided "social media/YouTube data bundles" (e.g., MTN or Telecel Ghana) to stream classes at a fraction of standard data rates.
  * **Adaptive Video Downscaling:** On client devices, Podium utilizes an `IntersectionObserver` to automatically pause or downscale off-screen video tiles in the WebRTC participant grid, reducing cellular data consumption by up to **80%**.

### 2. Lack of Credit/Debit Card Payments
* **The Problem:** Standard global learning platforms require international credit/debit cards, which the majority of students in Ghana do not possess.
* **Our Solution:** 
  * **Paystack Mobile Money Integration:** Integrated MTN Mobile Money (MoMo) and Vodafone/Telecel Cash payments directly into the checkout flow. Students pay using localized mobile money USSD prompt commands (`*170#`, `*110#`) or payment apps.
  * **Instant Automated Enrollment:** Verified webhook notifications immediately unlock classroom access upon successful payment confirmation.

### 3. Cost-Efficient Scalability
* **The Problem:** Commercial real-time video APIs (e.g., Zoom SDK, Agora, Twilio) charge steep per-user per-minute rates, making large-scale classes financially unfeasible.
* **Our Solution:** 
  * **Self-Hosted WebRTC Infrastructure:** Runs a self-hosted LiveKit instance on an affordable Linux VPS (e.g., Contabo 8-Core CPU / 24GB RAM for ~$15/month).
  * **High-Concurrency State Caching:** Session state, participant mappings, and metadata are offloaded to **Redis** for sub-millisecond state synchronization and minimal database reads.

### 4. Classroom Moderation at Scale
* **The Problem:** In classes with 300+ students, random unmuting of microphones and cameras creates auditory chaos and increases server bandwidth load.
* **Our Solution:**
  * **Permission-Based Access Controls:** Students are muted and have cameras disabled by default. They must submit a request via the interface to unmute, which the lecturer or co-hosts can approve or deny in real time.
  * **Co-Host Delegation:** The main lecturer can assign multiple students or assistants as co-hosts during the live session, granting them moderator privileges (mute, disconnect, grant permissions) to distribute workload.

---

## ⚡ Core Features

* 📺 **Hybrid Video Broadcasting:** Native LiveKit WebRTC (sub-second latency) for interactive discussions coupled with YouTube Live backup for high-scale, low-data lectures.
* 🎛️ **Dynamic Grid Layouts:** Toggles for **2x2** (4 visible), **5x5** (25 visible), and **10x10** (100 visible) video matrices, supporting virtualized scrolling for high-count environments.
* 🔍 **Spotlight Mode:** Double-click or select any participant's video to enlarge them, moving other participants to a scrollable sidebar.
* 🙋 **Raised Hand Registry:** Notification system showing student names who raised hands, allowing the lecturer to acknowledge or clear requests globally.
* 🔐 **Granular Room Permissions:** Lock screen/camera defaults with real-time request-response flows through LiveKit data channels.
* 👥 **Co-Host Privileges:** Host-delegated admin capabilities to promote/demote co-hosts on the fly.
* 📱 **Mobile Optimization & PiP:**
  * **Auto-PiP:** Native Picture-in-Picture on desktop and supported mobile browsers when switching tabs or minimizing.
  * **Mobile Background Audio Persistence:** Leverages browser Media Session APIs, WakeLock API, and AudioContext resume to keep stream audio playing even when the phone is locked or the browser is minimized.
* 📊 **Lecturer Dashboards:** Tracks student attendance duration, registers payments, calculates earnings (GHS), and downloads CSV logs.
* 🔄 **Reconnection Resilience:** Persistent screen sharing that automatically prompts the lecturer to resume sharing after minor network drops.
* 💬 **Real-time Chat:** Real-time chat messaging using Firebase Realtime Database.

---

## 🛠️ Technology Stack

* **Frontend Framework:** [Next.js 14](https://nextjs.org/) (App Router, TypeScript, Tailwind CSS, Shadcn UI)
* **Static Client Frontend:** Pure HTML/JS/CSS templates (located under `/public`) compiled & served for fast CDN loads.
* **Real-time Media:** [LiveKit WebRTC SFU](https://livekit.io/) (Self-Hosted on Linux VPS)
* **Backend Database & Auth:** [Firebase](https://firebase.google.com/) (Firestore, Auth, Realtime Database)
* **State Management & Caching:** [Redis](https://redis.io/)
* **Payment Gateway:** [Paystack](https://paystack.com/) (Ghana API Integration, 1.95% transaction fee)
* **Streaming Source:** [YouTube Live API](https://developers.google.com/youtube/v3/live/docs)
* **Production Hosting:** Vercel (Next.js serverless and static assets) & Contabo VPS (LiveKit & Redis server)

---

## 🔧 Installation & Developer Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/podium-lms.git
cd podium-lms
npm install
```

### 2. Configure Environment Variables
Copy `.env.local.example` to `.env.local` and populate the keys:
```bash
cp .env.local.example .env.local
```
Ensure you have the following configured in your `.env.local`:
* Firebase Client and Admin SDK credentials.
* LiveKit server URL, API key, and Secret.
* Paystack Public and Secret keys.

### 3. Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application locally.

---

## 🛡️ Setup & Deployment Guides

For step-by-step instructions on setting up infrastructure, consult the dedicated guides below:

* 📑 **[Firebase Setup Guide](file:///c:/Users/ABCD/Desktop/lite-lms/FIREBASE_SETUP.md)**: Configures Auth, Firestore database rules, Realtime Database schema, and indexes.
* 💳 **[Paystack Mobile Money Setup](file:///c:/Users/ABCD/Desktop/lite-lms/PAYSTACK_SETUP.md)**: Guides you through setting up test accounts, webhook tunnels (localtunnel/serveo), and live credentials in Ghana.
* ☁️ **[VPS Host Deployment Guide](file:///c:/Users/ABCD/Desktop/lite-lms/DEPLOY_VPS.md)**: Steps to install Docker, deploy LiveKit server configurations, and configure Nginx SSL on Ubuntu.
* 🚀 **[Vercel & App Production Deployment](file:///c:/Users/ABCD/Desktop/lite-lms/DEPLOYMENT.md)**: Configures environment variables, handles domain mapping, and finalizes production webhooks.
* 📽️ **[OBS Screen Sharing Guide](file:///c:/Users/ABCD/Desktop/lite-lms/SCREEN_SHARING_GUIDE.md)**: Teaches lecturers how to configure OBS Studio to stream high-quality window/screen captures to unlisted streams.
* 🌙 **[Dark Mode Troubleshooting](file:///c:/Users/ABCD/Desktop/lite-lms/DARK_MODE_TROUBLESHOOTING.md)**: Solutions for theme context hydration and rendering issues.

---

## 📈 System Optimizations (500+ Concurrent Users)

To achieve reliable high-concurrency video delivery at minimum cost, apply these optimizations on your server:

### Server-Level (Linux/VPS)
* **BBR Congestion Control:** Enabled Google's Bottleneck Bandwidth and RTT (BBR) congestion control on Linux to ensure maximum throughput and minimal video buffering on cellular networks.
* **System Limits:** Tuned system limits `/etc/security/limits.conf` (`nofile` limits set to 65,536) to prevent socket starvation under high media track counts.
* **Redis Caching:** Configured Redis with `allkeys-lru` eviction policies and disabled continuous disk disk-saving (`save ""`) to minimize write-latency overheads during peaks.

### Media Server (LiveKit Config)
* **Dynacast:** Enabled dynamic streaming to only send video streams that are active and visible in client Viewports.
* **Simulcast Configuration:** Video is published at 3 distinct qualities (High: 720p, Medium: 360p, Low: 180p) to match the real-time bandwidth capabilities of different students.

---

## 🏗️ Project Structure

```
podium-lms/
├── app/                    # Next.js App Router (APIs, Webhooks, Root Layout)
│   ├── api/                # API endpoints (LiveKit tokens, Paystack webhooks, permissions)
│   └── classroom/          # Classroom video/WebRTC entry points
├── components/            # React classroom widgets (VideoGrid, Chat, ControlBar, Panels)
├── hooks/                  # Custom Hooks (usePermissions, useInstantPiP, useModeratorStatus)
├── server-optimization/   # VPS tuning configurations & livekit.yaml templates
├── public/                 # Static pages (index.html, dashboard.html, admin.html, profile.html)
│   ├── js/                 # Vanilla JS client logic (attendance.js, dashboard.js, communities.js)
│   └── css/                # Main styling templates
├── firestore.rules         # Security access rules for Firestore database
└── database.rules.json     # Security access rules for Firebase Realtime Database
```

---

## 📄 License & Support

This project is licensed under the MIT License. For support, setup inquiries, or bug reports, please open an issue in the project repository.
