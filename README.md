# Podium - Virtual Classroom System

A scalable, zero-ops virtual classroom platform for Ghanaian students supporting 300+ concurrent users with YouTube Live streaming and mobile money payments.

## 🚀 Features

- **Live Video Streaming**: LiveKit WebRTC & YouTube Live integration for low-latency and scalable video delivery
- **Adaptive Quality Control**: Automatic bandwidth management based on participant visibility
- **Mobile Money Payments**: Paystack integration for MTN Mobile Money & Vodafone Cash
- **Real-time Chat**: Firebase Realtime Database for instant messaging
- **Attendance Tracking**: Automatic attendance logging and reporting
- **Analytics Dashboard**: Student engagement metrics and revenue tracking
- **Mobile-First Design**: Optimized for Ghanaian students on mobile devices

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, ShadcnUI
- **Backend**: Firebase (Firestore, Auth, Realtime Database)
- **Real-time Media**: LiveKit WebRTC
- **State Management**: Redis (Optimized for high-concurrency)
- **Payment**: Paystack (1.95% fee for mobile money)
- **Video**: YouTube Live (unlisted streams)
- **Hosting**: Vercel & Contabo VPS

## � Performance Optimization (350+ Users)

The platform is specifically tuned to handle high-concurrency classroom environments on a standard VPS:

### Server-Level (Linux/VPS)
- **TCP BBR**: Enabled Google's BBR congestion control for maximum throughput and low latency.
- **System Limits**: `ulimits` increased to 65k to handle thousands of simultaneous media tracks.
- **Multi-threading**: Optimized to scale across 8+ CPU cores.

### Infrastructure
- **Redis State Management**: All session state is offloaded to Redis for sub-millisecond tracking.
- **Bare-Metal Networking**: Docker Host networking bypasses the NAT layer for peak performance.

### Frontend (Client-Side)
- **Adaptive Quality**: Utilizing `IntersectionObserver` to automatically pause or downscale off-screen video tiles, saving up to 80% bandwidth for students.
- **Component Memoization**: Preventing expensive re-renders in large grids using `React.memo`.

## 🔧 Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.local.example .env.local
```

4. Configure your `.env.local` file with:
   - Firebase credentials
   - Paystack API keys
   - LiveKit keys & URL
   - Application URL

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## 🔐 Environment Variables

See `.env.local.example` for required environment variables.

## 📱 Mobile Money Setup

Students can pay using:
- **MTN Mobile Money**: Dial *170# or use MoMo app
- **Vodafone Cash**: Dial *110# or use Vodafone app

## 👥 User Roles

### Lecturer
- Create and manage class sessions
- Set pricing (in Ghana Cedis)
- Start/stop live streams and WebRTC sessions
- Moderate chat
- View revenue and attendance reports

### Student
- Browse available classes
- Pay via mobile money
- Join live classes
- Participate in chat
- View personal attendance history

## 🏗️ Project Structure

```
podium-lms/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # User dashboards
│   └── classroom/         # Classroom interface
├── components/            # React components
├── lib/                   # Utility functions
├── contexts/             # React contexts
├── server-optimization/   # VPS tuning & LiveKit config scripts
└── public/               # Static assets
```

## 🚀 Deployment

Deploy the frontend to Vercel and the LiveKit server to a Contabo VPS using the provided scripts in `server-optimization/`.

## 📊 Cost Analysis

For 300 students paying GH₵20 per class:
- **Revenue**: GH₵6,000
- **Paystack Fee (1.95%)**: GH₵117
- **VPS Cost (Monthly)**: ~$15
- **Net Revenue**: GH₵5,868

## 🔒 Security

- Firebase Security Rules enforce role-based access
- Paystack webhook signature verification
- Server-side payment validation
- Protected API routes

## 📄 License

MIT

## 🤝 Support

For issues or questions, please open a GitHub issue.
