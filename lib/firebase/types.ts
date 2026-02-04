import { Timestamp } from 'firebase/firestore';

// User Profile
export interface Profile {
    id: string;
    email: string;
    fullName: string;
    role: 'student' | 'lecturer';
    bio?: string;
    photoURL?: string;
    indexNumber?: string; // Student Index Number
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}

// Class Session
export interface Session {
    id: string;
    title: string;
    lecturerId: string;
    meetingCode: string; // Google Meet-style code (pod-xxxx-xxxx)
    youtubeVideoId: string | null;
    isActive: boolean;
    price: number; // Amount in pesewas (GH₵20 = 2000 pesewas)
    currency: string; // "GHS"
    isFree: boolean;
    createdAt: Timestamp;
}

// Transaction (Payment Record)
export interface Transaction {
    id: string;
    userId: string;
    sessionId: string;
    paystackReference: string;
    amount: number; // Amount in pesewas
    currency: string; // "GHS"
    paymentChannel: 'mobile_money_mtn' | 'mobile_money_vodafone' | 'card';
    status: 'pending' | 'succeeded' | 'failed' | 'refunded';
    createdAt: Timestamp;
    paidAt: Timestamp | null;
    isHidden?: boolean; // New field to support removing/hiding classes
}

// Attendance Log
export interface AttendanceLog {
    id: string;
    sessionId: string;
    userId: string;
    userName: string;
    userIndexNumber?: string;
    joinedAt: Timestamp;
}

// Chat Message (Realtime Database)
export interface ChatMessage {
    id: string;
    sessionId: string;
    userId: string;
    userName: string;
    userRole: 'student' | 'lecturer';
    content: string;
    createdAt: number; // Unix timestamp
}
