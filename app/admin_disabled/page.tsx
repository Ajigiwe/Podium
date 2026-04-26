'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import {
    doc, getDoc, setDoc, serverTimestamp, collection, getDocs, orderBy, query, limit, startAfter, getCountFromServer, where, writeBatch
} from 'firebase/firestore';
import { SystemSettings, UserProfile, AttendanceLog } from '@/lib/firebase/types';
import { 
    Settings, Save, AlertCircle, Users, Search, Shield, GraduationCap, 
    User, Trash2, UserX, UserCheck, MoreVertical, RefreshCw, Sparkles, 
    ArrowRight, ChevronRight, Filter, Clock, ShieldCheck, Check, X,
    LayoutGrid, Activity, DollarSign, ArrowUpDown, ArrowUp, ArrowDown, Info
} from 'lucide-react';
import StudentHistoryModal from './components/StudentHistoryModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAlert } from '@/contexts/AlertContext';

type SortKey = 'fullName' | 'role' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export default function AdminPage() {
    const { showAlert, showConfirm } = useAlert();
    const [activeTab, setActiveTab] = useState<'settings' | 'users'>('settings');
    const [fee, setFee] = useState<number>(200);
    const [isPayToUse, setIsPayToUse] = useState<boolean>(true);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);

    const [users, setUsers] = useState<(UserProfile & { classCount?: number })[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'unverified'>('all');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; order: SortOrder }>({ key: 'createdAt', order: 'desc' });
    const [globalStats, setGlobalStats] = useState({ total: 0, students: 0, lecturers: 0, admins: 0 });

    const PAGE_SIZE = 100;
    const [lastDocs, setLastDocs] = useState<(any)[]>([null]);
    const [page, setPage] = useState(0);
    const [isLastPage, setIsLastPage] = useState(false);
    const [managingUser, setManagingUser] = useState<string | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'system_settings', 'subscription'));
                if (docSnap.exists()) {
                    const data = docSnap.data() as SystemSettings;
                    setFee(data.semesterFee);
                    setIsPayToUse(data.isPayToUse !== undefined ? data.isPayToUse : true);
                }
            } catch (error) {} finally { setLoadingSettings(false); }
        };
        fetchSettings();
    }, []);

    const fetchGlobalStats = async () => {
        try {
            const usersRef = collection(db, 'profiles');
            const [totalSnap, studentSnap, lecturerSnap, adminSnap] = await Promise.all([
                getCountFromServer(query(usersRef)), getCountFromServer(query(usersRef, where('role', '==', 'student'))),
                getCountFromServer(query(usersRef, where('role', '==', 'lecturer'))), getCountFromServer(query(usersRef, where('role', '==', 'admin')))
            ]);
            setGlobalStats({ total: totalSnap.data().count, students: studentSnap.data().count, lecturers: lecturerSnap.data().count, admins: adminSnap.data().count });
        } catch (error) {}
    };

    const [indexError, setIndexError] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        setIndexError(null);
        try {
            const usersRef = collection(db, 'profiles');
            let constraints: any[] = [];
            
            // Apply Filters
            if (roleFilter !== 'all') constraints.push(where('role', '==', roleFilter));
            if (verificationFilter === 'verified') constraints.push(where('isVerified', '==', true));
            if (verificationFilter === 'unverified') constraints.push(where('isVerified', '!=', true));
            
            // Search
            if (debouncedSearchTerm) {
                constraints.push(where('fullName', '>=', debouncedSearchTerm));
                constraints.push(where('fullName', '<=', debouncedSearchTerm + '\uf8ff'));
                constraints.push(orderBy('fullName', sortConfig.order));
            } else {
                constraints.push(orderBy(sortConfig.key, sortConfig.order));
            }

            constraints.push(limit(PAGE_SIZE + 1));
            
            let q = query(usersRef, ...constraints);
            if (lastDocs[page]) q = query(usersRef, ...constraints, startAfter(lastDocs[page]));
            
            const userSnapshot = await getDocs(q);
            const docs = userSnapshot.docs;
            const hasNext = docs.length > PAGE_SIZE;
            setIsLastPage(!hasNext);
            setUsers(docs.slice(0, PAGE_SIZE).map(doc => ({ id: doc.id, ...doc.data() } as any)));
            
            if (hasNext && !lastDocs[page + 1]) {
                const newLastDocs = [...lastDocs]; newLastDocs[page + 1] = docs[PAGE_SIZE - 1]; setLastDocs(newLastDocs);
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            if (error.message?.includes('index')) {
                setIndexError("Firestore is still optimizing the search index for this specific filter/sort combination. This usually takes 1-2 minutes. Please try again shortly.");
            } else {
                showAlert('Failed to fetch registry.', 'error');
            }
        } finally { setLoadingUsers(false); }
    };

    useEffect(() => { if (activeTab === 'users') { fetchGlobalStats(); fetchUsers(); } }, [activeTab, page, roleFilter, verificationFilter, debouncedSearchTerm, sortConfig]);
    useEffect(() => { const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500); return () => clearTimeout(timer); }, [searchTerm]);
    useEffect(() => { setPage(0); setLastDocs([null]); }, [roleFilter, verificationFilter, debouncedSearchTerm, sortConfig]);

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => ({
            key,
            order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            await setDoc(doc(db, 'system_settings', 'subscription'), { semesterFee: Number(fee), isPayToUse, updatedAt: serverTimestamp() }, { merge: true });
            showAlert('Policies preserved.', 'success');
        } catch (error) { showAlert('Failed to update.', 'error'); } finally { setSaving(false); }
    };

    const handleUserAction = async (userId: string, action: 'role' | 'delete' | 'verify', data?: any) => {
        setManagingUser(null);
        try {
            const body: any = { userId };
            if (action === 'role') body.role = data;
            if (action === 'verify') body.isVerified = data;
            
            const performAction = async () => {
                const res = await fetch('/api/admin/users', { method: action === 'delete' ? 'DELETE' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const result = await res.json();
                if (result.success) { fetchGlobalStats(); fetchUsers(); showAlert('Registry updated.', 'success'); }
            };

            if (action === 'delete') {
                showConfirm('Purge this identity?', performAction);
            } else {
                await performAction();
            }
        } catch (error) {}
    };

    const SortIndicator = ({ column }: { column: SortKey }) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 group-hover:opacity-100 transition-all" />;
        return sortConfig.order === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1845D4]" /> : <ArrowDown className="w-3 h-3 text-[#1845D4]" />;
    };

    if (loadingSettings) return <div className="space-y-8 animate-pulse"><Skeleton className="h-10 w-48 bg-white" /><Skeleton className="h-40 bg-white" /><Skeleton className="h-96 bg-white" /></div>;

    const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-3xl font-serif text-[#0D0D1A] tracking-tighter">System Oversight</h1>
                    <p className="text-[13px] text-[#8888A8] font-medium mt-1">{todayStr}</p>
                </div>
                <div className="flex p-1 bg-white border border-[#DDE0F0] rounded-lg shadow-sm w-fit">
                    <button onClick={() => setActiveTab('settings')} className={`px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-[#1845D4] text-white' : 'text-[#8888A8] hover:text-[#0D0D1A]'}`}><Settings className="w-3.5 h-3.5" /> Settings</button>
                    <button onClick={() => setActiveTab('users')} className={`px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-[#1845D4] text-white' : 'text-[#8888A8] hover:text-[#0D0D1A]'}`}><Users className="w-3.5 h-3.5" /> Users</button>
                </div>
            </div>

            {activeTab === 'settings' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white border border-[#DDE0F0] rounded-lg p-6 shadow-sm">
                            <h3 className="text-[11px] font-bold text-[#8888A8] uppercase tracking-[0.08em] mb-4">Institutional Policy</h3>
                            <p className="text-[13px] text-[#444460] font-light leading-relaxed">Control global subscription requirements and fee structures.</p>
                        </div>
                    </div>
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSave} className="bg-white border border-[#DDE0F0] rounded-lg p-8 shadow-sm space-y-6">
                            <div className="flex items-center justify-between p-6 bg-[#F5F6FA] rounded border border-[#DDE0F0]">
                                <div>
                                    <h4 className="text-[14px] font-bold text-[#0D0D1A]">Subscription Mandatory</h4>
                                    <p className="text-[10px] text-[#8888A8] font-bold uppercase tracking-widest">Require payment for access</p>
                                </div>
                                <button type="button" onClick={() => setIsPayToUse(!isPayToUse)} className={`relative h-6 w-11 rounded-full transition-all ${isPayToUse ? 'bg-[#1845D4]' : 'bg-[#DDE0F0]'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all ${isPayToUse ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-[#0D0D1A]">Semester Fee (GHS)</label>
                                <input type="number" value={fee} onChange={(e) => setFee(Number(e.target.value))} className="w-full px-4 py-2.5 bg-white border-2 border-[#DDE0F0] focus:border-[#1845D4] rounded-md outline-none text-[14px] transition-all" />
                            </div>
                            <button type="submit" disabled={saving} className="px-8 py-2.5 bg-[#1845D4] text-white rounded-md font-bold text-[13px] uppercase tracking-widest shadow-lg shadow-blue-600/10 active:scale-95 transition-all">{saving ? 'Preserving...' : 'Update Policies'}</button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Minimal Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[{ label: 'Total Registry', val: globalStats.total }, { label: 'Students', val: globalStats.students }, { label: 'Lecturers', val: globalStats.lecturers }, { label: 'Admins', val: globalStats.admins }].map(s => (
                            <div key={s.label} className="bg-white p-6 rounded-lg border border-[#DDE0F0] shadow-sm">
                                <div className="text-[11px] font-bold text-[#8888A8] uppercase tracking-[0.08em] mb-3">{s.label}</div>
                                <div className="text-3xl font-serif text-[#0D0D1A] tracking-tight">{s.val}</div>
                            </div>
                        ))}
                    </div>

                    {/* Directory with Sort/Filter */}
                    <div className="bg-white border border-[#DDE0F0] rounded-lg overflow-hidden shadow-sm">
                        <div className="px-6 py-5 border-b border-[#DDE0F0] flex flex-col md:flex-row justify-between items-center gap-6">
                            <h2 className="text-[14px] font-bold text-[#0D0D1A]">User Directory</h2>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8888A8]" />
                                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 bg-[#F5F6FA] border border-[#DDE0F0] rounded-md outline-none text-[12px] font-medium focus:border-[#1845D4] transition-all w-48" />
                                </div>
                                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-white border border-[#DDE0F0] rounded-md text-[10px] font-bold uppercase tracking-widest px-3 py-2 outline-none text-[#8888A8] hover:border-[#1845D4] transition-all">
                                    <option value="all">Roles</option>
                                    <option value="student">Students</option>
                                    <option value="lecturer">Lecturers</option>
                                    <option value="admin">Admins</option>
                                </select>
                                <select value={verificationFilter} onChange={(e) => setVerificationFilter(e.target.value as any)} className="bg-white border border-[#DDE0F0] rounded-md text-[10px] font-bold uppercase tracking-widest px-3 py-2 outline-none text-[#8888A8] hover:border-[#1845D4] transition-all">
                                    <option value="all">Verification</option>
                                    <option value="verified">Verified</option>
                                    <option value="unverified">Unverified</option>
                                </select>
                            </div>
                        </div>

                        {indexError && (
                            <div className="mx-8 mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                                <Info className="w-4 h-4 text-[#1845D4] mt-0.5" />
                                <p className="text-[12px] text-[#1845D4] font-medium leading-relaxed">{indexError}</p>
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#F5F6FA] border-b border-[#DDE0F0]">
                                    <tr>
                                        <th onClick={() => handleSort('fullName')} className="px-6 py-4 text-[10px] font-bold text-[#8888A8] uppercase tracking-widest cursor-pointer group select-none">
                                            <div className="flex items-center gap-2">User Identity <SortIndicator column="fullName" /></div>
                                        </th>
                                        <th onClick={() => handleSort('role')} className="px-6 py-4 text-[10px] font-bold text-[#8888A8] uppercase tracking-widest cursor-pointer group select-none">
                                            <div className="flex items-center gap-2">Access Role <SortIndicator column="role" /></div>
                                        </th>
                                        <th onClick={() => handleSort('createdAt')} className="px-6 py-4 text-[10px] font-bold text-[#8888A8] uppercase tracking-widest cursor-pointer group select-none">
                                            <div className="flex items-center gap-2">Registry Date <SortIndicator column="createdAt" /></div>
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-[#8888A8] uppercase tracking-widest text-right">Operations</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#DDE0F0]">
                                    {users.map(u => (
                                        <tr key={u.id} className="group hover:bg-[#F5F6FA] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-md bg-white border border-[#DDE0F0] flex items-center justify-center overflow-hidden">
                                                        {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <span className="text-sm font-serif text-[#1845D4]">{u.fullName?.[0]}</span>}
                                                    </div>
                                                    <div>
                                                        <p className="text-[14px] font-medium text-[#0D0D1A] group-hover:text-[#1845D4] transition-colors">{u.fullName}</p>
                                                        <p className="text-[11px] text-[#8888A8]">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${u.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-[#F5F6FA] text-[#8888A8]'}`}>{u.role}</span>
                                                    {u.role === 'student' && (
                                                        <button onClick={() => handleUserAction(u.id, 'verify', !u.isVerified)} className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${u.isVerified ? 'bg-blue-50 text-[#1845D4]' : 'bg-[#F5F6FA] text-[#8888A8] hover:text-[#0D0D1A]'}`}><ShieldCheck className="w-3 h-3" /> {u.isVerified ? 'Verified' : 'Verify'}</button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-[12px] text-[#8888A8]">{u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('en-GB') : 'N/A'}</td>
                                            <td className="px-6 py-4 text-right relative">
                                                <button onClick={() => setManagingUser(managingUser === u.id ? null : u.id)} className="p-2 text-[#DDE0F0] hover:text-[#1845D4] transition-all"><MoreVertical className="w-4 h-4" /></button>
                                                {managingUser === u.id && (
                                                    <div className="absolute right-6 top-12 w-40 bg-white rounded-md shadow-2xl border border-[#DDE0F0] py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                                        {['admin', 'lecturer', 'student'].map(r => <button key={r} onClick={() => handleUserAction(u.id, 'role', r)} className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#F5F6FA] text-[#8888A8] transition-colors">{r}</button>)}
                                                        <div className="h-px bg-[#F5F6FA] my-2 mx-2" /><button onClick={() => handleUserAction(u.id, 'delete')} className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-50">Purge</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 bg-[#F5F6FA] flex items-center justify-between border-t border-[#DDE0F0]">
                            <span className="text-[10px] font-bold text-[#8888A8] uppercase tracking-widest">Page {page + 1}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-4 py-1.5 bg-white text-[#0D0D1A] rounded border border-[#DDE0F0] text-[10px] font-bold uppercase tracking-widest hover:border-[#1845D4] disabled:opacity-30 transition-all">Previous</button>
                                <button onClick={() => setPage(p => p + 1)} disabled={isLastPage} className="px-4 py-1.5 bg-[#1845D4] text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-[#0F2FA8] disabled:opacity-30 transition-all">Next</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
