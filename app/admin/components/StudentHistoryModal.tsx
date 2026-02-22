'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { AttendanceLog } from '@/lib/firebase/types';
import { X, Calendar, BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

interface StudentHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentId: string;
    studentName: string;
}

export default function StudentHistoryModal({ isOpen, onClose, studentId, studentName }: StudentHistoryModalProps) {
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && studentId) {
            fetchHistory();
        }
    }, [isOpen, studentId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const logsRef = collection(db, 'attendance_logs');
            const q = query(
                logsRef,
                where('userId', '==', studentId),
                orderBy('joinedAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceLog));
            setLogs(fetchedLogs);
        } catch (error) {
            console.error('Error fetching student history:', error);
            alert('Failed to load class history.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-blue-600" />
                            Class History
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Listing all classes joined by <span className="font-medium text-gray-900 dark:text-white">{studentName}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map(i => (
                                <Skeleton key={i} className="h-20 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                            No classes joined yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log) => (
                                <div key={log.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-900 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                                            {log.sessionTitle ? log.sessionTitle.substring(0, 2).toUpperCase() : 'CL'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">
                                                {log.sessionTitle || 'Unknown Class'}
                                            </p>
                                            <p className="text-xs text-gray-500 font-mono">
                                                SID: {log.sessionId}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {log.joinedAt?.toDate ? log.joinedAt.toDate().toLocaleDateString() : 'N/A'}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {log.joinedAt?.toDate ? log.joinedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
