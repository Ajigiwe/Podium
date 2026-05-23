// public/js/communities.js
import { auth, db, storage } from './firebase-config.js';
import { 
    collection, query, where, onSnapshot, addDoc, serverTimestamp, 
    setDoc, doc, updateDoc, getDoc, getDocs, orderBy, increment, deleteDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    ref, uploadBytesResumable, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// DOM Elements
const myCommunitiesList = document.getElementById('my-communities-list');
const publicCommunitiesList = document.getElementById('public-communities-list');
const workspaceView = document.getElementById('workspace-view');
const workspaceTitle = document.getElementById('workspace-title');
const workspaceCode = document.getElementById('workspace-code');
const closeWorkspaceBtn = document.getElementById('close-workspace');

const announcementComposer = document.getElementById('announcement-composer');
const announcementsList = document.getElementById('announcements-list');
const resourceComposer = document.getElementById('resource-composer');
const resourcesList = document.getElementById('resources-list');
const membersList = document.getElementById('members-list');
const requestsTabBtn = document.getElementById('w-tab-requests');
const requestsCount = document.getElementById('requests-count');
const requestsContent = document.getElementById('w-content-requests');

const createCommunityForm = document.getElementById('create-community-form');
const joinCommunityForm = document.getElementById('join-community-form');

// State
let currentGroup = null;
let isOwner = false;
let workspaceUnsubscribes = [];

export function initCommunities(user, profile) {
    setupMyCommunities(user.uid);
    setupPublicCommunities(user.uid);
    setupModals();
    setupCommunityForms(user, profile);
    setupWorkspaceActions(user, profile);
}

// --- TAB SWITCHING ---
window.switchWorkspaceTab = (tab) => {
    const tabs = ['bulletin', 'live', 'resources', 'members', 'requests'];
    tabs.forEach(t => {
        const btn = document.getElementById(`w-tab-${t}`);
        const content = document.getElementById(`w-content-${t}`);
        if (!btn || !content) return;
        
        const isActive = t === tab;
        if (isActive) {
            btn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-md text-[13px] font-medium transition-all bg-[#E8EEFF] text-[#1845D4]';
            content.classList.remove('hidden');
        } else {
            btn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-md text-[13px] font-medium transition-all text-[#444460] hover:bg-white';
            content.classList.add('hidden');
        }
    });
};

// --- DATA LISTENERS ---
function setupMyCommunities(uid) {
    const q = query(collection(db, 'group_memberships'), where('userId', '==', uid));
    onSnapshot(q, async (snap) => {
        myCommunitiesList.innerHTML = '';
        if (snap.empty) {
            myCommunitiesList.innerHTML = `<div class="col-span-full py-12 text-center border border-[#DDE0F0] rounded-xl opacity-50"><p class="text-[10px] font-bold uppercase tracking-widest">No spaces joined yet.</p></div>`;
            return;
        }
        
        for (const mDoc of snap.docs) {
            const membership = mDoc.data();
            const groupSnap = await getDoc(doc(db, 'groups', membership.groupId));
            if (groupSnap.exists()) {
                const group = { id: groupSnap.id, ...groupSnap.data() };
                const card = createCommunityCard(group, true);
                card.classList.add('animate-fade-in');
                myCommunitiesList.appendChild(card);
            }
        }
    }, (err) => console.error('[MyCommunities] Error:', err));
}

function setupPublicCommunities(uid) {
    const q = query(collection(db, 'groups'), where('isPublic', '==', true));
    onSnapshot(q, (snap) => {
        publicCommunitiesList.innerHTML = '';
        const groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        groups.forEach((group, index) => {
            if (group.ownerId !== uid) {
                const card = createCommunityCard(group, false);
                card.classList.add('animate-fade-in');
                card.style.animationDelay = `${index * 0.1}s`;
                publicCommunitiesList.appendChild(card);
            }
        });
    }, (err) => console.error('[PublicCommunities] Error:', err));
}

function createCommunityCard(group, isMember) {
    const div = document.createElement('div');
    div.className = 'group bg-white dark:bg-slate-900 border border-[#DDE0F0] dark:border-slate-800 rounded-xl p-8 relative overflow-hidden flex flex-col justify-between shadow-sm hover:border-[#1845D4] hover:shadow-lg transition-all';
    
    div.innerHTML = `
        <div class="space-y-6">
            <div class="flex justify-between items-start">
                <div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 flex items-center justify-center">
                    <i class="fas fa-users text-[#1845D4] dark:text-blue-400 text-xl"></i>
                </div>
                <span class="px-3 py-1 bg-[#F5F6FA] dark:bg-slate-950 border border-[#DDE0F0] dark:border-slate-800 rounded-full text-[9px] font-bold uppercase tracking-widest text-[#8888A8]">
                    ${group.memberCount || 0} Members
                </span>
            </div>
            <div>
                <h4 class="font-serif font-black text-xl line-clamp-1 tracking-tight text-[#0D0D1A] dark:text-white">${group.name}</h4>
                <p class="text-[13px] text-[#444460] dark:text-slate-400 line-clamp-2 mt-2 font-medium leading-relaxed">${group.description}</p>
            </div>
            <button class="w-full py-3.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${isMember ? 'bg-[#F5F6FA] dark:bg-slate-800 text-[#0D0D1A] dark:text-white border border-[#DDE0F0] dark:border-slate-700 hover:bg-[#1845D4] hover:text-white' : 'bg-[#0D0D1A] dark:bg-slate-100 text-white dark:text-[#0D0D1A] hover:bg-black'}">
                ${isMember ? 'Enter Workspace' : 'Request to Join'}
            </button>
        </div>
    `;
    
    div.querySelector('button').onclick = () => {
        if (isMember) openWorkspace(group);
        else requestToJoin(group.id);
    };
    
    return div;
}

// --- WORKSPACE LOGIC ---
async function openWorkspace(group) {
    currentGroup = group;
    isOwner = group.ownerId === auth.currentUser.uid;
    
    workspaceTitle.innerText = group.name;
    workspaceCode.innerText = `CODE: ${group.joinCode || 'PRIVATE'}`;
    workspaceView.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Show/Hide Owner Tools
    announcementComposer.classList.toggle('hidden', !isOwner);
    resourceComposer.classList.toggle('hidden', !isOwner);
    requestsTabBtn.classList.toggle('hidden', !isOwner);
    document.getElementById('members-action-head').classList.toggle('hidden', !isOwner);
    
    // Switch to Bulletin by default
    window.switchWorkspaceTab('bulletin');
    
    // Start Real-time Workspace Listeners
    setupWorkspaceListeners(group.id);
}

function setupWorkspaceListeners(groupId) {
    workspaceUnsubscribes.forEach(unsub => unsub());
    workspaceUnsubscribes = [];
    
    // 1. Live Sessions
    const qSessions = query(collection(db, 'sessions'), where('groupId', '==', groupId));
    workspaceUnsubscribes.push(onSnapshot(qSessions, (snap) => {
        const liveIndicator = document.getElementById('live-indicator');
        const liveList = document.getElementById('workspace-live-list');
        liveList.innerHTML = '';
        
        const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(s => !s.isDeleted);
        const activeSessions = sessions.filter(s => s.isActive);
        
        liveIndicator.classList.toggle('hidden', activeSessions.length === 0);
        const displaySessions = isOwner ? sessions : activeSessions;
        
        if (displaySessions.length === 0) {
            liveList.innerHTML = `<div class="col-span-full py-12 text-center opacity-50"><p class="text-[10px] font-bold uppercase tracking-widest">No sessions found.</p></div>`;
            return;
        }
        
        displaySessions.forEach(s => {
            const card = createWorkspaceSessionCard(s);
            liveList.appendChild(card);
        });
    }));

    // 2. Announcements
    const qAnn = query(collection(db, 'groups', groupId, 'announcements'), orderBy('createdAt', 'desc'));
    workspaceUnsubscribes.push(onSnapshot(qAnn, (snap) => {
        announcementsList.innerHTML = '';
        snap.forEach(doc => {
            const ann = doc.data();
            const div = document.createElement('div');
            div.className = 'bg-white dark:bg-slate-900 p-8 rounded-xl border border-[#DDE0F0] dark:border-slate-800 shadow-sm group';
            div.innerHTML = `
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-[#1845D4] dark:text-blue-400">
                        <i class="fas fa-bullhorn text-xs"></i>
                    </div>
                    <div>
                        <p class="text-[13px] font-bold text-[#0D0D1A] dark:text-white">${ann.authorName}</p>
                        <p class="text-[9px] font-black text-[#8888A8] uppercase tracking-[0.2em] mt-1">${ann.createdAt?.toDate().toLocaleDateString('en-GB')}</p>
                    </div>
                </div>
                <p class="text-[13px] font-medium text-[#444460] dark:text-slate-300 leading-relaxed">${ann.content}</p>
            `;
            announcementsList.appendChild(div);
        });
    }));

    // 3. Resources
    const qRes = query(collection(db, 'groups', groupId, 'resources'), orderBy('createdAt', 'desc'));
    workspaceUnsubscribes.push(onSnapshot(qRes, (snap) => {
        resourcesList.innerHTML = '';
        snap.forEach(doc => {
            const res = doc.data();
            const div = document.createElement('div');
            div.className = 'bg-[#FDFBF7] dark:bg-slate-900 p-6 border-l-4 border-[#5C4D3C] dark:border-[#1845D4] border-t border-r border-b border-[#E8E1D5] dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all relative';
            div.innerHTML = `
                <div class="absolute top-3 right-4 text-[9px] font-serif font-bold text-[#CBBCA0] dark:text-slate-500 uppercase tracking-widest">
                    ${res.type === 'link' ? 'Ref' : 'Doc'} // ${new Date(res.createdAt?.toDate() || Date.now()).getFullYear()}
                </div>
                <div class="flex items-start gap-4 mb-4 pt-2">
                    <div class="mt-1 w-8 h-8 rounded-full bg-[#F5F1E7] dark:bg-slate-800 flex items-center justify-center text-[#5C4D3C] dark:text-slate-400 border border-[#E8E1D5] dark:border-slate-700">
                        <i class="fas ${res.type === 'link' ? 'fa-bookmark' : 'fa-book'} text-xs"></i>
                    </div>
                    <div class="flex-1 pr-4">
                        <h5 class="text-[15px] font-serif font-bold leading-snug text-[#2C241B] dark:text-white line-clamp-2">${res.title}</h5>
                    </div>
                </div>
                <div class="flex items-center justify-between border-t border-[#E8E1D5] dark:border-slate-800 pt-4 mt-2">
                    <div class="text-[10px] font-serif font-bold text-[#8888A8] uppercase tracking-[0.1em]">
                        ${res.type === 'link' ? 'External Reference' : 'Archived Material'}
                    </div>
                    <a href="${res.url}" target="_blank" class="px-4 py-1.5 rounded-full bg-[#F5F1E7] dark:bg-slate-800 text-[#5C4D3C] dark:text-slate-300 text-[10px] font-bold uppercase tracking-widest hover:bg-[#5C4D3C] hover:text-[#FDFBF7] dark:hover:bg-[#1845D4] dark:hover:text-white transition-all border border-[#E8E1D5] dark:border-slate-700">
                        Access
                    </a>
                </div>
            `;
            resourcesList.appendChild(div);
        });
    }));

    // 4. Members
    const qMem = query(collection(db, 'group_memberships'), where('groupId', '==', groupId));
    workspaceUnsubscribes.push(onSnapshot(qMem, (snap) => {
        membersList.innerHTML = '';
        snap.forEach(doc => {
            const mem = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-[#F5F6FA] dark:bg-slate-800 flex items-center justify-center font-bold text-[#8888A8] dark:text-slate-400 uppercase text-[10px]">
                            ${mem.userName.charAt(0)}
                        </div>
                        <div>
                            <p class="text-[13px] font-bold text-[#0D0D1A] dark:text-white">${mem.userName}</p>
                            <p class="text-[9px] text-[#8888A8] uppercase tracking-widest font-bold">${mem.userEmail || ''}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${mem.role === 'owner' ? 'bg-blue-50 text-[#1845D4]' : 'bg-[#F5F6FA] text-[#8888A8]'}">
                        ${mem.role}
                    </span>
                </td>
                ${isOwner && mem.role !== 'owner' ? `
                    <td class="px-6 py-4 text-right">
                        <button onclick="window.kickMember('${groupId}', '${mem.userId}')" class="text-red-400 hover:text-red-600 transition-colors">
                            <i class="fas fa-user-minus"></i>
                        </button>
                    </td>
                ` : '<td class="px-6 py-4"></td>'}
            `;
            membersList.appendChild(tr);
        });
    }));

    if (isOwner) {
        const qReq = query(collection(db, 'group_requests'), where('groupId', '==', groupId), where('status', '==', 'pending'));
        workspaceUnsubscribes.push(onSnapshot(qReq, (snap) => {
            requestsCount.innerText = snap.size;
            requestsContent.innerHTML = '';
            if (snap.empty) {
                requestsContent.innerHTML = `<div class="py-12 text-center opacity-50"><p class="text-[10px] font-bold uppercase tracking-widest">No pending requests.</p></div>`;
                return;
            }
            snap.forEach(docSnap => {
                const req = docSnap.data();
                const div = document.createElement('div');
                div.className = 'bg-white p-6 rounded-xl border border-[#DDE0F0] shadow-sm flex items-center justify-between';
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-[#F5F6FA] flex items-center justify-center text-[#8888A8] font-bold text-xs uppercase">
                            ${req.userName.charAt(0)}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-[#0D0D1A]">${req.userName}</p>
                            <p class="text-[10px] font-bold text-[#8888A8] uppercase tracking-widest">${req.userEmail}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.processRequest('${docSnap.id}', 'approved')" class="px-4 py-2 bg-[#1845D4] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest">Approve</button>
                        <button onclick="window.processRequest('${docSnap.id}', 'rejected')" class="px-4 py-2 bg-[#F5F6FA] text-[#444460] rounded-lg text-[10px] font-bold uppercase tracking-widest">Reject</button>
                    </div>
                `;
                requestsContent.appendChild(div);
            });
        }));
    }
}

function createWorkspaceSessionCard(s) {
    const div = document.createElement('div');
    div.className = `bg-white border-2 rounded-xl p-8 transition-all group relative overflow-hidden ${s.isActive ? 'border-[#1845D4]/20 shadow-lg shadow-[#1845D4]/5' : 'border-[#DDE0F0] opacity-80'}`;
    
    div.innerHTML = `
        <div class="absolute top-0 right-0 p-6">
            ${s.isActive ? `
                <div class="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 animate-pulse">
                    <span class="w-1.5 h-1.5 bg-red-600 rounded-full"></span> Live
                </div>
            ` : `
                <div class="bg-[#F5F6FA] text-[#8888A8] px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 border border-[#DDE0F0]">
                    <span class="w-1.5 h-1.5 bg-[#8888A8]/30 rounded-full"></span> Active
                </div>
            `}
        </div>
        <div class="space-y-6">
            <div>
                <h4 class="text-xl font-serif font-black tracking-tight leading-tight text-[#0D0D1A]">${s.title}</h4>
                <p class="text-[10px] font-bold text-[#8888A8] uppercase tracking-widest mt-2">${s.lecturerName}</p>
            </div>
            <button onclick="window.location.href='/classroom/${s.id}'" class="w-full py-3.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${s.isActive ? 'bg-[#1845D4] text-white shadow-xl shadow-[#1845D4]/20' : 'bg-[#F5F6FA] text-[#8888A8] cursor-not-allowed border border-[#DDE0F0]'}" ${!s.isActive ? 'disabled' : ''}>
                ${s.isActive ? 'Join Classroom' : 'Waiting to start...'}
            </button>
        </div>
    `;
    return div;
}

// --- ACTIONS ---
function setupWorkspaceActions(user, profile) {
    document.getElementById('post-announcement').onclick = async () => {
        const text = document.getElementById('announcement-text').value;
        if (!text.trim()) return;
        await addDoc(collection(db, 'groups', currentGroup.id, 'announcements'), {
            content: text,
            authorId: user.uid,
            authorName: profile.fullName || user.email,
            createdAt: serverTimestamp()
        });
        document.getElementById('announcement-text').value = '';
    };

    document.getElementById('share-link').onclick = async () => {
        const title = document.getElementById('res-link-title').value;
        const url = document.getElementById('res-link-url').value;
        if (!title || !url) return;
        await addDoc(collection(db, 'groups', currentGroup.id, 'resources'), {
            title, url, type: 'link', createdAt: serverTimestamp()
        });
        document.getElementById('res-link-title').value = '';
        document.getElementById('res-link-url').value = '';
    };

    document.getElementById('res-file-input').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const progressContainer = document.getElementById('upload-progress-container');
        const progressBar = document.getElementById('upload-progress-bar');
        progressContainer.classList.remove('hidden');
        const storageRef = ref(storage, `group-resources/${currentGroup.id}/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on('state_changed', 
            (snapshot) => { progressBar.style.width = (snapshot.bytesTransferred / snapshot.totalBytes) * 100 + '%'; }, 
            (error) => alert(error.message), 
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                await addDoc(collection(db, 'groups', currentGroup.id, 'resources'), {
                    title: file.name, url: url, type: 'file', createdAt: serverTimestamp()
                });
                progressContainer.classList.add('hidden');
            }
        );
    };

    closeWorkspaceBtn.onclick = () => {
        workspaceView.classList.add('hidden');
        document.body.style.overflow = 'auto';
        workspaceUnsubscribes.forEach(unsub => unsub());
    };
}

window.processRequest = async (requestId, status) => {
    const requestRef = doc(db, 'group_requests', requestId);
    const snap = await getDoc(requestRef);
    const req = snap.data();
    if (status === 'approved') {
        const membershipId = `${req.userId}_${req.groupId}`;
        await setDoc(doc(db, 'group_memberships', membershipId), {
            id: membershipId, userId: req.userId, groupId: req.groupId,
            role: 'student', joinedAt: Timestamp.now(), userName: req.userName, userEmail: req.userEmail
        });
        await updateDoc(doc(db, 'groups', req.groupId), { memberCount: increment(1) });
    }
    await updateDoc(requestRef, { status });
};

window.kickMember = async (groupId, userId) => {
    if (confirm('Remove this member?')) {
        await deleteDoc(doc(db, 'group_memberships', `${userId}_${groupId}`));
        await updateDoc(doc(db, 'groups', groupId), { memberCount: increment(-1) });
    }
};

function setupModals() {
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modals = ['modal-create-community', 'modal-join-community', 'modal-create', 'modal-join-preview'];
            modals.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
        });
    });
}

async function requestToJoin(groupId) {
    const user = auth.currentUser;
    try {
        await addDoc(collection(db, 'group_requests'), {
            groupId, userId: user.uid, userName: user.displayName || 'Student',
            userEmail: user.email, status: 'pending', createdAt: serverTimestamp()
        });
        showToast('Request sent to owner.');
    } catch (err) {
        showToast('Failed to send request.', 'error');
    }
}

function setupCommunityForms(user, profile) {
    if (createCommunityForm) {
        createCommunityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('comm-name').value;
            const description = document.getElementById('comm-desc').value;
            const isPublic = document.getElementById('comm-is-public').checked;
            const submitBtn = e.target.querySelector('button[type="submit"]');

            submitBtn.disabled = true;
            submitBtn.innerText = 'Establishing...';

            try {
                const groupCode = Math.random().toString(36).substr(2, 6).toUpperCase();
                const groupRef = await addDoc(collection(db, 'groups'), {
                    name, description, isPublic,
                    joinCode: groupCode,
                    ownerId: user.uid,
                    ownerName: profile.fullName || user.email,
                    memberCount: 1,
                    createdAt: serverTimestamp()
                });

                // Add owner as first member
                const membershipId = `${user.uid}_${groupRef.id}`;
                await setDoc(doc(db, 'group_memberships', membershipId), {
                    id: membershipId, userId: user.uid, groupId: groupRef.id,
                    role: 'owner', joinedAt: Timestamp.now(), userName: profile.fullName || user.email, userEmail: user.email
                });

                document.getElementById('modal-create-community').classList.add('hidden');
                createCommunityForm.reset();
                showToast('Community created successfully!');
            } catch (err) {
                console.error('Comm Create Error:', err);
                showToast('Failed to create community.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Establish Community';
            }
        });
    }

    if (joinCommunityForm) {
        joinCommunityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('comm-join-code').value.trim().toUpperCase();
            const submitBtn = e.target.querySelector('button[type="submit"]');

            submitBtn.disabled = true;
            submitBtn.innerText = 'Searching...';

            try {
                const q = query(collection(db, 'groups'), where('joinCode', '==', code));
                const snap = await getDocs(q);
                if (snap.empty) {
                    showToast('Invalid community code.', 'error');
                    return;
                }
                const group = { id: snap.docs[0].id, ...snap.docs[0].data() };
                
                // Check if already a member
                const memSnap = await getDoc(doc(db, 'group_memberships', `${user.uid}_${group.id}`));
                if (memSnap.exists()) {
                    showToast('You are already a member.');
                    return;
                }

                await requestToJoin(group.id);
                document.getElementById('modal-join-community').classList.add('hidden');
                joinCommunityForm.reset();
            } catch (err) {
                console.error('Join Comm Error:', err);
                showToast('Error joining community.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Request Access';
            }
        });
    }
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 ${type === 'success' ? 'bg-[#0D0D1A]' : 'bg-red-600'} text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-2xl z-[200] animate-in slide-in-from-bottom duration-300`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
