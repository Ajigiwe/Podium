'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { History as HistoryIcon, Trash2, Video, GraduationCap, ChevronRight, Users, Calendar, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import AttendanceHistoryModal from '@/components/AttendanceHistoryModal';
import RecordingsHistoryModal from '@/components/RecordingsHistoryModal';

interface AttendanceLog { id: string; sessionId: string; sessionTitle: string; userId: string; joinedAt: Timestamp; }

function HistoryContent() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'joined' | 'hosted'>('joined');
    const [joinHistoryData, setJoinHistoryData] = useState<AttendanceLog[]>([]);
    const [loadingJoin, setLoadingJoin] = useState(true);
    const [hostedClassesData, setHostedClassesData] = useState<any[]>([]);
    const [loadingHosted, setLoadingHosted] = useState(true);
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [showRecordingsModal, setShowRecordingsModal] = useState(false);

    useEffect(() => {
        const fetchJoinHistory = async () => {
            if (!user) return setLoadingJoin(false);
            try {
                const snap = await getDocs(query(collection(db, 'attendance_logs'), where('userId', '==', user.uid), orderBy('joinedAt', 'desc')));
                setJoinHistoryData(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceLog)));
            } catch (e) {} finally { setLoadingJoin(false); }
        };
        const fetchHostedClasses = async () => {
            if (!user) return setLoadingHosted(false);
            const counts: Record<string, Set<string>> = {};
            try {
                const sessionsSnap = await getDocs(query(collection(db, 'sessions'), where('lecturerId', '==', user.uid), orderBy('createdAt', 'desc')));
                const logsSnap = await getDocs(query(collection(db, 'attendance_logs'), where('lecturerId', '==', user.uid)));
                logsSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.sessionId && data.userId) { if (!counts[data.sessionId]) counts[data.sessionId] = new Set(); counts[data.sessionId].add(data.userId); }
                });
                setHostedClassesData(sessionsSnap.docs.map(d => ({ id: d.id, ...d.data(), participantCount: counts[d.id]?.size || 0 })));
            } catch (e) {} finally { setLoadingHosted(false); }
        };
        fetchJoinHistory(); fetchHostedClasses();
    }, [user]);

    const handleDeleteRecord = async (item: AttendanceLog) => { if (confirm('Permanently remove this entry?')) { try { await deleteDoc(doc(db, 'attendance_logs', item.id)); setJoinHistoryData(p => p.filter(i => i.id !== item.id)); } catch (err) {} } };

    if (loadingJoin || loadingHosted) return <div className="space-y-8 animate-pulse"><Skeleton className="h-10 w-48 bg-white border border-[#DDE0F0]" /><Skeleton className="h-24 bg-white border border-[#DDE0F0]" /><div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 bg-white border border-[#DDE0F0]" />)}</div></div>;

    return (
        <div className="space-y-8">
            {/* Header (Based on dashboard.html style) */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-3xl font-serif text-[#0D0D1A] tracking-tighter">History</h1>
                    <p className="text-[13px] text-[#8888A8] font-medium mt-1">Review your academic records</p>
                </div>
                <div className="flex p-1 bg-white border border-[#DDE0F0] rounded-lg shadow-sm">
                    <button onClick={() => setActiveTab('joined')} className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded transition-all ${activeTab === 'joined' ? 'bg-[#1845D4] text-white' : 'text-[#8888A8] hover:text-[#0D0D1A]'}`}>Classes Joined</button>
                    <button onClick={() => setActiveTab('hosted')} className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded transition-all ${activeTab === 'hosted' ? 'bg-[#1845D4] text-white' : 'text-[#8888A8] hover:text-[#0D0D1A]'}`}>Classes Hosted</button>
                </div>
            </div>

            {/* Stats Summary (Compact Card) */}
            <div className="bg-white border border-[#DDE0F0] rounded-lg p-6 shadow-sm inline-block min-w-[240px]">
                <div className="text-[11px] font-bold text-[#8888A8] uppercase tracking-[0.08em] mb-2">Total Records</div>
                <div className="flex items-center justify-between gap-12">
                    <div className="text-3xl font-serif text-[#0D0D1A] tracking-tight">{activeTab === 'joined' ? joinHistoryData.length : hostedClassesData.length}</div>
                    <HistoryIcon className="w-5 h-5 text-[#1845D4]" />
                </div>
            </div>

            {/* Archive List (Based on class-item in dashboard.html) */}
            <div className="bg-white border border-[#DDE0F0] rounded-lg overflow-hidden shadow-sm max-w-4xl">
                <div className="divide-y divide-[#DDE0F0]">
                    {activeTab === 'joined' ? (
                        joinHistoryData.length === 0 ? <div className="py-16 text-center text-[#8888A8] text-[11px] font-bold uppercase tracking-widest italic">No learning records found.</div> : (
                            joinHistoryData.map((item) => (
                                <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F5F6FA] transition-all group">
                                    <div className="w-8 h-8 bg-[#F5F6FA] rounded-lg flex items-center justify-center text-[#1845D4] border border-[#DDE0F0] group-hover:bg-[#1845D4] group-hover:text-white transition-all"><GraduationCap className="w-4 h-4" /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[14px] font-medium text-[#0D0D1A] truncate">{item.sessionTitle || 'Untitled Session'}</div>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-[#8888A8] uppercase tracking-widest mt-0.5">
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {item.joinedAt?.toDate?.().toLocaleDateString()}</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.joinedAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteRecord(item)} className="p-2 text-[#DDE0F0] hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))
                        )
                    ) : (
                        hostedClassesData.length === 0 ? <div className="py-16 text-center text-[#8888A8] text-[11px] font-bold uppercase tracking-widest italic">No teaching records found.</div> : (
                            hostedClassesData.map((item) => (
                                <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F5F6FA] transition-all group">
                                    <div className="w-8 h-8 bg-[#F5F6FA] rounded-lg flex items-center justify-center text-[#1845D4] border border-[#DDE0F0] group-hover:bg-[#1845D4] group-hover:text-white transition-all"><Video className="w-4 h-4" /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[14px] font-medium text-[#0D0D1A] truncate">{item.title || 'Untitled Session'}</div>
                                        <div className="flex items-center gap-4 text-[10px] font-bold text-[#8888A8] uppercase tracking-widest mt-0.5">
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {item.createdAt?.toDate?.().toLocaleDateString() || 'Recent'}</span>
                                            <span className="flex items-center gap-1 text-[#1845D4]"><Users className="w-3 h-3" /> {item.participantCount || 0} Learners</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setShowAttendanceModal(true)} className="px-4 py-1.5 bg-white border border-[#DDE0F0] text-[#0D0D1A] text-[10px] font-bold uppercase tracking-widest rounded hover:border-[#1845D4] transition-all">Logs</button>
                                        <button onClick={() => setShowRecordingsModal(true)} className="px-4 py-1.5 bg-[#1845D4] text-white text-[10px] font-bold uppercase tracking-widest rounded shadow-lg shadow-blue-600/10 hover:bg-[#0F2FA8] transition-all">Media</button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>

            {user && (
                <>
                    <AttendanceHistoryModal isOpen={showAttendanceModal} onClose={() => setShowAttendanceModal(false)} userId={user.uid} />
                    <RecordingsHistoryModal isOpen={showRecordingsModal} onClose={() => setShowRecordingsModal(false)} lecturerId={user.uid} />
                </>
            )}
        </div>
    );
}

export default function HistoryPage() {
    return (
        <Suspense fallback={<div className="space-y-8 animate-pulse"><Skeleton className="h-10 w-48 bg-white border border-[#DDE0F0]" /><Skeleton className="h-64 bg-white border border-[#DDE0F0]" /></div>}>
            <HistoryContent />
        </Suspense>
    );
}
