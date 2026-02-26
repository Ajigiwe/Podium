'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { History, Trash2, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import Link from 'next/link';

interface AttendanceLog {
    id: string;
    sessionId: string;
    sessionTitle: string;
    userId: string;
    joinedAt: Timestamp;
}

function HistoryContent() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'joined' | 'hosted'>('joined');

    // Joined Classes Data
    const [joinHistoryData, setJoinHistoryData] = useState<AttendanceLog[]>([]);
    const [loadingJoin, setLoadingJoin] = useState(true);

    // Hosted Classes Data
    const [hostedClassesData, setHostedClassesData] = useState<any[]>([]);
    const [loadingHosted, setLoadingHosted] = useState(true);

    useEffect(() => {
        const fetchJoinHistory = async () => {
            if (!user) {
                setLoadingJoin(false);
                return;
            }
            try {
                const q = query(
                    collection(db, 'attendance_logs'),
                    where('userId', '==', user.uid),
                    orderBy('joinedAt', 'desc')
                );
                const snap = await getDocs(q);
                setJoinHistoryData(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceLog)));
            } catch (e) {
                console.warn('Failed to fetch join history:', e);
            } finally {
                setLoadingJoin(false);
            }
        };

        const fetchHostedClasses = async () => {
            if (!user) {
                setLoadingHosted(false);
                return;
            }
            try {
                // Classes are usually created with lecturerId matching the host's uid
                const q = query(
                    collection(db, 'sessions'),
                    where('lecturerId', '==', user.uid),
                    orderBy('createdAt', 'desc')
                );
                const snap = await getDocs(q);
                setHostedClassesData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.warn('Failed to fetch hosted classes:', e);
                // Try fallback query without orderBy in case index is missing
                try {
                    const fallbackQ = query(
                        collection(db, 'sessions'),
                        where('lecturerId', '==', user.uid)
                    );
                    const fallbackSnap = await getDocs(fallbackQ);
                    const data = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    // Sort locally
                    data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    setHostedClassesData(data);
                } catch (fallbackErr) {
                    console.error('Fallback query also failed:', fallbackErr);
                }
            } finally {
                setLoadingHosted(false);
            }
        };

        fetchJoinHistory();
        fetchHostedClasses();
    }, [user]);

    const handleDeleteRecord = async (item: AttendanceLog) => {
        if (confirm('Delete this record?')) {
            try {
                await deleteDoc(doc(db, 'attendance_logs', item.id));
                setJoinHistoryData(p => p.filter(i => i.id !== item.id));
            } catch (err) {
                console.error("Failed to delete record:", err);
            }
        }
    };

    if (loadingJoin || loadingHosted) {
        return (
            <div className="space-y-8 max-w-5xl mx-auto">
                <Skeleton className="h-10 w-64 rounded-xl" />
                <div className="space-y-4">
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard" className="p-2 hover:bg-gray-100  rounded-xl transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-gray-900  flex items-center gap-3">
                        <History className="w-7 h-7 text-blue-500" />
                        Class History
                    </h1>
                    <p className="text-gray-500  font-medium mt-1">
                        A record of all the sessions you have joined or hosted.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200  pb-2">
                <button
                    onClick={() => setActiveTab('joined')}
                    className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'joined' ? 'bg-blue-600 text-white border border-blue-700' : 'text-gray-500 hover:bg-gray-100 '}`}
                >
                    Classes You Joined
                </button>
                <button
                    onClick={() => setActiveTab('hosted')}
                    className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'hosted' ? 'bg-indigo-600 text-white border border-indigo-700' : 'text-gray-500 hover:bg-gray-100 '}`}
                >
                    Classes You Hosted
                </button>
            </div>

            <div className="bg-white  border border-gray-200  rounded-2xl overflow-hidden">
                {activeTab === 'joined' ? (
                    joinHistoryData.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center justify-center bg-gray-50 ">
                            <History className="w-12 h-12 text-gray-300  mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 ">No join history</h3>
                            <p className="text-gray-500 font-medium">You haven&apos;t joined any classes yet.</p>
                            <Link href="/dashboard" className="mt-6 px-6 py-2 bg-gray-900  text-white  rounded-xl font-bold text-sm">
                                Join a Class
                            </Link>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200  bg-gray-50/50 ">
                                    <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-gray-500 ">Class Information</th>
                                    <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-gray-500 ">Joined Date</th>
                                    <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-gray-500  text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 ">
                                {joinHistoryData.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50  transition-colors group">
                                        <td className="py-4 px-6">
                                            <h4 className="font-bold text-gray-900  text-sm md:text-base">
                                                {item.sessionTitle || 'Unknown Class'}
                                            </h4>
                                        </td>
                                        <td className="py-4 px-6">
                                            <p className="text-sm font-medium text-gray-500 ">
                                                {item.joinedAt?.toDate?.().toLocaleString() || 'N/A'}
                                            </p>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <button
                                                onClick={() => handleDeleteRecord(item)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50  rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                title="Delete Record"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                ) : (
                    hostedClassesData.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center justify-center bg-gray-50 ">
                            <History className="w-12 h-12 text-gray-300  mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 ">No hosted classes</h3>
                            <p className="text-gray-500 font-medium">You haven&apos;t hosted any classes yet.</p>
                            <Link href="/dashboard" className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm">
                                Class Setup
                            </Link>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200  bg-gray-50/50 ">
                                    <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-gray-500 ">Class Title</th>
                                    <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-gray-500  mt-0">Participants Joined</th>
                                    <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-gray-500  mt-0">Status</th>
                                    <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-gray-500  text-right">Date Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 ">
                                {hostedClassesData.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50  transition-colors group">
                                        <td className="py-4 px-6">
                                            <h4 className="font-bold text-gray-900  text-sm md:text-base">
                                                {item.title || 'Untitled Class'}
                                            </h4>
                                            <p className="text-xs text-gray-500 mono">Code: {item.meetingCode}</p>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700   border border-indigo-200 ">
                                                {item.participantCount || 0} participants
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.status === 'deleted' ? 'bg-red-100 text-red-700  ' :
                                                item.isActive ? 'bg-green-100 text-green-700  ' :
                                                    'bg-gray-100 text-gray-700  '
                                                }`}>
                                                {item.status || (item.isActive ? 'Active' : 'Offline')}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <p className="text-sm font-medium text-gray-500 ">
                                                {item.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                )}
            </div>
        </div>
    );
}

export default function HistoryPage() {
    return (
        <Suspense fallback={
            <div className="space-y-8 max-w-5xl mx-auto p-8">
                <Skeleton className="h-10 w-64 rounded-xl" />
                <div className="space-y-4">
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                </div>
            </div>
        }>
            <HistoryContent />
        </Suspense>
    );
}
