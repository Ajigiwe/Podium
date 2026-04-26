'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc, setDoc, serverTimestamp, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { Camera, User, Mail, Lock, Info, List, Verified, Check, GraduationCap, Sparkles, ShieldCheck } from 'lucide-react';
import AttendanceHistoryModal from '@/components/AttendanceHistoryModal';
import ImageCropperModal from '@/components/ImageCropperModal';
import { RecordingsDashboard } from '@/components/RecordingsDashboard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useQueryClient } from '@tanstack/react-query';

export default function ProfilePage() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const { showAlert } = useAlert();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'personal' | 'security' | 'teaching'>('personal');

    const [tempImage, setTempImage] = useState<string | null>(null);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [showCropper, setShowCropper] = useState(false);

    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [role, setRole] = useState<'student' | 'lecturer' | 'admin'>('student');
    const [stats, setStats] = useState({ totalSessions: 0, totalStudents: 0, enrolledClasses: 0 });
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    useEffect(() => {
        if (!user || !profile) { router.push('/login'); return; }
        setFullName(profile.fullName || ''); setBio(profile.bio || ''); setPhotoURL(profile.photoURL || ''); setRole(profile.role || 'student');
        loadStatistics(); setLoading(false);
    }, [user, profile, router]);

    const loadStatistics = async () => {
        if (!user || !profile) return;
        try {
            if (profile.role === 'lecturer') {
                const sessionsSnapshot = await getDocs(query(collection(db, 'sessions'), where('lecturerId', '==', user.uid)));
                const logsSnapshot = await getDocs(query(collection(db, 'attendance_logs'), where('lecturerId', '==', user.uid)));
                const studentIds = new Set<string>(); logsSnapshot.forEach(doc => { if (doc.data().userId) studentIds.add(doc.data().userId); });
                setStats({ totalSessions: sessionsSnapshot.docs.length, totalStudents: studentIds.size, enrolledClasses: 0 });
            } else {
                const logsSnapshot = await getDocs(query(collection(db, 'attendance_logs'), where('userId', '==', user.uid)));
                const enrolledSessionIds = new Set<string>(); logsSnapshot.forEach(doc => { if (doc.data().sessionId) enrolledSessionIds.add(doc.data().sessionId); });
                setStats({ totalSessions: 0, totalStudents: 0, enrolledClasses: enrolledSessionIds.size });
            }
        } catch (error) {}
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file || !user) return;
        const reader = new FileReader(); reader.addEventListener('load', () => { setTempImage(reader.result as string); setShowCropper(true); }); reader.readAsDataURL(file);
    };

    const handleConfirmCrop = async () => {
        if (!tempImage || !croppedAreaPixels || !user) return; setSubmitting(true); setShowCropper(false);
        try {
            const image = new Image(); image.src = tempImage; await new Promise((resolve) => (image.onload = resolve));
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No ctx');
            canvas.width = 300; canvas.height = 300; ctx.drawImage(image, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, 300, 300);
            const croppedBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(), 'image/jpeg', 0.8));
            const uploadTask = uploadBytesResumable(ref(storage, `profile-pictures/${user.uid}`), croppedBlob);
            uploadTask.on('state_changed', null, null, async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                await updateDoc(doc(db, 'profiles', user.uid), { photoURL: url, updatedAt: Timestamp.now() });
                queryClient.invalidateQueries({ queryKey: ['profile', user.uid] }); setPhotoURL(url); setSubmitting(false); setTempImage(null); showAlert('Registry updated.', 'success');
            });
        } catch (error: any) { showAlert('Upload failed.', 'error'); setSubmitting(false); }
    };

    const handleSaveProfile = async () => {
        if (!user) return; setSubmitting(true);
        try { await updateDoc(doc(db, 'profiles', user.uid), { fullName, bio, role, updatedAt: Timestamp.now() }); queryClient.invalidateQueries({ queryKey: ['profile', user.uid] }); showAlert('Changes preserved.', 'success'); } catch (error) { showAlert('Failed to save.', 'error'); } finally { setSubmitting(false); }
    };

    if (loading) return <div className="space-y-8 animate-pulse"><Skeleton className="h-10 w-48 bg-white border border-[#DDE0F0]" /><div className="grid grid-cols-1 md:grid-cols-3 gap-8"><Skeleton className="h-96 bg-white border border-[#DDE0F0]" /><Skeleton className="col-span-2 h-96 bg-white border border-[#DDE0F0]" /></div></div>;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-serif text-[#0D0D1A] tracking-tighter">Profile</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                {/* Left Card (Based on profile.html) */}
                <div className="bg-white border border-[#DDE0F0] rounded-lg p-8 text-center space-y-6 shadow-sm">
                    <div className="relative inline-block">
                        <div className="w-20 h-20 bg-[#1845D4] rounded-full flex items-center justify-center text-white text-3xl font-serif font-black overflow-hidden shadow-lg shadow-blue-600/10">
                            {photoURL ? <img src={photoURL} className="w-full h-full object-cover" /> : profile?.fullName?.charAt(0) || 'U'}
                        </div>
                        <label className="absolute bottom-0 right-0 bg-white border border-[#DDE0F0] text-[#444460] p-1.5 rounded-full shadow-md cursor-pointer hover:border-[#1845D4] hover:text-[#1845D4] transition-all">
                            <Camera className="w-3.5 h-3.5" />
                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                    </div>
                    
                    <div>
                        <h2 className="text-xl font-serif font-black text-[#0D0D1A] tracking-tight leading-none">{fullName || 'Identity Pending'}</h2>
                        <div className="inline-block mt-2 text-[10px] font-bold text-[#1845D4] uppercase tracking-[0.08em] bg-[#E8EEFF] px-2.5 py-1 rounded-full">{role}</div>
                        <p className="text-[13px] text-[#8888A8] font-medium mt-1">{user?.email}</p>
                    </div>

                    <div className="grid grid-cols-2 bg-[#DDE0F0] gap-[1px] border border-[#DDE0F0] rounded-lg overflow-hidden">
                        <div className="bg-white p-4">
                            <div className="text-xl font-serif font-black text-[#0D0D1A]">{role === 'lecturer' ? stats.totalSessions : stats.enrolledClasses}</div>
                            <div className="text-[9px] font-bold text-[#8888A8] uppercase tracking-widest mt-1">Classes</div>
                        </div>
                        <div className="bg-white p-4">
                            <div className="text-xl font-serif font-black text-[#0D0D1A]">{role === 'lecturer' ? stats.totalStudents : '84%'}</div>
                            <div className="text-[9px] font-bold text-[#8888A8] uppercase tracking-widest mt-1">{role === 'lecturer' ? 'Students' : 'Performance'}</div>
                        </div>
                    </div>

                    <button className="w-full py-2.5 bg-white border border-[#DDE0F0] text-[#444460] text-[13px] font-medium rounded-md hover:border-[#1845D4] hover:text-[#1845D4] transition-all">Change photo</button>
                </div>

                {/* Right Area (Based on profile.html) */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white border border-[#DDE0F0] rounded-lg overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-[#DDE0F0] flex items-center justify-between">
                            <nav className="flex gap-6">
                                <button onClick={() => setActiveTab('personal')} className={`text-[12px] font-bold transition-all py-1 border-b-2 ${activeTab === 'personal' ? 'border-[#1845D4] text-[#1845D4]' : 'border-transparent text-[#8888A8] hover:text-[#0D0D1A]'}`}>Personal Information</button>
                                <button onClick={() => setActiveTab('security')} className={`text-[12px] font-bold transition-all py-1 border-b-2 ${activeTab === 'security' ? 'border-[#1845D4] text-[#1845D4]' : 'border-transparent text-[#8888A8] hover:text-[#0D0D1A]'}`}>Security</button>
                                {role === 'lecturer' && <button onClick={() => setActiveTab('teaching')} className={`text-[12px] font-bold transition-all py-1 border-b-2 ${activeTab === 'teaching' ? 'border-[#1845D4] text-[#1845D4]' : 'border-transparent text-[#8888A8] hover:text-[#0D0D1A]'}`}>Teaching Control</button>}
                            </nav>
                        </div>

                        <div className="p-8">
                            {activeTab === 'personal' && (
                                <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1.5"><label className="text-[13px] font-bold text-[#0D0D1A]">Full Name</label><input className="w-full px-4 py-2.5 bg-white border-2 border-[#DDE0F0] focus:border-[#1845D4] rounded-md outline-none text-[14px] transition-all" value={fullName} onChange={(e) => setFullName(e.target.value)} type="text" /></div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[13px] font-bold text-[#0D0D1A]">Academic Role</label>
                                                {role === 'student' && !profile?.isVerified && (
                                                    <button 
                                                        onClick={async () => {
                                                            const adminPhone = "233550599755";
                                                            const message = `Hi, I am ${profile?.fullName} (${user?.email}), and I'd like to be verified as a Course Representative on Podium.`;
                                                            const whatsappUrl = `https://wa.me/${adminPhone}?text=${encodeURIComponent(message)}`;
                                                            
                                                            try {
                                                                await setDoc(doc(db, 'verification_requests', user?.uid || ''), {
                                                                    userId: user?.uid,
                                                                    userName: profile?.fullName,
                                                                    userEmail: user?.email,
                                                                    status: 'pending',
                                                                    requestedAt: serverTimestamp()
                                                                });
                                                                window.open(whatsappUrl, '_blank');
                                                                showAlert('Request logged! WhatsApp opened.', 'success');
                                                            } catch (e) {
                                                                showAlert('Failed to log request.', 'error');
                                                            }
                                                        }}
                                                        className="text-[10px] font-bold text-[#1845D4] hover:underline uppercase tracking-widest flex items-center gap-1"
                                                    >
                                                        <Sparkles className="w-3 h-3" /> Request Verification
                                                    </button>
                                                )}
                                                {profile?.isVerified && (
                                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#1BA05C] bg-[#E8F5EE] px-2 py-0.5 rounded uppercase tracking-widest">
                                                        <ShieldCheck className="w-3 h-3" /> Verified Rep
                                                    </div>
                                                )}
                                            </div>
                                            <div className="relative group">
                                                <input 
                                                    disabled 
                                                    value={role.charAt(0).toUpperCase() + role.slice(1)} 
                                                    className="w-full px-4 py-2.5 bg-[#F5F6FA] border-2 border-[#DDE0F0] rounded-md text-[14px] text-[#8888A8] font-medium cursor-not-allowed transition-all" 
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Lock className="w-3.5 h-3.5 text-[#8888A8]" />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-[#8888A8] font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                                <Info className="w-3 h-3 text-[#1845D4]" /> {profile?.isVerified ? 'Course Representative Status' : 'Standard Student Account'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5"><label className="text-[13px] font-bold text-[#0D0D1A]">Academic Narrative (Bio)</label><textarea className="w-full px-4 py-2.5 bg-white border-2 border-[#DDE0F0] focus:border-[#1845D4] rounded-md outline-none text-[14px] transition-all resize-none" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} /></div>
                                    <div className="pt-4 flex items-center justify-end gap-3">
                                        <div className="flex-1 flex items-center gap-2 text-[#8888A8] text-[10px] font-bold uppercase tracking-widest"><Info className="w-4 h-4 text-[#1845D4]" /> Registry updates in real-time</div>
                                        <button className="px-8 py-2.5 bg-[#1845D4] text-white font-bold text-[13px] rounded-md shadow-lg shadow-blue-600/10 hover:bg-[#0F2FA8] transition-all active:scale-95" type="submit">
                                            {submitting ? 'Saving...' : 'Save changes'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeTab === 'security' && (
                                <div className="space-y-8 divide-y divide-[#DDE0F0] -mt-4">
                                    <div className="py-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-[#F5F6FA] rounded-md flex items-center justify-center text-[#1845D4]"><Mail className="w-5 h-5" /></div>
                                            <div><p className="text-[14px] font-bold text-[#0D0D1A]">Registered Email</p><p className="text-[12px] text-[#8888A8] font-medium">{user?.email}</p></div>
                                        </div>
                                    </div>
                                    <div className="py-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-[#F5F6FA] rounded-md flex items-center justify-center text-[#1845D4]"><Lock className="w-5 h-5" /></div>
                                            <div><p className="text-[14px] font-bold text-[#0D0D1A]">Access Password</p><p className="text-[12px] text-[#8888A8] font-medium">Update your secure key</p></div>
                                        </div>
                                        <button className="text-[11px] font-bold text-[#1845D4] uppercase tracking-widest hover:underline">Reset</button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'teaching' && role === 'lecturer' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center pb-4 border-b border-[#DDE0F0]">
                                        <div><h3 className="text-lg font-bold text-[#0D0D1A]">Teaching Control</h3><p className="text-[11px] font-bold text-[#8888A8] uppercase tracking-widest">Manage your sessions and recordings</p></div>
                                        <button onClick={() => setShowHistoryModal(true)} className="px-4 py-2 bg-white border border-[#DDE0F0] text-[#0D0D1A] rounded text-[11px] font-bold uppercase tracking-widest hover:border-[#1845D4] transition-all flex items-center gap-2">
                                            <List className="w-4 h-4" /> Registry Logs
                                        </button>
                                    </div>
                                    <RecordingsDashboard lecturerId={user?.uid || ''} showTitle={true} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showHistoryModal && <AttendanceHistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} userId={user?.uid || ''} />}
            {showCropper && tempImage && <ImageCropperModal image={tempImage} onCropComplete={(pixels) => setCroppedAreaPixels(pixels)} onClose={() => { setShowCropper(false); setTempImage(null); }} onConfirm={handleConfirmCrop} />}
        </div>
    );
}
