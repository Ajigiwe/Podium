# Podium - Virtual Classroom System

A scalable, zero-ops virtual classroom platform for Ghanaian students supporting 300+ concurrent users with YouTube Live streaming and mobile money payments.

## 🚀 Features

- **Live Video Streaming**: YouTube Live integration for scalable video delivery
- **Mobile Money Payments**: Paystack integration for MTN Mobile Money & Vodafone Cash
- **Real-time Chat**: Firebase Realtime Database for instant messaging
- **Attendance Tracking**: Automatic attendance logging and reporting
- **Analytics Dashboard**: Student engagement metrics and revenue tracking
- **Mobile-First Design**: Optimized for Ghanaian students on mobile devices

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, ShadcnUI
- **Backend**: Firebase (Firestore, Auth, Realtime Database)
- **Payment**: Paystack (1.95% fee for mobile money)
- **Video**: YouTube Live (unlisted streams)
- **Hosting**: Vercel

## 📋 Prerequisites

- Node.js 18+ and npm
- Firebase project
- Paystack account (Ghana)
- YouTube account with live streaming enabled

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
- Start/stop live streams
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
│   ├── firebase/         # Firebase configuration
│   ├── paystack/         # Paystack integration
│   └── utils/            # Helper functions
├── contexts/             # React contexts
└── public/               # Static assets
```

## 🚀 Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Configure environment variables in Vercel dashboard.

## 📊 Cost Analysis

For 300 students paying GH₵20 per class:
- **Revenue**: GH₵6,000
- **Paystack Fee (1.95%)**: GH₵117
- **Net Revenue**: GH₵5,883

## 🔒 Security

- Firebase Security Rules enforce role-based access
- Paystack webhook signature verification
- Server-side payment validation
- Protected API routes

## 📄 License

MIT

## 🤝 Support

For issues or questions, please open a GitHub issue.
