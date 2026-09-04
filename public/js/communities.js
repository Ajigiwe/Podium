// public/js/communities.js
import { auth, db } from './firebase-config.js?v=2';
import { 
    collection, query, where, onSnapshot, addDoc, serverTimestamp, 
    setDoc, doc, updateDoc, getDoc, getDocs, orderBy, increment, deleteDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
let currentProfile = null;
let currentUser = null;

export function initCommunities(user, profile) {
    currentUser = user;
    currentProfile = profile;
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
            btn.className = 'w-full flex items-center justify-between lg:justify-start gap-3 px-4 py-3 rounded-xl text-[13px] font-bold transition-all bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-600 dark:border-indigo-400 shadow-sm shadow-indigo-500/5';
            content.classList.remove('hidden');
        } else {
            btn.className = 'w-full flex items-center justify-between lg:justify-start gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-900/80 hover:text-slate-900 dark:hover:text-white';
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
    const isVerifiedStudent = currentProfile?.role === 'student' && currentProfile?.isVerified === true;
    
    announcementComposer.classList.toggle('hidden', !isOwner);
    resourceComposer.classList.toggle('hidden', !isOwner);
    requestsTabBtn.classList.toggle('hidden', !isOwner);
    
    // Show/Hide Header Grant Lecturer Button
    const headerGrantBtn = document.getElementById('header-grant-lecturer-btn');
    if (headerGrantBtn) {
        headerGrantBtn.classList.toggle('hidden', !(isOwner || isVerifiedStudent));
    }
    
    // Allow either owner or verified student to see members actions (to revoke)
    document.getElementById('members-action-head').classList.toggle('hidden', !(isOwner || isVerifiedStudent));
    
    // Lecturer Management
    const lecturerMgmt = document.getElementById('lecturer-management-section');
    if (lecturerMgmt) {
        lecturerMgmt.classList.toggle('hidden', !(isOwner || isVerifiedStudent));
    }
    
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
            div.className = 'bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all group';
            div.innerHTML = `
                <div class="flex items-center gap-4 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 dark:from-indigo-600 dark:to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-500/10">
                        ${ann.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p class="text-[13px] font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">${ann.authorName}</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-0.5">${ann.createdAt?.toDate().toLocaleDateString('en-GB')}</p>
                    </div>
                </div>
                <p class="text-[13px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed pl-14">${ann.content}</p>
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
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-5 hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all';
            const year = new Date(res.createdAt?.toDate() || Date.now()).getFullYear();
            const isLink = res.type === 'link';
            card.innerHTML = `
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-slate-700">
                            <i class="fas ${isLink ? 'fa-bookmark' : 'fa-book'} text-xs"></i>
                        </div>
                        <div class="min-w-0">
                            <h5 class="text-[14px] font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">${res.title}</h5>
                            <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${isLink ? 'Ref' : 'Doc'} // ${year}</span>
                        </div>
                    </div>
                    ${isLink && res.url ? `<a href="${res.url}" target="_blank" class="shrink-0 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Access →</a>` : ''}
                </div>
                <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${isLink ? 'External Reference' : 'Archived Material'}</span>
                    ${!isLink && res.url ? `<a href="${res.url}" target="_blank" class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Access →</a>` : ''}
                </div>
            `;
            resourcesList.appendChild(card);
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
                ${(isOwner && mem.role !== 'owner') || (currentProfile?.role === 'student' && currentProfile?.isVerified && mem.role === 'lecturer' && mem.grantedBy === currentUser.uid) ? `
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
        progressBar.style.width = '0%';
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch('/api/storage/presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ kind: 'resource', groupId: currentGroup.id, fileName: file.name, size: file.size })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create upload');

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', data.uploadUrl);
                xhr.upload.onprogress = (ev) => {
                    if (ev.lengthComputable) progressBar.style.width = (ev.loaded / ev.total) * 100 + '%';
                };
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve();
                    else reject(new Error(`Upload failed (${xhr.status})`));
                };
                xhr.onerror = () => reject(new Error('Upload failed.'));
                xhr.send(file);
            });

            await addDoc(collection(db, 'groups', currentGroup.id, 'resources'), {
                title: file.name, url: data.url, type: 'file', createdAt: serverTimestamp()
            });
            progressContainer.classList.add('hidden');
        } catch (err) {
            console.error('Upload error:', err);
            window.showToast(err.message || 'Upload failed.', 'error');
        }
    };

    closeWorkspaceBtn.onclick = () => {
        workspaceView.classList.add('hidden');
        document.body.style.overflow = 'auto';
        workspaceUnsubscribes.forEach(unsub => unsub());
    };

    const headerGrantBtn = document.getElementById('header-grant-lecturer-btn');
    if (headerGrantBtn) {
        headerGrantBtn.onclick = () => {
            document.getElementById('modal-grant-lecturer').classList.remove('hidden');
        };
    }

    const grantBtnModal = document.getElementById('grant-lecturer-btn-modal');
    if (grantBtnModal) {
        grantBtnModal.onclick = async () => {
            const emailInput = document.getElementById('grant-lecturer-email-modal');
            const email = emailInput.value.trim();
            if (!email) return;
            
            const btnOriginalText = grantBtnModal.innerText;
            grantBtnModal.innerText = 'Granting...';
            grantBtnModal.disabled = true;
            
            try {
                // Look up lecturer by email
                const q = query(collection(db, 'profiles'), where('email', '==', email), where('role', '==', 'lecturer'));
                const snap = await getDocs(q);
                
                if (snap.empty) {
                    showToast('Lecturer not found or user is not a lecturer.', 'error');
                } else {
                    const lecturerDoc = snap.docs[0];
                    const lecturerId = lecturerDoc.id;
                    const membershipId = `${lecturerId}_${currentGroup.id}`;
                    
                    await setDoc(doc(db, 'group_memberships', membershipId), {
                        id: membershipId,
                        userId: lecturerId,
                        groupId: currentGroup.id,
                        role: 'lecturer',
                        joinedAt: Timestamp.now(),
                        userName: lecturerDoc.data().fullName || email,
                        userEmail: email,
                        grantedBy: currentUser.uid
                    });
                    
                    await updateDoc(doc(db, 'groups', currentGroup.id), {
                        memberCount: increment(1)
                    });
                    
                    showToast('Access granted to lecturer!');
                    emailInput.value = '';
                    document.getElementById('modal-grant-lecturer').classList.add('hidden');
                }
            } catch (err) {
                console.error('Grant Error:', err);
                showToast('Failed to grant access.', 'error');
            } finally {
                grantBtnModal.innerText = btnOriginalText;
                grantBtnModal.disabled = false;
            }
        };
    }

    const grantBtn = document.getElementById('grant-lecturer-btn');
    if (grantBtn) {
        grantBtn.onclick = async () => {
            const emailInput = document.getElementById('grant-lecturer-email');
            const email = emailInput.value.trim();
            if (!email) return;
            
            const btnOriginalText = grantBtn.innerText;
            grantBtn.innerText = 'Granting...';
            grantBtn.disabled = true;
            
            try {
                // Look up lecturer by email
                const q = query(collection(db, 'profiles'), where('email', '==', email), where('role', '==', 'lecturer'));
                const snap = await getDocs(q);
                
                if (snap.empty) {
                    showToast('Lecturer not found or user is not a lecturer.', 'error');
                } else {
                    const lecturerDoc = snap.docs[0];
                    const lecturerId = lecturerDoc.id;
                    const membershipId = `${lecturerId}_${currentGroup.id}`;
                    
                    await setDoc(doc(db, 'group_memberships', membershipId), {
                        id: membershipId,
                        userId: lecturerId,
                        groupId: currentGroup.id,
                        role: 'lecturer',
                        joinedAt: Timestamp.now(),
                        userName: lecturerDoc.data().fullName || email,
                        userEmail: email,
                        grantedBy: currentUser.uid
                    });
                    
                    await updateDoc(doc(db, 'groups', currentGroup.id), {
                        memberCount: increment(1)
                    });
                    
                    showToast('Access granted to lecturer!');
                    emailInput.value = '';
                }
            } catch (err) {
                console.error('Grant Error:', err);
                showToast('Failed to grant access.', 'error');
            } finally {
                grantBtn.innerText = btnOriginalText;
                grantBtn.disabled = false;
            }
        };
    }
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
    showConfirm('Remove this member?', async () => {
        await deleteDoc(doc(db, 'group_memberships', `${userId}_${groupId}`));
        await updateDoc(doc(db, 'groups', groupId), { memberCount: increment(-1) });
    });
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
