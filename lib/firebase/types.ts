import { Timestamp } from 'firebase/firestore';

// User Profile
export interface Profile {
    id: string;
    email: string;
    fullName: string;
    role?: 'student' | 'lecturer' | 'admin';
    bio?: string;
    photoURL?: string;
    displayIcon?: string; // Icon name from Lucide or custom set
    indexNumber?: string; // Student Index Number
    subscriptionStatus?: 'active' | 'inactive'; // Global subscription
    subscriptionExpiresAt?: Timestamp; // When subscription ends
    createdAt: Timestamp;
    updatedAt?: Timestamp;
    status?: 'active' | 'disabled';
    university?: string;
    classCount?: number; // Total unique classes joined (aggregated)
    isVerified?: boolean; // For Course Reps to create groups
    walletBalance?: number; // Virtual wallet balance in pesewas (GHS 1 = 100 pesewas)
}

export type UserProfile = Profile;

// System Settings (Global Config)
export interface SystemSettings {
    id: 'subscription';
    semesterFee: number; // Fee in GHS
    currency: string;
    durationMonths: number;
    isPayToUse?: boolean; // Toggle for "Pay before use" feature
    perClassFee?: number; // Fee per class in pesewas (default 600 = GHS 6)
    updatedAt: Timestamp;
}

// Class Session
export interface Session {
    id: string;
    title: string;
    hostId: string;
    lecturerId?: string; // Kept for backward compatibility during migration
    backupModId?: string;
    meetingCode: string; // Google Meet-style code (pod-xxxx-xxxx)
    youtubeVideoId: string | null;
    isActive: boolean;
    price: number; // Amount in pesewas (GH₵20 = 2000 pesewas)
    currency: string; // "GHS"
    isFree: boolean;
    lecturerName?: string; // Name of the lecturer teaching the class
    program?: string; // Program/Department (e.g. Computer Science)
    course?: string; // Course Name/Code (e.g. Data Structures)
    isDeleted?: boolean; // Soft delete flag
    scheduledStartTime?: Timestamp; // New field for class scheduling
    durationMinutes?: number; // Attendance: total duration planned
    verificationCount?: number; // Attendance: number of checks to perform
    autoAttendanceSettings?: {
        isEnabled: boolean;
        frequencyMinutes: number;
        lastTriggeredAt?: Timestamp;
    };
    autoApproveMic?: boolean;
    isMutedAll?: boolean;
    requireGuestDetails?: boolean;
    status?: 'active' | 'on_hold' | 'ended' | 'paused' | 'deleted';
    participantCount?: number;
    hostLastSeen?: Timestamp;
    modLastSeen?: Timestamp;
    host_absence_minutes?: number;
    auto_alert_triggered?: boolean;
    auto_alert_triggered_at?: Timestamp;
    createdAt: Timestamp;
    startedAt?: Timestamp; // When the lecturer actually started the session
    endedAt?: Timestamp; // When the session was ended
    groupId?: string; // Optional: Link session to a persistent group
}

// Attendance Statistics for a specific student in a session
export interface AttendanceRecord {
    id: string; // studentId
    studentName: string;
    studentIndexNumber?: string;
    joinedAt: Timestamp;
    leftAt?: Timestamp | null;
    totalVerificationsSent: number;
    totalVerificationsCompleted: number;
    verificationPercentage: number; // calculated field
    isPresent: boolean;
}

// A specific verification event (popup) triggered during a session
export interface VerificationEvent {
    id: string; // auto-gen
    verificationNumber: number;
    triggeredBy: 'automatic' | 'manual';
    triggeredAt: Timestamp;
    expiresAt: Timestamp;
    timeLimitSeconds: number;
}

// A student's response to a specific verification event
export interface VerificationResponse {
    id: string; // studentId
    attendanceRecordId: string;
    respondedAt: Timestamp;
    responseTimeSeconds: number; // How long it took to click (for engagement metrics)
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
    userEmail?: string;
    joinedAt: Timestamp;
    lecturerId?: string; // New field for filtering
    sessionTitle?: string; // New field for history display
}

// Co-Host (Firestore subcollection: sessions/{id}/co_hosts/{userId})
export interface CoHost {
    userId: string;
    userName: string;
    assignedBy: string; // hostId of the lecturer who assigned
    assignedAt: Timestamp;
    isActive: boolean;
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

// Persistent Group/Class
export interface Group {
    id: string;
    name: string;
    description: string;
    ownerId: string;
    ownerName: string;
    ownerEmail?: string; // For notifications
    isPublic: boolean; // If false, it won't show in discovery
    joinCode?: string; // Secret code to find/join private groups
    memberCount: number;
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}

// Group Membership
export interface GroupMembership {
    id: string; // userId_groupId
    userId: string;
    groupId: string;
    role: 'owner' | 'instructor' | 'student';
    joinedAt: Timestamp;
    userEmail?: string;
    userName?: string;
}

// Join Request
export interface GroupRequest {
    id: string;
    userId: string;
    groupId: string;
    userName: string;
    userEmail: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Timestamp;
}
