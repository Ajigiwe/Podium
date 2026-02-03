'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db, rtdb } from '@/lib/firebase/config';
import { doc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { ref, push, onChildAdded, off, update } from 'firebase/database';
import { Session } from '@/lib/firebase/types';
import ThemeToggle from '@/components/ThemeToggle';
import { useClassroom } from '@/contexts/ClassroomContext';
import '@livekit/components-styles';
import {
    VideoConference,
    RoomAudioRenderer,
    ControlBar,
    useParticipants,
    GridLayout,
    ParticipantTile,
    useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Participant } from 'livekit-client';
import ActiveSpeaker from '@/components/ActiveSpeaker';

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    content: string;
    createdAt: number;
    reactions?: {
        [emoji: string]: string[];
    };
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👏'];

interface ClassroomContentProps {
    session: Session;
    user: any;
    profile: any;
    sessionId: string;
}

export default function ClassroomContent({ session, user, profile, sessionId }: ClassroomContentProps) {
    const router = useRouter();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { leaveClass, participants, isMini } = useClassroom(); // Use global context

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [lastMessageTime, setLastMessageTime] = useState(0);
    const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
    const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; left: number }[]>([]);

    // Permission Management State
    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    // Note: 'participants' now comes from context

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Subscribe to chat messages
        const messagesRef = ref(rtdb, `chats/${sessionId}`);
        const handleNewMessage = (snapshot: any) => {
            const message = snapshot.val();
            if (message) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === snapshot.key)) return prev;
                    return [...prev, { id: snapshot.key!, ...message }];
                });
            }
        };
        onChildAdded(messagesRef, handleNewMessage);
        return () => {
            off(messagesRef, 'child_added', handleNewMessage);
        };
    }, [sessionId]);

    useEffect(() => {
        const reactionsRef = ref(rtdb, `reactions/${sessionId}`);
        const handleNewReactionEvent = (snapshot: any) => {
            const data = snapshot.val();
            if (data && Date.now() - data.timestamp < 5000) {
                addFloatingEmoji(data.emoji);
            }
        };
        onChildAdded(reactionsRef, handleNewReactionEvent);
        return () => {
            off(reactionsRef, 'child_added', handleNewReactionEvent);
        };
    }, [sessionId]);

    const addFloatingEmoji = (emoji: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        const left = Math.random() * 80 + 10;
        setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);
        setTimeout(() => {
            setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
        }, 4000);
    };

    const handleTogglePermission = async (p: Participant, type: 'cam' | 'mic') => {
        const currentCanPublish = p.permissions?.canPublish ?? false;
        const newCanPublish = !currentCanPublish;

        try {
            await fetch('/api/livekit/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room: sessionId,
                    identity: p.identity,
                    permissions: { canPublish: newCanPublish }
                })
            });
        } catch (error) {
            console.error("Failed to update permissions", error);
            alert("Failed to update permissions");
        }
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

    const handleLeave = () => {
        leaveClass();
        router.push('/dashboard/student');
    };

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
                                onClick={handleLeave}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Leave Class
                            </button>
                            {profile?.role === 'lecturer' && (
                                <button
                                    onClick={() => setShowParticipantsModal(true)}
                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                                >
                                    Participants ({participants.length})
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-80px)]">
                <div className="flex flex-col lg:flex-row gap-4 h-full">
                    {/* Video Conference Area (MOUNT POINT FOR PORTAL) */}
                    <div className="w-full lg:flex-1 h-[45vh] lg:h-full shrink-0 rounded-2xl overflow-hidden bg-black shadow-2xl relative order-1">

                        {/* This ID is CRITICAL - GlobalClassroom looks for this to mount local video */}
                        <div id="classroom-video-mount" className="w-full h-full relative" />

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

                        {/* Reaction Bar Overlay */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 z-[60]">
                            {EMOJI_OPTIONS.map((emoji) => (
                                <button
                                    key={emoji}
                                    onClick={() => {
                                        const id = Math.random().toString(36).substr(2, 9);
                                        const left = Math.random() * 80 + 10;
                                        // 1. Local Immediate Feedback
                                        setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);
                                        setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 4000);

                                        // 2. Network Sync
                                        try {
                                            const reactionsRef = ref(rtdb, `reactions/${sessionId}`);
                                            push(reactionsRef, {
                                                emoji,
                                                userId: user.uid,
                                                timestamp: Date.now()
                                            });
                                        } catch (e) { console.error(e); }
                                    }}
                                    className="p-2 hover:bg-white/20 rounded-full transition-colors text-2xl hover:scale-125 active:scale-95"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chat */}
                    <div className="w-full lg:w-[400px] flex-1 lg:h-full flex flex-col order-2 min-h-0">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex-1 flex flex-col border border-gray-200/50 dark:border-gray-700/50 overflow-hidden h-full">
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0 z-10 relative">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    Class Chat
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{messages.length} messages</p>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50 min-h-0">
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
                            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
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

            {showParticipantsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowParticipantsModal(false)} />
                    <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Participants ({participants.length})</h2>
                            <button onClick={() => setShowParticipantsModal(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4">
                            {participants.map((p) => {
                                const isLecturer = p.metadata?.includes("lecturer") || p.permissions?.canPublish;
                                return (
                                    <div key={p.sid} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                                                {p.identity?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white text-sm">{p.identity}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {p.permissions?.canPublish ? 'Lecturer/Preset' : 'Student'}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleTogglePermission(p, 'mic')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${p.permissions?.canPublish
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                }`}
                                        >
                                            {p.permissions?.canPublish ? 'Allowed' : 'Muted'}
                                        </button>
                                    </div>
                                );
                            })}
                            {participants.length === 0 && (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No other participants.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
