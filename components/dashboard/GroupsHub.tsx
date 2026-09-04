'use client';

import { useState, useEffect, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, onSnapshot, orderBy, Timestamp, limit } from 'firebase/firestore';
import { Group, GroupMembership, GroupRequest, Session } from '@/lib/firebase/types';
import { createGroup, findGroupByCode, requestToJoinGroup, getAnnouncements, postAnnouncement, getResources, addResource, getGroupMembers, removeMember } from '@/lib/firebase/groups';
import { 
    Plus, Search, Users, Shield, Lock, Globe, MessageSquare, 
    MoreVertical, ChevronRight, Copy, Check, AlertCircle, 
    ArrowLeft, Bell, BookOpen, UserMinus, Send, Link as LinkIcon, ExternalLink, Trash2, Clock, RefreshCw,
    FileText, Upload, File, Loader2, Video, GraduationCap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '@/lib/firebase/api-client';
import { useAlert } from '@/contexts/AlertContext';
import { Skeleton } from '@/components/ui/Skeleton';

export default function GroupsHub() {
    const { user, profile } = useAuth();
    const { showAlert, showConfirm } = useAlert();
    const [myGroups, setMyGroups] = useState<Group[]>([]);
    const [publicGroups, setPublicGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

    // Create Form State
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [creating, setCreating] = useState(false);

    // Join Code State
    const [joinCode, setJoinCode] = useState('');
    const [joining, setJoining] = useState(false);

    const isVerified = profile?.role === 'lecturer' || profile?.isVerified === true;

    useEffect(() => {
        if (!user) return;

        // Fetch My Groups (via memberships) - batched query
        const membershipsQuery = query(collection(db, 'group_memberships'), where('userId', '==', user.uid));
        const unsubscribeMemberships = onSnapshot(membershipsQuery, async (snapshot) => {
            const groupIds = snapshot.docs.map(doc => doc.data().groupId);
            if (groupIds.length === 0) { setMyGroups([]); setLoading(false); return; }

            try {
                const q = query(collection(db, 'groups'), where('id', 'in', groupIds));
                const groupSnap = await getDocs(q);
                const groupsData = groupSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
                setMyGroups(groupsData);
            } catch (e) {
                console.error('Failed to fetch groups:', e);
            }
            setLoading(false);
        });

        // Fetch Public Groups
        const publicQuery = query(collection(db, 'groups'), where('isPublic', '==', true), limit(50));
        const unsubscribePublic = onSnapshot(publicQuery, (snapshot) => {
            setPublicGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
        });

        return () => { unsubscribeMemberships(); unsubscribePublic(); };
    }, [user]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !profile || !isVerified) return;
        setCreating(true);
        try {
            const code = crypto.randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
            await createGroup(newName, newDesc, user.uid, profile.fullName || 'User', user.email!, isPublic, code);
            setShowCreateModal(false);
            setNewName(''); setNewDesc('');
            showAlert('Community established.', 'success');
        } catch (error) { showAlert('Failed to create community.', 'error'); } finally { setCreating(false); }
    };

    const handleJoinByCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !profile) return;
        setJoining(true);
        try {
            const group = await findGroupByCode(joinCode);
            if (!group) { showAlert('Invalid secret code.', 'error'); return; }
            await requestToJoinGroup(group.id, user.uid, profile.fullName || 'User', user.email || '');
            
            // Notify Owner
            if (group.ownerEmail) {
                getAuthHeaders().then(headers => fetch('/api/communities/notifications', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'JOIN_REQUEST',
                        data: {
                            ownerEmail: group.ownerEmail,
                            ownerName: group.ownerName,
                            requesterName: profile.fullName || 'A student',
                            communityName: group.name
                        }
                    })
                })).catch(console.error);
            }

            setShowJoinModal(false);
            setJoinCode('');
            showAlert('Request sent to owner.', 'success');
        } catch (error: any) { showAlert(error.message || 'Join failed.', 'error'); } finally { setJoining(false); }
    };

    if (loading) return <div className="space-y-8 animate-pulse"><Skeleton className="h-10 w-48 bg-white" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><Skeleton className="h-48 bg-white" /><Skeleton className="h-48 bg-white" /><Skeleton className="h-48 bg-white" /></div></div>;

    if (selectedGroup) return <CommunityWorkspace group={selectedGroup} user={user!} profile={profile!} onBack={() => setSelectedGroup(null)} />;

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* Hub Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-serif text-[#0D0D1A] tracking-tighter">Communities</h1>
                    <p className="text-[13px] text-[#8888A8] font-medium mt-1">Connect, collaborate, and grow with your peers.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowJoinModal(true)} className="px-6 py-2.5 bg-white border border-[#DDE0F0] text-[#0D0D1A] rounded-md font-bold text-[11px] uppercase tracking-widest hover:border-[#1845D4] transition-all flex items-center gap-2 shadow-sm"><Lock className="w-4 h-4" /> Join by Code</button>
                    {isVerified && (
                        <button onClick={() => setShowCreateModal(true)} className="px-6 py-2.5 bg-[#1845D4] text-white rounded-md font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-blue-600/10 hover:bg-[#0F2FA8] transition-all flex items-center gap-2"><Plus className="w-4 h-4" /> Create Space</button>
                    )}
                </div>
            </div>

            {/* My Communities */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-[14px] font-bold text-[#0D0D1A] uppercase tracking-widest">My Registry</h2>
                    <div className="h-px flex-1 bg-[#DDE0F0]" />
                </div>
                {myGroups.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myGroups.map(group => (
                            <GroupCard key={group.id} group={group} isMember={true} onOpen={() => setSelectedGroup(group)} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white border-2 border-dashed border-[#DDE0F0] rounded-xl p-12 text-center space-y-4">
                        <Users className="w-10 h-10 text-[#DDE0F0] mx-auto" />
                        <p className="text-[13px] text-[#8888A8] font-medium max-w-xs mx-auto">You haven&apos;t joined any communities yet. Discover public spaces or use a join code.</p>
                    </div>
                )}
            </section>

            {/* Public Discovery */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-[14px] font-bold text-[#0D0D1A] uppercase tracking-widest">Discover</h2>
                    <div className="h-px flex-1 bg-[#DDE0F0]" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {publicGroups.filter(g => !myGroups.some(m => m.id === g.id)).map(group => (
                        <GroupCard key={group.id} group={group} isMember={false} />
                    ))}
                </div>
            </section>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-[#0D0D1A]/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                    <form onSubmit={handleCreate} className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-[#DDE0F0]">
                            <h3 className="text-xl font-serif font-black text-[#0D0D1A] tracking-tight">Establish Community</h3>
                            <p className="text-[12px] text-[#8888A8] font-medium mt-1">Create a dedicated space for your course or study group.</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-1.5"><label className="text-[11px] font-bold text-[#0D0D1A] uppercase tracking-widest">Space Name</label><input required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#DDE0F0] focus:border-[#1845D4] rounded-lg outline-none text-sm transition-all" placeholder="e.g. CS 301 Study Group" /></div>
                            <div className="space-y-1.5"><label className="text-[11px] font-bold text-[#0D0D1A] uppercase tracking-widest">Description</label><textarea required value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#DDE0F0] focus:border-[#1845D4] rounded-lg outline-none text-sm transition-all h-24 resize-none" placeholder="What is this space for?" /></div>
                            <div className="flex items-center justify-between p-4 bg-[#F5F6FA] rounded-lg border border-[#DDE0F0]">
                                <div><p className="text-[13px] font-bold text-[#0D0D1A]">Public Space</p><p className="text-[10px] text-[#8888A8] font-bold uppercase tracking-widest">Visible in discovery</p></div>
                                <button type="button" onClick={() => setIsPublic(!isPublic)} className={`relative w-10 h-5 rounded-full transition-all ${isPublic ? 'bg-[#1845D4]' : 'bg-[#DDE0F0]'}`}><span className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-all ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} /></button>
                            </div>
                        </div>
                        <div className="p-6 bg-[#F5F6FA] flex justify-end gap-3">
                            <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-[#8888A8] hover:text-[#0D0D1A]">Cancel</button>
                            <button type="submit" disabled={creating} className="px-8 py-2 bg-[#1845D4] text-white rounded font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-blue-600/10 active:scale-95 transition-all">{creating ? 'Building...' : 'Launch'}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Join Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-[#0D0D1A]/40 backdrop-blur-sm" onClick={() => setShowJoinModal(false)} />
                    <form onSubmit={handleJoinByCode} className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-8 text-center border-b border-[#DDE0F0]">
                            <div className="w-12 h-12 bg-[#F5F6FA] rounded-full flex items-center justify-center mx-auto mb-4 text-[#1845D4] shadow-sm"><Lock className="w-6 h-6" /></div>
                            <h3 className="text-xl font-serif font-black text-[#0D0D1A] tracking-tight">Access Registry</h3>
                            <p className="text-[12px] text-[#8888A8] font-medium mt-1">Enter the secret code shared by the owner.</p>
                        </div>
                        <div className="p-8">
                            <input required value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className="w-full px-4 py-4 bg-[#F5F6FA] border-2 border-[#DDE0F0] focus:border-[#1845D4] rounded-lg outline-none text-center text-2xl font-black tracking-[0.2em] transition-all uppercase" placeholder="XXXXXX" maxLength={6} />
                        </div>
                        <div className="p-6 bg-[#F5F6FA] flex justify-end gap-3">
                            <button type="button" onClick={() => setShowJoinModal(false)} className="px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-[#8888A8] hover:text-[#0D0D1A]">Close</button>
                            <button type="submit" disabled={joining} className="px-8 py-2 bg-[#1845D4] text-white rounded font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-blue-600/10 active:scale-95 transition-all">{joining ? 'Verifying...' : 'Request Access'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

const GroupCard = memo(function GroupCard({ group, isMember, onOpen }: { group: Group, isMember: boolean, onOpen?: () => void }) {
    const { user, profile } = useAuth();
    const { showAlert } = useAlert();
    const [requesting, setRequesting] = useState(false);

    const handleJoinRequest = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || !profile) return;
        setRequesting(true);
        try {
            await requestToJoinGroup(group.id, user.uid, profile.fullName || 'User', user.email || '');
            
            // Notify Owner
            if (group.ownerEmail) {
                getAuthHeaders().then(headers => fetch('/api/communities/notifications', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'JOIN_REQUEST',
                        data: {
                            ownerEmail: group.ownerEmail,
                            ownerName: group.ownerName,
                            requesterName: profile.fullName || 'A student',
                            communityName: group.name
                        }
                    })
                })).catch(console.error);
            }

            showAlert('Request sent!', 'success');
        } catch (e: any) { showAlert(e.message || 'Failed', 'error'); } finally { setRequesting(false); }
    };

    return (
        <div onClick={isMember ? onOpen : undefined} className={`group bg-white border border-[#DDE0F0] rounded-xl overflow-hidden hover:border-[#1845D4] transition-all flex flex-col shadow-sm h-full ${isMember ? 'cursor-pointer hover:translate-y-[-2px]' : ''}`}>
            <div className="p-6 flex-1 space-y-4">
                <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-[#F5F6FA] rounded-lg flex items-center justify-center text-[#1845D4] shadow-sm group-hover:bg-[#1845D4] group-hover:text-white transition-all"><Users className="w-6 h-6" /></div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${group.isPublic ? 'bg-blue-50 text-[#1845D4]' : 'bg-slate-100 text-slate-500'}`}>{group.isPublic ? 'Public' : 'Private'}</span>
                </div>
                <div>
                    <h3 className="text-lg font-serif font-black text-[#0D0D1A] tracking-tight line-clamp-1">{group.name}</h3>
                    <p className="text-[13px] text-[#8888A8] line-clamp-2 mt-1 leading-relaxed font-light">{group.description}</p>
                </div>
            </div>
            <div className="px-6 py-4 bg-[#F5F6FA] border-t border-[#DDE0F0] flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#444460]"><Users className="w-3.5 h-3.5" /><span className="text-[11px] font-bold">{group.memberCount} members</span></div>
                {isMember ? (
                    <ChevronRight className="w-4 h-4 text-[#8888A8] group-hover:translate-x-1 transition-all" />
                ) : (
                    <button onClick={handleJoinRequest} disabled={requesting} className="text-[10px] font-bold text-[#1845D4] uppercase tracking-widest hover:underline">{requesting ? '...' : 'Request to join'}</button>
                )}
            </div>
        </div>
    );
});
const CommunityWorkspace = memo(function CommunityWorkspace({ group, user, profile, onBack }: { group: Group, user: any, profile: any, onBack: () => void }) {
    const { showAlert, showConfirm } = useAlert();
    const [activeTab, setActiveTab] = useState<'announcements' | 'resources' | 'members' | 'requests' | 'live'>('announcements');
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
    const [members, setMembers] = useState<GroupMembership[]>([]);
    const [requests, setRequests] = useState<GroupRequest[]>([]);
    const [liveSessions, setLiveSessions] = useState<Session[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    const isOwner = group.ownerId === user.uid;

    useEffect(() => {
        // Real-time listener for sessions
        const qSessions = query(collection(db, 'sessions'), where('groupId', '==', group.id), limit(50));
        const unsubscribeLive = onSnapshot(qSessions, (snap) => {
            const allSessions = snap.docs.map(d => ({ id: d.id, ...d.data() } as Session));
            setLiveSessions(isOwner ? allSessions : allSessions.filter(s => s.isActive));
        });

        // Real-time listener for members
        const qMembers = query(collection(db, 'group_memberships'), where('groupId', '==', group.id));
        const unsubscribeMembers = onSnapshot(qMembers, (snap) => {
            setMembers(snap.docs.map(d => d.data() as GroupMembership));
        });

        // Real-time listener for announcements
        const qAnn = query(collection(db, 'groups', group.id, 'announcements'), orderBy('createdAt', 'desc'), limit(50));
        const unsubscribeAnn = onSnapshot(qAnn, (snap) => {
            setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            // Announcements back the default tab, so their first delivery is what marks
            // the workspace as ready. This flag used to be cleared synchronously while
            // attaching the listeners, which ended the loading state before any data
            // had actually arrived.
            setLoadingData(false);
        });

        // Real-time listener for resources
        const qRes = query(collection(db, 'groups', group.id, 'resources'), orderBy('createdAt', 'desc'), limit(50));
        const unsubscribeRes = onSnapshot(qRes, (snap) => {
            setResources(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Real-time listener for requests (owner only)
        let unsubscribeReq = () => {};
        if (isOwner) {
            const qReq = query(collection(db, 'group_requests'), where('groupId', '==', group.id), where('status', '==', 'pending'));
            unsubscribeReq = onSnapshot(qReq, (snap) => {
                setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as GroupRequest)));
            });
        }

        return () => {
            unsubscribeLive();
            unsubscribeMembers();
            unsubscribeAnn();
            unsubscribeRes();
            unsubscribeReq();
        };
    }, [group, isOwner]);

    const loadData = async () => {
        // loadData is now mostly redundant as onSnapshot handles everything
        // But we keep it empty or remove if no other side effects needed
    };

    const handlePostAnnouncement = async (content: string) => {
        try {
            await postAnnouncement(group.id, content, user.uid, profile.fullName || 'Owner');
            
            // Notify Members
            const memberEmails = members.filter(m => m.userEmail).map(m => m.userEmail!);
            if (memberEmails.length > 0) {
                getAuthHeaders().then(headers => fetch('/api/communities/notifications', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'ANNOUNCEMENT',
                        data: {
                            to: memberEmails,
                            communityName: group.name,
                            authorName: profile.fullName || 'Owner',
                            content
                        }
                    })
                })).catch(console.error);
            }

            showAlert('Announcement posted.', 'success');
            loadData();
        } catch (e) { showAlert('Failed to post.', 'error'); }
    };

    const handleAddResource = async (title: string, url: string, type: string) => {
        try {
            await addResource(group.id, title, url, type);
            showAlert('Resource shared.', 'success');
            loadData();
        } catch (e) { showAlert('Failed to share.', 'error'); }
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-right duration-500">
            {/* Workspace Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#DDE0F0]">
                <div className="flex items-center gap-6">
                    <button onClick={onBack} className="p-2.5 bg-white border border-[#DDE0F0] rounded-lg text-[#8888A8] hover:text-[#1845D4] hover:border-[#1845D4] transition-all"><ArrowLeft className="w-5 h-5" /></button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-2xl font-serif font-black text-[#0D0D1A] tracking-tighter">{group.name}</h1>
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-[#E8EEFF] text-[#1845D4] px-2 py-0.5 rounded-full">{group.isPublic ? 'Public Space' : 'Private Space'}</span>
                        </div>
                        <p className="text-[13px] text-[#8888A8] font-medium max-w-xl">{group.description}</p>
                    </div>
                </div>
                {isOwner && (
                    <div className="bg-white px-4 py-2 rounded-lg border border-[#DDE0F0] shadow-sm flex items-center gap-3">
                        <div className="text-[9px] font-bold text-[#8888A8] uppercase tracking-widest">Secret Code:</div>
                        <div className="text-[14px] font-black text-[#1845D4] tracking-widest font-mono">{group.joinCode || 'N/A'}</div>
                        <button onClick={() => { if (group.joinCode) { navigator.clipboard.writeText(group.joinCode); showAlert('Code copied!', 'success'); } }} className="p-1.5 hover:bg-[#F5F6FA] rounded text-[#8888A8] hover:text-[#1845D4] transition-all"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                )}
            </div>

            {/* Workspace Navigation */}
            <div className="flex flex-col lg:grid lg:grid-cols-4 gap-10">
                <aside className="space-y-1">
                    <button onClick={() => setActiveTab('announcements')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'announcements' ? 'bg-[#1845D4] text-white shadow-lg shadow-blue-600/10' : 'text-[#8888A8] hover:bg-white hover:text-[#0D0D1A]'}`}><Bell className="w-4 h-4" /> Bulletin Board</button>
                    <button onClick={() => setActiveTab('live')} className={`w-full flex items-center justify-between px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'live' ? 'bg-[#1845D4] text-white shadow-lg shadow-blue-600/10' : 'text-[#8888A8] hover:bg-white hover:text-[#0D0D1A]'}`}>
                        <div className="flex items-center gap-3"><Video className="w-4 h-4" /> Live Classes</div>
                        {liveSessions.some(s => s.isActive) && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />}
                    </button>
                    <button onClick={() => setActiveTab('resources')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'resources' ? 'bg-[#1845D4] text-white shadow-lg shadow-blue-600/10' : 'text-[#8888A8] hover:bg-white hover:text-[#0D0D1A]'}`}><BookOpen className="w-4 h-4" /> Resource Hub</button>
                    <button onClick={() => setActiveTab('members')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'members' ? 'bg-[#1845D4] text-white shadow-lg shadow-blue-600/10' : 'text-[#8888A8] hover:bg-white hover:text-[#0D0D1A]'}`}><Users className="w-4 h-4" /> Member Registry</button>
                    {isOwner && <button onClick={() => setActiveTab('requests')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'requests' ? 'bg-[#1845D4] text-white shadow-lg shadow-blue-600/10' : 'text-[#8888A8] hover:bg-white hover:text-[#0D0D1A]'}`}><AlertCircle className="w-4 h-4" /> Access Requests {requests.length > 0 && <span className="ml-auto bg-white text-[#1845D4] px-1.5 py-0.5 rounded-full text-[9px]">{requests.length}</span>}</button>}
                </aside>

                <main className="lg:col-span-3 min-h-[400px]">
                    {loadingData ? (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-[#DDE0F0]"><RefreshCw className="w-10 h-10 animate-spin" /></div>
                    ) : (
                        <div className="animate-in fade-in duration-300">
                            {activeTab === 'announcements' && <AnnouncementsTab announcements={announcements} isOwner={isOwner} onPost={handlePostAnnouncement} />}
                            {activeTab === 'live' && <LiveSessionsTab sessions={liveSessions} />}
                            {activeTab === 'resources' && <ResourcesTab resources={resources} isOwner={isOwner} onAdd={handleAddResource} groupId={group.id} />}
                            {activeTab === 'members' && <MembersTab members={members} isOwner={isOwner} groupId={group.id} currentUserId={user.uid} refresh={loadData} />}
                            {activeTab === 'requests' && isOwner && <RequestsTab requests={requests} communityName={group.name} refresh={loadData} />}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
});
function AnnouncementsTab({ announcements, isOwner, onPost }: { announcements: any[], isOwner: boolean, onPost: (c: string) => void }) {
    const [newContent, setNewContent] = useState('');
    return (
        <div className="space-y-8">
            {isOwner && (
                <div className="bg-white border border-[#DDE0F0] rounded-xl p-6 shadow-sm space-y-4">
                    <h3 className="text-[11px] font-bold text-[#8888A8] uppercase tracking-widest">New Announcement</h3>
                    <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} className="w-full h-24 p-4 bg-[#F5F6FA] border border-[#DDE0F0] focus:border-[#1845D4] rounded-lg outline-none text-[13px] resize-none" placeholder="What's the update for today?" />
                    <div className="flex justify-end"><button onClick={() => { onPost(newContent); setNewContent(''); }} disabled={!newContent.trim()} className="px-6 py-2 bg-[#1845D4] text-white rounded-md text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-blue-600/10 active:scale-95 transition-all flex items-center gap-2"><Send className="w-3.5 h-3.5" /> Post Update</button></div>
                </div>
            )}
            <div className="space-y-6">
                {announcements.length > 0 ? announcements.map(a => (
                    <div key={a.id} className="bg-white border border-[#DDE0F0] rounded-xl p-6 shadow-sm space-y-3">
                        <div className="flex items-center justify-between text-[11px] font-bold text-[#8888A8] uppercase tracking-widest"><span>{a.authorName}</span><span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {a.createdAt?.toDate().toLocaleDateString('en-GB')}</span></div>
                        <p className="text-[14px] text-[#0D0D1A] leading-relaxed whitespace-pre-wrap">{a.content}</p>
                    </div>
                )) : <div className="text-center py-10 text-[#8888A8] font-medium text-[13px]">No updates yet.</div>}
            </div>
        </div>
    );
}

function ResourcesTab({ resources, isOwner, onAdd, groupId }: { resources: any[], isOwner: boolean, onAdd: (t: string, u: string, type: string) => void, groupId: string }) {
    const { showAlert } = useAlert();
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            showAlert('File too large (Max 20MB)', 'warning');
            return;
        }

        setUploading(true);
        try {
            // Upload via MinIO presign API (matches the static dashboard Library flow)
            const headers = await getAuthHeaders();
            const presignRes = await fetch('/api/storage/presign', {
                method: 'POST',
                headers,
                body: JSON.stringify({ kind: 'resource', groupId, fileName: file.name, size: file.size }),
            });
            const presignData = await presignRes.json();
            if (!presignRes.ok) throw new Error(presignData.error || 'Failed to create upload');

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', presignData.uploadUrl);
                xhr.upload.onprogress = (ev) => {
                    if (ev.lengthComputable) setProgress((ev.loaded / ev.total) * 100);
                };
                xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
                xhr.onerror = () => reject(new Error('Upload failed.'));
                xhr.send(file);
            });

            onAdd(file.name, presignData.url, 'file');
        } catch (err) {
            console.error(err);
            showAlert(err instanceof Error ? err.message : 'Upload failed', 'error');
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    return (
        <div className="space-y-8">
            {isOwner && (
                <div className="bg-white border border-[#DDE0F0] rounded-xl p-8 shadow-sm space-y-8 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Link Sharing */}
                        <div className="flex-1 space-y-4">
                            <h3 className="text-[11px] font-bold text-[#8888A8] uppercase tracking-[0.08em] flex items-center gap-2"><LinkIcon className="w-3.5 h-3.5" /> Share Access Link</h3>
                            <div className="space-y-3">
                                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 bg-[#F5F6FA] border border-[#DDE0F0] focus:border-[#1845D4] rounded-lg outline-none text-[13px] transition-all" placeholder="Title (e.g. Course Syllabus)" />
                                <div className="flex gap-2">
                                    <input value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 px-4 py-3 bg-[#F5F6FA] border border-[#DDE0F0] focus:border-[#1845D4] rounded-lg outline-none text-[13px] transition-all" placeholder="Paste URL here..." />
                                    <button onClick={() => { onAdd(title, url, 'link'); setTitle(''); setUrl(''); }} disabled={!title.trim() || !url.trim()} className="px-6 py-3 bg-[#1845D4] text-white rounded-lg text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-blue-600/10 active:scale-95 transition-all disabled:opacity-50">Share</button>
                                </div>
                            </div>
                        </div>

                        <div className="hidden md:block w-px bg-[#DDE0F0]" />

                        {/* File Upload */}
                        <div className="flex-1 space-y-4">
                            <h3 className="text-[11px] font-bold text-[#8888A8] uppercase tracking-[0.08em] flex items-center gap-2"><Upload className="w-3.5 h-3.5" /> Upload Document</h3>
                            <div className="relative group">
                                <label className={`w-full h-[98px] border-2 border-dashed border-[#DDE0F0] rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer hover:border-[#1845D4] hover:bg-blue-50/30 ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
                                    {uploading ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-6 h-6 text-[#1845D4] animate-spin" />
                                            <span className="text-[10px] font-bold text-[#1845D4] uppercase tracking-widest">{Math.round(progress)}%</span>
                                        </div>
                                    ) : (
                                        <>
                                            <FileText className="w-6 h-6 text-[#8888A8] group-hover:text-[#1845D4] transition-colors" />
                                            <span className="text-[10px] font-bold text-[#8888A8] uppercase tracking-widest group-hover:text-[#1845D4] transition-colors">Select PDF/Docs (Max 20MB)</span>
                                        </>
                                    )}
                                    <input type="file" className="hidden" disabled={uploading} onChange={handleFileUpload} accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resources.length > 0 ? resources.map((r, i) => (
                    <a key={r.id || `resource-${i}`} href={r.url} target="_blank" rel="noopener noreferrer" className="bg-white border border-[#DDE0F0] p-6 rounded-xl hover:border-[#1845D4] transition-all flex items-start justify-between shadow-sm group">
                        <div className="flex items-start gap-4 overflow-hidden">
                            <div className="w-12 h-12 bg-[#F5F6FA] rounded-lg flex items-center justify-center text-[#1845D4] group-hover:bg-[#1845D4] group-hover:text-white transition-all shrink-0">
                                {r.type === 'file' ? <FileText className="w-6 h-6" /> : <LinkIcon className="w-6 h-6" />}
                            </div>
                            <div className="overflow-hidden">
                                <h4 className="text-[14px] font-bold text-[#0D0D1A] group-hover:text-[#1845D4] transition-colors truncate">{r.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${r.type === 'file' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>{r.type || 'link'}</span>
                                    <p className="text-[10px] text-[#8888A8] font-medium truncate">{r.url}</p>
                                </div>
                            </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-[#DDE0F0] group-hover:text-[#1845D4] transition-colors mt-1" />
                    </a>
                )) : (
                    <div className="col-span-full py-20 bg-white border-2 border-dashed border-[#DDE0F0] rounded-xl text-center space-y-4">
                        <BookOpen className="w-10 h-10 text-[#DDE0F0] mx-auto" />
                        <p className="text-[13px] text-[#8888A8] font-medium">No materials shared in this workspace yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MembersTab({ members, isOwner, groupId, currentUserId, refresh }: { members: GroupMembership[], isOwner: boolean, groupId: string, currentUserId: string, refresh: () => void }) {
    const { showConfirm } = useAlert();
    const handleRemove = (userId: string, name: string) => {
        showConfirm(`Expel ${name} from the community?`, async () => {
            await removeMember(groupId, userId);
            refresh();
        });
    };
    return (
        <div className="bg-white border border-[#DDE0F0] rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
                <thead className="bg-[#F5F6FA] border-b border-[#DDE0F0]"><tr className="text-[10px] font-bold text-[#8888A8] uppercase tracking-widest"><th className="px-6 py-4">Identity</th><th className="px-6 py-4">Role</th>{isOwner && <th className="px-6 py-4 text-right">Action</th>}</tr></thead>
                <tbody className="divide-y divide-[#DDE0F0]">
                    {members.map(m => (
                        <tr key={m.userId} className="text-[13px]">
                            <td className="px-6 py-4 font-bold text-[#0D0D1A]">{m.userName}</td>
                            <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${m.role === 'owner' ? 'bg-[#1845D4] text-white' : 'bg-[#F5F6FA] text-[#8888A8]'}`}>{m.role}</span></td>
                            {isOwner && <td className="px-6 py-4 text-right">{m.userId !== currentUserId && <button onClick={() => handleRemove(m.userId as string, m.userName as string)} className="p-2 text-[#DDE0F0] hover:text-red-600 transition-all"><UserMinus className="w-4 h-4" /></button>}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function RequestsTab({ requests, communityName, refresh }: { requests: GroupRequest[], communityName: string, refresh: () => void }) {
    const { showAlert } = useAlert();
    const handleAction = async (request: GroupRequest, status: 'approved' | 'rejected') => {
        try {
            const { handleJoinRequest } = await import('@/lib/firebase/groups');
            await handleJoinRequest(request.id!, status);
            
            if (status === 'approved') {
                // Notify Student
                getAuthHeaders().then(headers => fetch('/api/communities/notifications', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'JOIN_APPROVAL',
                        data: {
                            userEmail: request.userEmail,
                            userName: request.userName,
                            communityName: communityName
                        }
                    })
                })).catch(console.error);
            }

            showAlert(`Member ${status === 'approved' ? 'enrolled' : 'rejected'}.`, 'success');
            refresh();
        } catch (e) { showAlert('Action failed.', 'error'); }
    };
    return (
        <div className="space-y-4">
            {requests.length > 0 ? requests.map(r => (
                <div key={r.id} className="bg-white border border-[#DDE0F0] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div>
                        <h4 className="text-[14px] font-bold text-[#0D0D1A]">{r.userName}</h4>
                        <p className="text-[11px] text-[#8888A8] font-bold uppercase tracking-widest">{r.userEmail}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleAction(r, 'rejected')} className="px-4 py-2 bg-white border border-[#DDE0F0] text-[#8888A8] rounded text-[10px] font-bold uppercase tracking-widest hover:text-red-600 hover:border-red-600 transition-all">Reject</button>
                        <button onClick={() => handleAction(r, 'approved')} className="px-6 py-2 bg-[#1845D4] text-white rounded text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-600/10 hover:bg-[#0F2FA8] transition-all">Approve</button>
                    </div>
                </div>
            )) : <div className="text-center py-20 bg-white border border-[#DDE0F0] rounded-xl text-[#8888A8] font-medium text-[13px]">No pending access requests.</div>}
        </div>
    );
}

const LiveSessionsTab = memo(function LiveSessionsTab({ sessions }: { sessions: Session[] }) {
    const router = useRouter();
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <h3 className="text-[11px] font-bold text-[#0D0D1A] uppercase tracking-[0.2em]">Happening Now</h3>
            </div>
            {sessions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sessions.map(s => (
                        <div key={s.id} className={`bg-white border-2 rounded-xl p-8 shadow-sm transition-all group relative overflow-hidden ${s.isActive ? 'border-[#E8EEFF] hover:border-[#1845D4]' : 'border-[#F5F6FA] opacity-80'}`}>
                            <div className="absolute top-0 right-0 p-4">
                                {s.isActive ? (
                                    <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                                        <span className="w-1 h-1 bg-red-600 rounded-full" /> Live
                                    </div>
                                ) : (
                                    <div className="bg-[#F5F6FA] text-[#8888A8] px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                        <span className="w-1 h-1 bg-[#8888A8] rounded-full" /> Scheduled
                                    </div>
                                )}
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <h4 className={`text-xl font-serif font-black leading-tight transition-colors ${s.isActive ? 'text-[#0D0D1A] group-hover:text-[#1845D4]' : 'text-[#8888A8]'}`}>{s.title}</h4>
                                    <p className="text-[12px] text-[#8888A8] font-bold uppercase tracking-widest flex items-center gap-2"><GraduationCap className="w-3.5 h-3.5" /> {s.lecturerName || 'Faculty Member'}</p>
                                </div>
                                <div className="flex items-center gap-4 pt-4 border-t border-[#F5F6FA]">
                                    <button onClick={() => router.push(`/classroom/${s.id}`)} className={`flex-1 py-3 rounded-lg font-bold text-[11px] uppercase tracking-widest transition-all ${s.isActive ? 'bg-[#1845D4] text-white shadow-xl shadow-blue-600/10 hover:bg-[#0F2FA8] active:scale-95' : 'bg-[#F5F6FA] text-[#8888A8] cursor-not-allowed'}`}>{s.isActive ? 'Join Classroom' : 'Waiting to start...'}</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-24 bg-[#F5F6FA]/50 border-2 border-dashed border-[#DDE0F0] rounded-xl text-center space-y-4">
                    <Video className="w-10 h-10 text-[#DDE0F0] mx-auto" />
                    <p className="text-[13px] text-[#8888A8] font-medium italic">No live sessions currently scheduled for this community.</p>
                </div>
            )}
        </div>
    );
});
