'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, rtdb } from '@/lib/firebase/config';
import { doc, getDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { ref, push, onChildAdded, off, update } from 'firebase/database';
import { Session } from '@/lib/firebase/types';
import { hasUserPaid } from '@/lib/payments/verifyPayment';
import dynamic from 'next/dynamic';
import ThemeToggle from '@/components/ThemeToggle';
import type { ComponentType } from 'react';

const ReactPlayer = dynamic(() => import('react-player'), {
    ssr: false
}) as ComponentType<any>;

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
                    // Start of new verification logic
                    const searchParams = new URLSearchParams(window.location.search);
                    const reference = searchParams.get('reference');

                    if (reference) {
                        // Check if this reference is valid via our API
                        try {
                            const verifyRes = await fetch(`/api/paystack/verify?reference=${reference}`);
                            const verifyData = await verifyRes.json();

                            if (verifyRes.ok && verifyData.success) {
                                // Payment verified!
                                setCanAccess(true);
                                setLoading(false);
                                return; // Skip the redirect
                            }
                        } catch (err) {
                            console.error("Manual verification failed", err);
                        }
                    }
                    // End of new verification logic

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

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !user || !profile) return;

        // Throttle messages (1 message per 3 seconds)
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
            // Remove reaction
            updatedReactions = {
                ...reactions,
                [emoji]: userReactions.filter((id) => id !== user.uid),
            };
        } else {
            // Add reaction
            updatedReactions = {
                ...reactions,
                [emoji]: [...userReactions, user.uid],
            };
        }

        try {
            const messageRef = ref(rtdb, `chats/${sessionId}/${messageId}`);
            await update(messageRef, { reactions: updatedReactions });

            // Update local state
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{session.title}</h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Live Classroom</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <ThemeToggle />
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
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Video Player */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
                            {session.youtubeVideoId ? (
                                <div className="aspect-video">
                                    <ReactPlayer
                                        url={`https://www.youtube.com/watch?v=${session.youtubeVideoId}`}
                                        width="100%"
                                        height="100%"
                                        controls={true}
                                        playing={true}
                                    />
                                </div>
                            ) : (
                                <div className="aspect-video flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                                    <p className="text-gray-500 dark:text-gray-400">No video available</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chat */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl h-[600px] flex flex-col border border-gray-200/50 dark:border-gray-700/50">
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    Live Chat
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{messages.length} messages</p>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.length === 0 ? (
                                    <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-8">No messages yet. Start the conversation!</p>
                                ) : (
                                    messages.map((message) => {
                                        const isOwnMessage = message.userId === user?.uid;
                                        const isLecturer = message.userRole === 'lecturer';

                                        return (
                                            <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                                    {/* User info */}
                                                    <div className="flex items-center gap-2 px-1">
                                                        <span className={`text-xs font-medium ${isLecturer ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                                            {message.userName}
                                                        </span>
                                                        {isLecturer && (
                                                            <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                                                                Lecturer
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>

                                                    {/* Message bubble */}
                                                    <div className={`relative group px-4 py-2 rounded-2xl ${isOwnMessage
                                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                                                        : isLecturer
                                                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-gray-900 dark:text-yellow-100'
                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                                                        }`}>
                                                        <p className="text-sm break-words">{message.content}</p>

                                                        {/* Reaction button */}
                                                        <button
                                                            onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                                                            className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-600 rounded-full p-1 shadow-lg hover:scale-110"
                                                        >
                                                            <span className="text-xs">😊</span>
                                                        </button>

                                                        {/* Emoji picker */}
                                                        {showEmojiPicker === message.id && (
                                                            <div className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-700 rounded-lg shadow-xl p-2 flex gap-1 z-10 border border-gray-200 dark:border-gray-600">
                                                                {EMOJI_OPTIONS.map((emoji) => (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => handleReaction(message.id, emoji)}
                                                                        className="hover:scale-125 transition-transform p-1"
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Reactions display */}
                                                    {message.reactions && Object.keys(message.reactions).length > 0 && (
                                                        <div className="flex gap-1 px-1">
                                                            {Object.entries(message.reactions).map(([emoji, userIds]) =>
                                                                userIds.length > 0 ? (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => handleReaction(message.id, emoji)}
                                                                        className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 transition-all ${userIds.includes(user?.uid || '')
                                                                            ? 'bg-indigo-100 dark:bg-indigo-900 border-2 border-indigo-500'
                                                                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                                            }`}
                                                                    >
                                                                        <span>{emoji}</span>
                                                                        <span className="text-gray-600 dark:text-gray-400">{userIds.length}</span>
                                                                    </button>
                                                                ) : null
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type a message..."
                                        className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-200 dark:border-gray-600"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim()}
                                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg transition-all"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    Rate limit: 1 message per 3 seconds
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
