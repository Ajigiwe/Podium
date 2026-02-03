'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, rtdb } from '@/lib/firebase/config';
import { doc, getDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { ref, push, onChildAdded, off, update } from 'firebase/database';
import { Session } from '@/lib/firebase/types';
import { hasUserPaid } from '@/lib/payments/verifyPayment';
import ThemeToggle from '@/components/ThemeToggle';
import '@livekit/components-styles';
import {
    LiveKitRoom,
    VideoConference,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    ControlBar,
    useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    content: string;
    createdAt: number;
    reactions?: {
        [emoji: string]: string[]; // emoji -> array of userIds
    };
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👏'];

export default function ClassroomPage() {
    const params = useParams();
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const sessionId = params.id as string;
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [session, setSession] = useState<Session | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [canAccess, setCanAccess] = useState(false);
    const [lastMessageTime, setLastMessageTime] = useState(0);
    const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
    const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; left: number }[]>([]);

    // LiveKit state
    const [token, setToken] = useState('');

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (authLoading) return;

        if (!user || !profile) {
            const currentPath = window.location.pathname + window.location.search;
            router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
            return;
        }

        const loadSession = async () => {
            try {
                // Get session details
                const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
                if (!sessionDoc.exists()) {
                    alert('Session not found');
                    router.push('/');
                    return;
                }

                const sessionData = { id: sessionDoc.id, ...sessionDoc.data() } as Session;
                setSession(sessionData);

                // Check access
                const isLecturer = profile.role === 'lecturer' && sessionData.lecturerId === user.uid;
                const hasPaidAccess = sessionData.isFree || (await hasUserPaid(user.uid, sessionId));

                if (!isLecturer && !hasPaidAccess) {
                    const searchParams = new URLSearchParams(window.location.search);
                    const reference = searchParams.get('reference');

                    if (reference) {
                        try {
                            const verifyRes = await fetch(`/api/paystack/verify?reference=${reference}`);
                            const verifyData = await verifyRes.json();

                            if (verifyRes.ok && verifyData.success) {
                                setCanAccess(true);
                                setLoading(false);
                                return;
                            }
                        } catch (err) {
                            console.error("Manual verification failed", err);
                        }
                    }

                    alert('You need to pay to access this class');
                    router.push('/dashboard/student');
                    return;
                }

                setCanAccess(true);

                // Log attendance
                if (profile.role === 'student') {
                    await addDoc(collection(db, 'attendance_logs'), {
                        sessionId,
                        userId: user.uid,
                        joinedAt: Timestamp.now(),
                    });
                }

                // Fetch LiveKit Token
                // Use session title as room name or ID
                const roomName = sessionData.id;
                try {
                    const resp = await fetch(
                        `/api/livekit/token?room=${roomName}&username=${encodeURIComponent(profile.fullName)}&role=${profile.role}`
                    );
                    const data = await resp.json();
                    if (data.token) {
                        setToken(data.token);
                    } else {
                        console.error('Failed to get token:', data.error);
                        alert('Failed to connect to video server');
                    }
                } catch (e) {
                    console.error(e);
                    alert('Failed to connect to video server');
                }

                setLoading(false);
            } catch (error) {
                console.error('Error loading session:', error);
                alert('Failed to load session');
                router.push('/');
            }
        };

        loadSession();
    }, [user, profile, sessionId, router]);

    useEffect(() => {
        if (!canAccess) return;

        // Subscribe to chat messages
        const messagesRef = ref(rtdb, `chats/${sessionId}`);

        const handleNewMessage = (snapshot: any) => {
            const message = snapshot.val();
            if (message) {
                setMessages((prev) => [...prev, { id: snapshot.key!, ...message }]);
            }
        };

        onChildAdded(messagesRef, handleNewMessage);

        return () => {
            off(messagesRef, 'child_added', handleNewMessage);
        };
    }, [canAccess, sessionId]);

    // Optimize: Listen for reactions separately for live effect
    useEffect(() => {
        if (!canAccess) return;

        const reactionsRef = ref(rtdb, `reactions/${sessionId}`);
        const handleNewReactionEvent = (snapshot: any) => {
            const data = snapshot.val();
            // Only show if it's new (timestamp check could be added, but for now just show all incoming)
            if (data && Date.now() - data.timestamp < 5000) {
                addFloatingEmoji(data.emoji);
            }
        };
        // Use child_added so we get every new reaction pushed
        onChildAdded(reactionsRef, handleNewReactionEvent);

        return () => {
            off(reactionsRef, 'child_added', handleNewReactionEvent);
        };
    }, [canAccess, sessionId]);

    const addFloatingEmoji = (emoji: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        const left = Math.random() * 80 + 10; // 10% to 90%
        setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);
        setTimeout(() => {
            setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
        }, 4000); // Remove after 4s animation
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !user || !profile) return;

        const now = Date.now();
        if (now - lastMessageTime < 3000) {
            alert('Please wait before sending another message');
            return;
        }

        try {
            const messagesRef = ref(rtdb, `chats/${sessionId}`);
            await push(messagesRef, {
                userId: user.uid,
                userName: profile.fullName,
                userRole: profile.role || 'student',
                content: newMessage,
                createdAt: now,
                reactions: {},
            });

            setNewMessage('');
            setLastMessageTime(now);
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        }
    };

    const handleReaction = async (messageId: string, emoji: string) => {
        if (!user) return;

        const message = messages.find((m) => m.id === messageId);
        if (!message) return;

        const reactions = message.reactions || {};
        const userReactions = reactions[emoji] || [];

        let updatedReactions;
        if (userReactions.includes(user.uid)) {
            updatedReactions = {
                ...reactions,
                [emoji]: userReactions.filter((id) => id !== user.uid),
            };
        } else {
            updatedReactions = {
                ...reactions,
                [emoji]: [...userReactions, user.uid],
            };

            // Push to transient path for live floating effect
            try {
                const reactionsRef = ref(rtdb, `reactions/${sessionId}`);
                push(reactionsRef, {
                    emoji,
                    userId: user.uid,
                    timestamp: Date.now()
                });
            } catch (e) { console.error(e); }
        }

        try {
            const messageRef = ref(rtdb, `chats/${sessionId}/${messageId}`);
            await update(messageRef, { reactions: updatedReactions });

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === messageId ? { ...m, reactions: updatedReactions } : m
                )
            );
        } catch (error) {
            console.error('Error updating reaction:', error);
        }

        setShowEmojiPicker(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white mx-auto"></div>
                    <p className="mt-4 text-white text-lg font-medium">Loading classroom...</p>
                </div>
            </div>
        );
    }

    if (!session || !canAccess) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950">
            {/* Header */}
            <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg shadow-sm border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{session.title}</h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Live Classroom</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <ThemeToggle />
                            <button
                                onClick={() => router.push('/')}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Back to Home
                            </button>
                            <button
                                onClick={() => router.back()}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Leave Class
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-80px)]">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
                    {/* Video Conference Area */}
                    <div className="lg:col-span-3 h-full rounded-2xl overflow-hidden bg-black shadow-2xl relative">
                        {/* Floating Emojis Overlay */}
                        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                            {floatingEmojis.map((feat) => (
                                <div
                                    key={feat.id}
                                    className="absolute bottom-0 text-5xl animate-float-up opacity-0"
                                    style={{
                                        left: `${feat.left}%`,
                                        animationDuration: `${3 + Math.random()}s`
                                    }}
                                >
                                    {feat.emoji}
                                </div>
                            ))}
                        </div>
                        {token === '' ? (
                            <div className="flex items-center justify-center h-full text-white">
                                Preparing video connection...
                            </div>
                        ) : (
                            <LiveKitRoom
                                video={true}
                                audio={true}
                                token={token}
                                serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
                                data-lk-theme="default"
                                style={{ height: '100%' }}
                            >
                                <VideoConference />
                                <RoomAudioRenderer />
                                <ControlBar />
                            </LiveKitRoom>
                        )}
                    </div>

                    {/* Chat */}
                    <div className="lg:col-span-1 h-full flex flex-col">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex-1 flex flex-col border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    Class Chat
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{messages.length} messages</p>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50">
                                {messages.map((message) => {
                                    const isOwnMessage = message.userId === user?.uid;
                                    const isLecturer = message.userRole === 'lecturer';

                                    return (
                                        <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                                {/* User info */}
                                                <div className="flex items-center gap-2 px-1">
                                                    <span className={`text-xs font-bold ${isLecturer ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                                        {message.userName}
                                                    </span>
                                                    {isLecturer && (
                                                        <span className="text-[10px] uppercase tracking-wider bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded font-bold">
                                                            Lecturer
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Message bubble */}
                                                <div className={`relative group px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isOwnMessage
                                                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                                                    : isLecturer
                                                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-gray-900 dark:text-yellow-100 rounded-tl-sm'
                                                        : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-tl-sm'
                                                    }`}>
                                                    <p className="break-words leading-relaxed">{message.content}</p>

                                                    {/* Reaction button */}
                                                    <button
                                                        onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                                                        className={`absolute -bottom-3 ${isOwnMessage ? 'left-0' : 'right-0'} opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-800 rounded-full p-1 shadow-md border border-gray-100 dark:border-gray-700 hover:scale-110 z-10`}
                                                    >
                                                        <span className="text-xs leading-none">😊</span>
                                                    </button>

                                                    {/* Emoji picker */}
                                                    {showEmojiPicker === message.id && (
                                                        <div className={`absolute bottom-full mb-2 ${isOwnMessage ? 'left-0' : 'right-0'} bg-white dark:bg-gray-800 rounded-xl shadow-xl p-2 flex gap-1 z-20 border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200`}>
                                                            {EMOJI_OPTIONS.map((emoji) => (
                                                                <button
                                                                    key={emoji}
                                                                    onClick={() => handleReaction(message.id, emoji)}
                                                                    className="hover:scale-125 transition-transform p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Reactions display */}
                                                {message.reactions && Object.keys(message.reactions).length > 0 && (
                                                    <div className="flex flex-wrap gap-1 px-1 mt-0.5">
                                                        {Object.entries(message.reactions).map(([emoji, userIds]) =>
                                                            userIds.length > 0 ? (
                                                                <button
                                                                    key={emoji}
                                                                    onClick={() => handleReaction(message.id, emoji)}
                                                                    className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 transition-all border ${userIds.includes(user?.uid || '')
                                                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800'
                                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                                        }`}
                                                                >
                                                                    <span>{emoji}</span>
                                                                    <span className="text-gray-500 dark:text-gray-400 font-medium">{userIds.length}</span>
                                                                </button>
                                                            ) : null
                                                        )}
                                                    </div>
                                                )}

                                                <span className="text-[10px] text-gray-400 px-1">
                                                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type a message..."
                                        className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent dark:border-gray-700 transition-all"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim()}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
