import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { Session } from '@/lib/firebase/types';
import { X, Calendar, Clock, Video, Users, CreditCard } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

interface LecturerClassesModalProps {
    isOpen: boolean;
    onClose: () => void;
    lecturerId: string;
    lecturerName: string;
}

export default function LecturerClassesModal({ isOpen, onClose, lecturerId, lecturerName }: LecturerClassesModalProps) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && lecturerId) {
            fetchClasses();
        }
    }, [isOpen, lecturerId]);

    const fetchClasses = async () => {
        setLoading(true);
        try {
            const sessionsRef = collection(db, 'sessions');
            // Query sessions created by this lecturer
            const q = query(
                sessionsRef,
                where('lecturerId', '==', lecturerId),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const fetchedSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setSessions(fetchedSessions);
        } catch (error) {
            console.error('Error fetching lecturer classes:', error);
            // alert('Failed to load classes.'); // Optional: Use a toast instead
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-white rounded-lg border border-gray-200 w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
            <div className="bg-white px-4 py-3 border-b flex items-center justify-between rounded-t-lg">
                <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-gray-900 ">Class History</h2>
                        <p className="text-sm text-gray-500 ">
                            Classes created by <span className="font-semibold text-purple-600">{lecturerName}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600  rounded-full hover:bg-gray-100  transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Skeleton key={i} className="h-16 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-12">
                            <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">No classes created by this lecturer yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-gray-200 ">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50  text-xs uppercase text-gray-500 font-semibold">
                                    <tr>
                                        <th className="p-4">Class Title</th>
                                        <th className="p-4">Program / Course</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Price</th>
                                        <th className="p-4">Created At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 ">
                                    {sessions.map((session) => (
                                        <tr key={session.id} className="hover:bg-gray-50  transition-colors">
                                            <td className="p-4">
                                                <p className="font-medium text-gray-900 ">{session.title}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-gray-500 bg-gray-100  px-2 py-0.5 rounded-full font-mono">
                                                        {session.meetingCode}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <p className="text-sm text-gray-900 ">{session.program || 'N/A'}</p>
                                                <p className="text-xs text-gray-500">{session.course || 'N/A'}</p>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${session.isActive
                                                    ? 'bg-green-100 text-green-700  '
                                                    : 'bg-gray-100 text-gray-700  '
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${session.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                                    {session.isActive ? 'Active' : 'Ended'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {session.isFree ? (
                                                    <span className="text-xs font-bold text-green-600 bg-green-50  px-2 py-1 rounded">
                                                        Free
                                                    </span>
                                                ) : (
                                                    <span className="text-sm font-medium text-gray-900  flex items-center gap-1">
                                                        <CreditCard className="w-3 h-3 text-gray-400" />
                                                        GH₵{((session.price || 0) / 100).toFixed(2)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col text-sm text-gray-500">
                                                    <span className="flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {session.createdAt?.toDate().toLocaleDateString()}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 mt-0.5 text-xs">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {session.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200  bg-gray-50  flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white  border border-gray-300  text-gray-700  text-sm font-medium rounded-lg hover:bg-gray-50  transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
