'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useClassroom } from '@/contexts/ClassroomContext';
import { Send, User } from 'lucide-react';

interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    createdAt: Timestamp;
    role: 'lecturer' | 'student';
}

interface ClassroomChatProps {
    sessionId: string;
    height?: string;
}

export default function ClassroomChat({ sessionId, height = '100%' }: ClassroomChatProps) {
    const { userName, userId, userRole, liveMessages, sendMessage } = useClassroom();
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [liveMessages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        sendMessage(newMessage.trim());
        setNewMessage('');
    };

    return (
        <div className="flex flex-col bg-gray-900 border-l border-gray-800" style={{ height }}>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {liveMessages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-4">
                        No messages yet. Start the conversation!
                    </div>
                ) : (
                    liveMessages.map((msg) => {
                        const isMe = msg.senderId === userId;
                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <span className="text-xs font-bold text-gray-300 mx-1">{msg.senderName}</span>
                                    {msg.senderRole === 'lecturer' && (
                                        <span className="text-[9px] bg-indigo-900/50 text-indigo-400 px-1 rounded uppercase tracking-wide font-black">
                                            Lecturer
                                        </span>
                                    )}
                                    <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">LIVE</span>
                                </div>
                                <div
                                    className={`px-4 py-2 rounded-2xl text-sm max-w-[85%] break-words ${isMe
                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                        : 'bg-gray-800 text-gray-200 rounded-bl-none border border-white/5'
                                        }`}
                                >
                                    {msg.content || msg.text}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 border-t border-gray-800 bg-gray-900">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full bg-gray-800 text-gray-100 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-gray-500 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
}
