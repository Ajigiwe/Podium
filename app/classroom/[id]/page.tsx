'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, addDoc, updateDoc, collection, Timestamp, query, where, getDocs, increment, serverTimestamp } from 'firebase/firestore';
import { Session } from '@/lib/firebase/types';
import ClassroomContent from '@/components/ClassroomContent';
import { useClassroom } from '@/contexts/ClassroomContext';
import { checkIsCoHost } from '@/lib/firebase/cohost';
import { Clock, RefreshCw, ArrowLeft, Laptop, Mic, MicOff, Sparkles, User as UserIcon, GraduationCap, ArrowRight, Shield, Calendar, Users } from 'lucide-react';
import CountdownTimer from '@/components/CountdownTimer';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAlert } from '@/contexts/AlertContext';
import { useQuery } from '@tanstack/react-query';

export default function ClassroomPage() {
    const params = useParams();
    const router = useRouter();
    const { user, profile, loading: authLoading } = useAuth();
    const { joinClass, sessionId: currentSessionId } = useClassroom();
    const { showAlert } = useAlert();
    const sessionId = params.id as string;

    const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery({
        queryKey: ['session', sessionId],
        queryFn: async () => {
            const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
            if (!sessionDoc.exists()) throw new Error('Not found');
            return { id: sessionDoc.id, ...sessionDoc.data() } as Session;
        },
        staleTime: 30000,
    });

    const [loading, setLoading] = useState(true);
    const [canAccess, setCanAccess] = useState(false);
    const [waitingForLecturer, setWaitingForLecturer] = useState(false);
    const [isScheduledWait, setIsScheduledWait] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [studentName, setStudentName] = useState('');
    const [studentIndex, setStudentIndex] = useState('');
    const [submittingProfile, setSubmittingProfile] = useState(false);
    const [joinMicEnabled, setJoinMicEnabled] = useState(true);

    useEffect(() => {
        if (authLoading || sessionLoading) return;
        if (sessionError) { showAlert('Class not found', 'error'); router.push('/'); return; }
        if (!user || !profile || !session) { if (!authLoading && !user) router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }

        const verifyAccess = async () => {
            try {
                const isModerator = session.hostId === user.uid || session.lecturerId === user.uid || (await checkIsCoHost(sessionId, user.uid)) || profile.role === 'lecturer' || profile.role === 'admin';
                
                // Group Access Control
                if (session.groupId && !isModerator) {
                    const membershipRef = doc(db, 'group_memberships', `${user.uid}_${session.groupId}`);
                    const membershipSnap = await getDoc(membershipRef);
                    if (!membershipSnap.exists()) {
                        showAlert('This class is restricted to verified group members.', 'error');
                        window.location.href = '/dashboard.html';
                        return;
                    }
                }

                if (!isModerator && !session.isActive) {
                    if (session.scheduledStartTime && session.scheduledStartTime.toDate() > new Date()) { setIsScheduledWait(true); setLoading(false); return; }
                    setWaitingForLecturer(true); setLoading(false); return;
                }
                const isPayToUse = (await getDoc(doc(db, 'system_settings', 'subscription'))).data()?.isPayToUse ?? true;
                if (!isModerator && isPayToUse && profile.subscriptionStatus !== 'active') { window.location.href = '/dashboard.html'; return; }

                const attendanceSnap = await getDocs(query(collection(db, 'attendance_logs'), where('sessionId', '==', sessionId), where('userId', '==', user.uid)));
                if (!isModerator && attendanceSnap.empty) { setStudentName(profile.fullName || ''); setStudentIndex(profile.indexNumber || ''); setShowProfileModal(true); setLoading(false); return; }

                setCanAccess(true); setLoading(false);
                if (typeof window !== 'undefined') sessionStorage.setItem('podium_user_interacted', 'true');
                joinClass(sessionId, session.title || 'Class', profile.fullName || 'User', isModerator ? 'lecturer' : 'student', user.uid, profile.photoURL, profile.displayIcon, true);
            } catch (error) { setLoading(false); }
        };
        verifyAccess();
    }, [user, profile, session, authLoading, sessionLoading, sessionError]);

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); if (!studentName.trim() || !studentIndex.trim()) return showAlert("Fields required.", "error");
        setSubmittingProfile(true);
        try {
            await updateDoc(doc(db, 'profiles', user!.uid), { fullName: studentName, indexNumber: studentIndex, updatedAt: Timestamp.now() });
            const logRef = doc(db, 'attendance_logs', `${sessionId}_${user!.uid}`);
            await setDoc(logRef, { 
                sessionId, 
                sessionTitle: session?.title || 'Class', 
                userId: user!.uid, 
                userName: studentName, 
                userEmail: user!.email, 
                userIndexNumber: studentIndex, 
                joinedAt: serverTimestamp(), 
                lecturerId: session?.lecturerId || '',
                totalVerificationsSent: 0,
                totalVerificationsCompleted: 0,
                verificationPercentage: 0
            });
            await updateDoc(doc(db, 'sessions', sessionId), { participantCount: increment(1) });
            setShowProfileModal(false); setCanAccess(true);
            if (typeof window !== 'undefined') sessionStorage.setItem('podium_user_interacted', 'true');
            joinClass(sessionId, session?.title || 'Class', studentName, 'student', user!.uid, profile?.photoURL, profile?.displayIcon, joinMicEnabled);
        } catch (error) { showAlert("Identity check failed.", "error"); } finally { setSubmittingProfile(false); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F8F9FF]"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;

    if (isScheduledWait || waitingForLecturer) {
        return (
            <div className="min-h-screen bg-[#F8F9FF] flex items-center justify-center p-8 animate-in fade-in duration-700">
                <div className="max-w-md w-full space-y-12 text-center">
                    <div className="space-y-6">
                        <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center mx-auto border border-slate-200 shadow-sm transition-transform hover:scale-105"><Clock className={`w-8 h-8 text-indigo-600 ${waitingForLecturer ? 'animate-pulse' : ''}`} /></div>
                        <div className="space-y-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">{isScheduledWait ? 'Upcoming Session' : 'Lobby Access'}</p><h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">{isScheduledWait ? 'Starting Soon' : 'Awaiting Host'}</h1></div>
                    </div>
                    {isScheduledWait && session?.scheduledStartTime && <div className="py-4"><CountdownTimer targetDate={session.scheduledStartTime.toDate()} onComplete={() => { setIsScheduledWait(false); setWaitingForLecturer(true); }} /></div>}
                    <div className="bg-white rounded-xl p-8 border border-slate-200 text-left space-y-6 shadow-sm">
                        <div className="space-y-1"><p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Active Classroom</p><h2 className="text-2xl font-black text-slate-900 leading-tight">{session?.title}</h2></div>
                        <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5" /> Virtual Environment</span>
                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {session?.scheduledStartTime?.toDate().toLocaleDateString() || 'Today'}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        {waitingForLecturer && <button onClick={() => window.location.reload()} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/10 active:scale-95 transition-all">Check In Again</button>}
                        <button onClick={() => window.location.href = '/dashboard.html'} className="w-full py-4 bg-white text-slate-500 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-slate-200 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">Return to Dashboard</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!session || (!canAccess && !showProfileModal)) return null;

    return (
        <div className="min-h-screen bg-black">
            <ClassroomContent session={session} user={user} profile={profile} sessionId={sessionId} />
            {showProfileModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 animate-in fade-in duration-500">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                    <div className="relative w-full max-w-md bg-white rounded-xl p-10 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="space-y-6 mb-10 text-center">
                            <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto border border-indigo-100 text-indigo-600 shadow-sm"><Shield className="w-8 h-8" /></div>
                            <div className="space-y-2"><h2 className="text-2xl font-bold text-slate-900 leading-none">Identity Check</h2><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Verify details for the attendance registry.</p></div>
                        </div>
                        <form onSubmit={handleProfileSubmit} className="space-y-8">
                            <div className="space-y-4">
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Student Full Name</label><input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-600 focus:bg-white transition-all" /></div>
                                <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Registration Index</label><input type="text" value={studentIndex} onChange={(e) => setStudentIndex(e.target.value)} required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-600 focus:bg-white transition-all" /></div>
                                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-200"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg transition-colors ${joinMicEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{joinMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}</div><p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Mic {joinMicEnabled ? 'Active' : 'Silent'}</p></div><button type="button" onClick={() => setJoinMicEnabled(!joinMicEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${joinMicEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all ${joinMicEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
                            </div>
                            <button type="submit" disabled={submittingProfile} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/10 active:scale-95 transition-all">{submittingProfile ? '...' : 'Enter Workspace'}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
