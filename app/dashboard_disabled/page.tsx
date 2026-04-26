'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { db } from '@/lib/firebase/config';
import {
    collection, query, where, onSnapshot, doc, getDoc, updateDoc, getDocs, addDoc, Timestamp, serverTimestamp, setDoc
} from 'firebase/firestore';
import { Session } from '@/lib/firebase/types';
import { isMeetingCode, normalizeCode, generateMeetingCode } from '@/lib/meetingCode';
import { Skeleton } from '@/components/ui/Skeleton';
import { deleteSession } from '@/lib/firebase/session-utils';
import {
    History, ArrowRight, Trash2, Video, Users, X, Plus, Copy, Check, Calendar, Clock, MonitorPlay, Sparkles, Search, GraduationCap, Laptop, MoreHorizontal, BookOpen, ChevronRight, HardDrive
} from 'lucide-react';
import { useClassroom } from '@/contexts/ClassroomContext';
import GroupsHub from '@/components/dashboard/GroupsHub';

function UniversalDashboardContent() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const { showAlert, showConfirm } = useAlert();
    const { sessionId: activeSessionId, leaveClass } = useClassroom();

    useEffect(() => { if (user && profile?.role === 'admin') router.replace('/admin'); }, [user, profile, router]);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'join' | 'host'>('join');
    const [hostedSessions, setHostedSessions] = useState<Session[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [lecturerName, setLecturerName] = useState('');
    const [program, setProgram] = useState('');
    const [course, setCourse] = useState('');
    const [scheduledStartTime, setScheduledStartTime] = useState('');
    
    const [enrolledSessions, setEnrolledSessions] = useState<Session[]>([]);
    const [joining, setJoining] = useState(false);
    const [joinLink, setJoinLink] = useState('');
    const [showJoinPreview, setShowJoinPreview] = useState(false);
    const [selectedSessionForJoin, setSelectedSessionForJoin] = useState<Session | null>(null);
    const [enrolling, setEnrolling] = useState(false);
    
    // Communities Integration
    const [activeWorkspace, setActiveWorkspace] = useState<'records' | 'communities'>('records');
    const [myOwnedGroups, setMyOwnedGroups] = useState<any[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');

    useEffect(() => {
        const isEligible = profile?.role === 'lecturer' || profile?.role === 'admin' || profile?.isVerified === true;
        if (!user || !isEligible) return;
        const fetchOwnedGroups = async () => {
            const q = query(collection(db, 'groups'), where('ownerId', '==', user.uid));
            const snap = await getDocs(q);
            setMyOwnedGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchOwnedGroups();
    }, [user, profile]);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'sessions'), where('lecturerId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setHostedSessions(sessionsData.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const qTransactions = query(collection(db, 'transactions'), where('userId', '==', user.uid), where('isHidden', '==', false));
        const unsubscribeTx = onSnapshot(qTransactions, async (snapshot) => {
            if (snapshot.empty) { setEnrolledSessions([]); setLoading(false); return; }
            const sessionsToFetch = Array.from(new Set(snapshot.docs.map(d => d.data().sessionId)));
            const sessionSnaps = await Promise.all(sessionsToFetch.map(id => getDoc(doc(db, 'sessions', id as string))));
            const validSessions = sessionSnaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() } as Session));
            setEnrolledSessions(validSessions.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
            setLoading(false);
        }, () => setLoading(false));
        return () => unsubscribeTx();
    }, [user]);

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault(); if (!user || !title.trim()) return showAlert('Title required.', 'error');
        try {
            const docRef = doc(collection(db, 'sessions'));
            await setDoc(docRef, { id: docRef.id, title, hostId: user.uid, lecturerId: user.uid, isActive: false, status: 'active', price: 0, currency: 'GHS', isFree: true, meetingCode: generateMeetingCode(docRef.id), lecturerName: lecturerName || profile?.fullName || 'Unknown', program, course, groupId: selectedGroupId || null, youtubeVideoId: null, scheduledStartTime: scheduledStartTime ? Timestamp.fromDate(new Date(scheduledStartTime)) : null, durationMinutes: 60, verificationCount: 2, requireGuestDetails: true, isDeleted: false, createdAt: serverTimestamp() });
            setTitle(''); setProgram(''); setCourse(''); setSelectedGroupId(''); setShowCreateModal(false); showAlert('Class created.', 'success');
        } catch (error: any) { showAlert('Failed to create.', 'error'); }
    };

    const handleJoinByLink = async (e: React.FormEvent) => {
        e.preventDefault(); if (!joinLink.trim() || !user) return; setJoining(true);
        try {
            let sId = joinLink.trim();
            if (isMeetingCode(sId)) {
                const normalized = normalizeCode(sId);
                const snap = await getDocs(query(collection(db, 'sessions'), where('meetingCode', '==', `pod-${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`)));
                if (snap.empty) { showAlert('Invalid code.', 'error'); setJoining(false); return; }
                sId = snap.docs[0].id;
            } else if (sId.includes('/classroom/')) { sId = sId.split('/classroom/')[1].split('?')[0]; }
            const sessionSnap = await getDoc(doc(db, 'sessions', sId));
            if (!sessionSnap.exists()) { showAlert('Not found.', 'error'); setJoining(false); return; }
            setSelectedSessionForJoin({ id: sessionSnap.id, ...sessionSnap.data() } as Session); setShowJoinPreview(true);
        } catch (err) { showAlert("Error.", "error"); } finally { setJoining(false); }
    };

    const enrollInClass = async (sId: string) => {
        if (!user) return false;
        try {
            if (enrolledSessions.some(s => s.id === sId)) return true;
            const snap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', user.uid), where('sessionId', '==', sId)));
            if (!snap.empty) { if (snap.docs[0].data().isHidden !== false) await updateDoc(snap.docs[0].ref, { isHidden: false }); return true; }
            await addDoc(collection(db, 'transactions'), { userId: user.uid, sessionId: sId, amount: 0, currency: 'GHS', paystackReference: `join_${sId}_${Date.now()}`, paymentChannel: 'direct', status: 'succeeded', email: user.email || '', isHidden: false, createdAt: serverTimestamp(), paidAt: serverTimestamp() });
            return true;
        } catch (err) { return false; }
    };

    const handleToggleActive = async (session: Session, current: boolean) => { 
        try { 
            const nextState = !current;
            await updateDoc(doc(db, 'sessions', session.id), { isActive: nextState }); 
            
            if (nextState && session.groupId) {
                // Fetch Group details for name
                const groupSnap = await getDoc(doc(db, 'groups', session.groupId));
                if (groupSnap.exists()) {
                    const groupData = groupSnap.data();
                    const { getGroupMemberEmails } = await import('@/lib/firebase/groups');
                    const emails = await getGroupMemberEmails(session.groupId);
                    
                    if (emails.length > 0) {
                        fetch('/api/communities/notifications', {
                            method: 'POST',
                            body: JSON.stringify({
                                type: 'SESSION_START',
                                data: {
                                    to: emails,
                                    communityName: groupData.name,
                                    lecturerName: session.lecturerName || profile?.fullName || 'Faculty',
                                    sessionTitle: session.title,
                                    sessionId: session.id
                                }
                            })
                        }).catch(console.error);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to toggle session state:', e);
            showAlert('Action failed.', 'error');
        } 
    };
    const handleCopyCode = (code: string | undefined, id: string) => { if (!code) return; navigator.clipboard.writeText(code); setCopiedCodeId(id); setTimeout(() => setCopiedCodeId(null), 2000); };
    const handleRemoveEnrolled = async (sId: string, e: React.MouseEvent) => { e.stopPropagation(); showConfirm('Remove session?', async () => { const snap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', user!.uid), where('sessionId', '==', sId))); snap.forEach(d => updateDoc(d.ref, { isHidden: true })); }); };
    const handleDeleteSession = async (sId: string, e: React.MouseEvent) => { e.stopPropagation(); showConfirm('Purge this session?', async () => { try { await deleteSession(sId); if (sId === activeSessionId) leaveClass(); showAlert('Deleted.', 'success'); } catch (err) {} }); };

    if (loading) return <div className="space-y-8 animate-pulse"><Skeleton className="h-10 w-48 bg-white border border-[#DDE0F0]" /><Skeleton className="h-40 bg-white border border-[#DDE0F0]" /><Skeleton className="h-96 bg-white border border-[#DDE0F0]" /></div>;

    const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="space-y-8">
            {/* Page Head (Based on dashboard.html) */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-3xl font-serif text-[#0D0D1A] tracking-tighter">Dashboard</h1>
                    <p className="text-[13px] text-[#8888A8] font-medium mt-1">{todayStr}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowCreateModal(true)} className="px-5 py-2.5 bg-[#1845D4] text-white text-[13px] font-medium rounded-md hover:bg-[#0F2FA8] transition-all flex items-center gap-2">
                        <Plus className="w-4 h-4" /> New class
                    </button>
                </div>
            </div>

            {/* Stat Cards (Based on dashboard.html) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#DDE0F0] rounded-lg p-6 shadow-sm">
                    <div className="text-[11px] font-bold text-[#8888A8] uppercase tracking-[0.08em] mb-3">Enrolled</div>
                    <div className="text-3xl font-serif text-[#0D0D1A] tracking-tight">{enrolledSessions.length}</div>
                    <div className="text-[11px] text-[#1BA05C] font-medium mt-1">Active Record</div>
                </div>
                <div className="bg-white border border-[#DDE0F0] rounded-lg p-6 shadow-sm">
                    <div className="text-[11px] font-bold text-[#8888A8] uppercase tracking-[0.08em] mb-3">Hosted</div>
                    <div className="text-3xl font-serif text-[#0D0D1A] tracking-tight">{hostedSessions.length}</div>
                    <div className="text-[11px] text-[#1BA05C] font-medium mt-1">Teaching Panel</div>
                </div>
            </div>

            {/* Action Cards (Based on dashboard.html) */}
            <div className="flex items-center gap-6 border-b border-[#DDE0F0] mb-8 pb-4">
                <button onClick={() => setActiveWorkspace('records')} className={`text-[13px] font-bold uppercase tracking-widest transition-all pb-4 -mb-4 border-b-2 ${activeWorkspace === 'records' ? 'border-[#1845D4] text-[#1845D4]' : 'border-transparent text-[#8888A8] hover:text-[#0D0D1A]'}`}>Records</button>
                <button onClick={() => setActiveWorkspace('communities')} className={`text-[13px] font-bold uppercase tracking-widest transition-all pb-4 -mb-4 border-b-2 ${activeWorkspace === 'communities' ? 'border-[#1845D4] text-[#1845D4]' : 'border-transparent text-[#8888A8] hover:text-[#0D0D1A]'}`}>Communities</button>
            </div>

            {activeWorkspace === 'communities' ? (
                <GroupsHub />
            ) : (
                <>
                <div className="grid md:grid-cols-2 gap-4">
                    <button onClick={() => setShowCreateModal(true)} className="group bg-white border border-[#DDE0F0] rounded-lg p-8 text-left hover:border-[#1845D4] hover:shadow-lg hover:shadow-blue-600/5 transition-all outline-none">
                        <div className="w-12 h-12 bg-[#1845D4] rounded-lg flex items-center justify-center mb-5 text-white shadow-lg shadow-blue-600/20"><Plus className="w-6 h-6" /></div>
                        <h3 className="text-base font-bold text-[#0D0D1A] mb-1.5">Create a class</h3>
                        <p className="text-[13px] text-[#444460] font-light leading-relaxed">Set up a new classroom and invite students to get started.</p>
                        <div className="text-[13px] font-bold text-[#1845D4] mt-5">Create class →</div>
                    </button>
                    <div className="bg-white border border-[#DDE0F0] rounded-lg p-8 text-left hover:border-[#1845D4] hover:shadow-lg hover:shadow-blue-600/5 transition-all">
                        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-5 text-[#1845D4]"><Users className="w-6 h-6" /></div>
                        <h3 className="text-base font-bold text-[#0D0D1A] mb-1.5">Join a class</h3>
                        <form onSubmit={handleJoinByLink} className="mt-4 flex gap-2">
                            <input type="text" value={joinLink} onChange={(e) => setJoinLink(e.target.value)} placeholder="Enter code..." className="flex-1 px-4 py-2.5 bg-[#F5F6FA] border border-[#DDE0F0] rounded-md text-[13px] font-medium outline-none focus:border-[#1845D4] transition-all" />
                            <button type="submit" disabled={joining} className="px-4 bg-[#1845D4] text-white rounded-md text-[13px] font-bold hover:bg-[#0F2FA8] transition-all disabled:opacity-50">Join</button>
                        </form>
                    </div>
                </div>
                </>
            )}

            {/* Class Lists (Based on dashboard.html) */}
            {activeWorkspace === 'records' && (
                <div className="bg-white border border-[#DDE0F0] rounded-lg overflow-hidden shadow-sm">
                    <div className="px-6 py-5 border-b border-[#DDE0F0] flex items-center justify-between bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-6">
                            <h2 className="text-[14px] font-bold text-[#0D0D1A]">Academic Records</h2>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setActiveTab('join')} className={`text-[12px] font-bold transition-all ${activeTab === 'join' ? 'text-[#1845D4]' : 'text-[#8888A8] hover:text-[#0D0D1A]'}`}>Classes Joined</button>
                                <button onClick={() => setActiveTab('host')} className={`text-[12px] font-bold transition-all ${activeTab === 'host' ? 'text-[#1845D4]' : 'text-[#8888A8] hover:text-[#0D0D1A]'}`}>Classes Hosted</button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="divide-y divide-[#DDE0F0]">
                        {activeTab === 'join' ? (
                            enrolledSessions.map(session => (
                                <div key={session.id} onClick={() => { setSelectedSessionForJoin(session); setShowJoinPreview(true); }} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F5F6FA] transition-all cursor-pointer group">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${session.isActive ? 'bg-[#1845D4] animate-pulse' : 'bg-[#DDE0F0]'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[14px] font-medium text-[#0D0D1A] group-hover:text-[#1845D4] transition-colors truncate">{session.title}</div>
                                        <div className="text-[11px] text-[#8888A8] mt-0.5">{session.lecturerName || 'Unknown Faculty'} · {session.course || 'General'}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest ${session.isActive ? 'bg-blue-50 text-[#1845D4]' : 'bg-[#F5F6FA] text-[#8888A8]'}`}>
                                            {session.isActive ? 'Live' : 'Active'}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-[#DDE0F0] group-hover:text-[#1845D4] transition-all" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            hostedSessions.filter(s => !s.isDeleted).map(session => (
                                <div key={session.id} className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-4 hover:bg-[#F5F6FA] transition-all group">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${session.isActive ? 'bg-[#1845D4] animate-pulse' : 'bg-[#DDE0F0]'}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[14px] font-medium text-[#0D0D1A] truncate">{session.title}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-bold text-[#8888A8] uppercase tracking-widest bg-[#F5F6FA] px-2 py-0.5 rounded whitespace-nowrap">{session.meetingCode}</span>
                                                <span className="text-[11px] text-[#8888A8] truncate">· {session.course || 'General'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                                        <button onClick={() => handleCopyCode(session.meetingCode, session.id)} className="p-2 text-[#8888A8] hover:text-[#1845D4] transition-colors flex-shrink-0">{copiedCodeId === session.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}</button>
                                        <button onClick={() => router.push(`/classroom/${session.id}`)} className="px-4 py-2 bg-white border border-[#DDE0F0] text-[#0D0D1A] text-[10px] font-bold uppercase tracking-widest rounded hover:border-[#1845D4] transition-all whitespace-nowrap">Control</button>
                                        <button onClick={() => handleToggleActive(session, session.isActive || false)} className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${session.isActive ? 'bg-[#1845D4] text-white shadow-lg shadow-blue-600/10' : 'bg-[#F5F6FA] text-[#8888A8] hover:bg-[#E8EEFF]'}`}>{session.isActive ? 'Live' : 'Go Live'}</button>
                                        <button onClick={(e) => handleDeleteSession(session.id, e)} className="p-2 text-[#DDE0F0] hover:text-red-600 transition-colors flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))
                        )}
                        {((activeTab === 'join' && enrolledSessions.length === 0) || (activeTab === 'host' && hostedSessions.length === 0)) && (
                            <div className="py-20 text-center"><p className="text-[11px] font-bold text-[#8888A8] uppercase tracking-[0.4em] italic">No active records found.</p></div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Class Modal (Styled based on dashboard.html) */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-[#0D0D1A]/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                    <div className="bg-white w-full max-w-md rounded-lg p-10 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-8">
                            <div><h2 className="text-2xl font-serif text-[#0D0D1A] tracking-tighter">Create a class</h2><p className="text-[13px] text-[#8888A8] font-light mt-1">Set up a new classroom for your students.</p></div>
                            <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 flex items-center justify-center border border-[#DDE0F0] rounded-md text-[#444460] hover:bg-[#F5F6FA] transition-all">✕</button>
                        </div>
                        <form onSubmit={handleCreateSession} className="space-y-5">
                            <div className="space-y-1.5"><label className="text-[13px] font-bold text-[#0D0D1A]">Class name</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Introduction to Data Science" className="w-full px-4 py-2.5 bg-white border-2 border-[#DDE0F0] focus:border-[#1845D4] rounded-md outline-none text-[14px] transition-all" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5"><label className="text-[13px] font-bold text-[#0D0D1A]">Course Code</label><input type="text" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="CS101" className="w-full px-4 py-2.5 bg-white border-2 border-[#DDE0F0] focus:border-[#1845D4] rounded-md outline-none text-[14px] transition-all" /></div>
                                <div className="space-y-1.5"><label className="text-[13px] font-bold text-[#0D0D1A]">Program</label><input type="text" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="BSc" className="w-full px-4 py-2.5 bg-white border-2 border-[#DDE0F0] focus:border-[#1845D4] rounded-md outline-none text-[14px] transition-all" /></div>
                            </div>
                            {myOwnedGroups.length > 0 && (
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-bold text-[#0D0D1A]">Associate Community (Optional)</label>
                                    <select 
                                        value={selectedGroupId} 
                                        onChange={(e) => setSelectedGroupId(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border-2 border-[#DDE0F0] focus:border-[#1845D4] rounded-md outline-none text-[14px] transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Personal Session (Independent)</option>
                                        {myOwnedGroups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex gap-3 justify-end pt-5">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-2.5 border-2 border-[#DDE0F0] text-[#0D0D1A] rounded-md text-[14px] font-medium hover:border-[#1845D4] transition-all">Cancel</button>
                                <button type="submit" className="px-6 py-2.5 bg-[#1845D4] text-white rounded-md text-[14px] font-medium hover:bg-[#0F2FA8] transition-all shadow-lg shadow-blue-600/10">Create class</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Join Preview Modal */}
            {showJoinPreview && selectedSessionForJoin && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-[#0D0D1A]/40 backdrop-blur-sm" onClick={() => setShowJoinPreview(false)} />
                    <div className="bg-white w-full max-w-sm rounded-lg p-10 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center">
                        <div className="w-16 h-16 bg-blue-50 rounded-lg flex items-center justify-center mx-auto text-[#1845D4] mb-6 shadow-lg shadow-blue-600/5"><GraduationCap className="w-8 h-8" /></div>
                        <h2 className="text-2xl font-serif text-[#0D0D1A] tracking-tighter leading-tight mb-2">{selectedSessionForJoin.title}</h2>
                        <p className="text-[13px] text-[#8888A8] font-bold uppercase tracking-widest">{selectedSessionForJoin.lecturerName || 'Faculty Member'}</p>
                        <div className="space-y-3 mt-10">
                            <button disabled={enrolling} onClick={async () => { setEnrolling(true); if (await enrollInClass(selectedSessionForJoin.id)) router.push(`/classroom/${selectedSessionForJoin.id}`); setEnrolling(false); }} className="w-full py-3.5 bg-[#1845D4] text-white rounded-lg font-bold text-[11px] uppercase tracking-widest shadow-xl shadow-blue-600/10 active:scale-95 disabled:opacity-50">{enrolling ? 'Processing...' : 'Enter Classroom'}</button>
                            <button onClick={() => setShowJoinPreview(false)} className="text-[11px] font-bold text-[#8888A8] uppercase tracking-widest hover:text-[#0D0D1A] transition-all">Go Back</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function UniversalDashboard() {
    return (
        <Suspense fallback={<div className="space-y-8"><Skeleton className="h-10 w-48 bg-white border border-[#DDE0F0]" /><Skeleton className="h-64 bg-white border border-[#DDE0F0]" /></div>}>
            <UniversalDashboardContent />
        </Suspense>
    );
}
