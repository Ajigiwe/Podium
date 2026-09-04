// public/js/communities.js
import { auth, db } from './firebase-config.js?v=5';
import { 
    collection, query, where, onSnapshot, addDoc, serverTimestamp, 
    setDoc, doc, updateDoc, getDoc, getDocs, orderBy, increment, deleteDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const myCommunitiesList = document.getElementById('my-communities-list');
const publicCommunitiesList = document.getElementById('public-communities-list');
const workspaceView = document.getElementById('workspace-view');
const closeWorkspaceBtn = document.getElementById('close-workspace');
const wsMobileMenuBtn = document.getElementById('ws-mobile-menu-btn');
const wsCloseMobileMenuBtn = document.getElementById('ws-close-mobile-menu');
const wsSidebarOverlay = document.getElementById('ws-sidebar-overlay');
const wsMobileExitBtn = document.getElementById('ws-mobile-exit-btn');
const wsSidebar = document.getElementById('ws-sidebar');

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

// --- WORKSPACE MOBILE MENU ---
function setWsSidebar(open) {
    if (!wsSidebar) return;
    if (open) {
        wsSidebar.classList.remove('-translate-x-full');
        wsSidebar.classList.add('flex');
        wsSidebar.classList.remove('hidden');
        if (wsSidebarOverlay) wsSidebarOverlay.classList.remove('hidden');
    } else {
        wsSidebar.classList.add('-translate-x-full');
        if (window.innerWidth < 1024) {
            wsSidebar.classList.add('hidden');
            wsSidebar.classList.remove('flex');
        }
        if (wsSidebarOverlay) wsSidebarOverlay.classList.add('hidden');
    }
}

function setWorkspaceHeading(name, code) {
    document.querySelectorAll('.workspace-title').forEach(el => el.innerText = name);
    document.querySelectorAll('.workspace-code').forEach(el => el.innerText = code);
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
            btn.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all bg-[#E8EEFF] text-[#1845D4]';
            content.classList.remove('hidden');
        } else {
            btn.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white';
            content.classList.add('hidden');
        }
    });
    // Close the mobile drawer after picking a tab
    if (window.innerWidth < 1024) setWsSidebar(false);
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
    div.className = 'group bg-white dark:bg-slate-900 border border-[#DDE0F0] dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-[#1845D4] transition-all';
    
    div.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
                <h4 class="font-bold text-[15px] line-clamp-1 text-[#0D0D1A] dark:text-white">${group.name}</h4>
                <span class="shrink-0 text-[10px] font-bold text-[#8888A8]">${group.memberCount || 0} members</span>
            </div>
            <p class="text-[12px] text-[#8888A8] line-clamp-2 leading-relaxed">${group.description}</p>
        </div>
        <button class="w-full mt-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${isMember ? 'bg-[#E8EEFF] text-[#1845D4] hover:bg-[#1845D4] hover:text-white' : 'bg-[#1845D4] text-white hover:bg-[#0F2FA8]'}">
            ${isMember ? 'Enter' : 'Request to Join'}
        </button>
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
    
    setWorkspaceHeading(group.name, `CODE: ${group.joinCode || 'PRIVATE'}`);
    workspaceView.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setWsSidebar(false);
    
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
            div.className = 'bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 transition-all';
            div.innerHTML = `
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-8 h-8 rounded-full bg-[#E8EEFF] dark:bg-slate-800 flex items-center justify-center text-[#1845D4] dark:text-blue-400 font-bold text-xs shrink-0">
                        ${ann.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p class="text-[13px] font-bold text-slate-900 dark:text-white">${ann.authorName}</p>
                        <p class="text-[10px] text-slate-400">${ann.createdAt?.toDate().toLocaleDateString('en-GB')}</p>
                    </div>
                </div>
                <p class="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">${ann.content}</p>
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
            const isDead = res.storageStatus === 'unavailable' || (!res.url && !isLink);
            card.innerHTML = `
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg ${isDead ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400'} flex items-center justify-center border ${isDead ? 'border-slate-200 dark:border-slate-700' : 'border-indigo-100 dark:border-slate-700'}">
                            <i class="fas ${isDead ? 'fa-triangle-exclamation' : (isLink ? 'fa-bookmark' : 'fa-book')} text-xs"></i>
                        </div>
                        <div class="min-w-0">
                            <h5 class="text-[14px] font-semibold ${isDead ? 'text-slate-400 line-clamp-2' : 'text-slate-900 dark:text-white leading-snug line-clamp-2'}">${res.title}</h5>
                            <span class="text-[9px] font-bold uppercase tracking-widest ${isDead ? 'text-red-400' : 'text-slate-400'}">${isDead ? 'File unavailable — re-upload' : `${isLink ? 'Ref' : 'Doc'} // ${year}`}</span>
                        </div>
                    </div>
                    ${!isDead && isLink && res.url ? `<a href="${res.url}" target="_blank" rel="noopener noreferrer" class="shrink-0 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Access →</a>` : ''}
                </div>
                ${!isDead ? `
                <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${isLink ? 'External Reference' : 'Archived Material'}</span>
                    ${!isLink && res.url ? `<a href="${res.url}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Access →</a>` : ''}
                </div>` : ''}
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
                <td class="px-5 py-3.5">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-[#F5F6FA] dark:bg-slate-800 flex items-center justify-center font-bold text-[#8888A8] dark:text-slate-400 uppercase text-[10px]">
                            ${mem.userName.charAt(0)}
                        </div>
                        <div>
                            <p class="text-[13px] font-bold text-[#0D0D1A] dark:text-white">${mem.userName}</p>
                            <p class="text-[10px] text-[#8888A8]">${mem.userEmail || ''}</p>
                        </div>
                    </div>
                </td>
                <td class="px-5 py-3.5">
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${mem.role === 'owner' ? 'bg-[#E8EEFF] text-[#1845D4]' : 'bg-[#F5F6FA] dark:bg-slate-800 text-[#8888A8]'}">
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
                div.className = 'bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#DDE0F0] dark:border-slate-800 flex items-center justify-between gap-3';
                div.innerHTML = `
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-9 h-9 rounded-full bg-[#F5F6FA] dark:bg-slate-800 flex items-center justify-center text-[#8888A8] font-bold text-xs uppercase shrink-0">
                            ${req.userName.charAt(0)}
                        </div>
                        <div class="min-w-0">
                            <p class="text-sm font-bold text-[#0D0D1A] dark:text-white truncate">${req.userName}</p>
                            <p class="text-[11px] text-[#8888A8] truncate">${req.userEmail}</p>
                        </div>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="window.processRequest('${docSnap.id}', 'approved')" class="px-4 py-2 bg-[#1845D4] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider">Approve</button>
                        <button onclick="window.processRequest('${docSnap.id}', 'rejected')" class="px-4 py-2 bg-[#F5F6FA] dark:bg-slate-800 text-[#444460] dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider">Reject</button>
                    </div>
                `;
                requestsContent.appendChild(div);
            });
        }));
    }
}

function createWorkspaceSessionCard(s) {
    const div = document.createElement('div');
    div.className = `bg-white dark:bg-slate-900 border rounded-xl p-6 transition-all ${s.isActive ? 'border-[#1845D4]/40' : 'border-[#DDE0F0] dark:border-slate-800 opacity-75'}`;
    
    div.innerHTML = `
        <div class="flex items-center justify-between gap-3 mb-4">
            <h4 class="text-[15px] font-bold tracking-tight leading-tight text-[#0D0D1A] dark:text-white">${s.title}</h4>
            ${s.isActive ? `<span class="shrink-0 flex items-center gap-1.5 text-red-600 text-[10px] font-bold uppercase tracking-widest">
                <span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> Live
            </span>` : ''}
        </div>
        <p class="text-[11px] font-bold text-[#8888A8] uppercase tracking-widest mb-4">${s.lecturerName}</p>
        <button onclick="window.location.href='/classroom/${s.id}'" class="w-full py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${s.isActive ? 'bg-[#1845D4] text-white hover:bg-[#0F2FA8]' : 'bg-[#F5F6FA] dark:bg-slate-800 text-[#8888A8] cursor-not-allowed'}" ${!s.isActive ? 'disabled' : ''}>
            ${s.isActive ? 'Join Classroom' : 'Waiting to start...'}
        </button>
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

    if (wsMobileExitBtn) wsMobileExitBtn.onclick = () => closeWorkspaceBtn.click();
    if (wsMobileMenuBtn) wsMobileMenuBtn.onclick = () => setWsSidebar(true);
    if (wsCloseMobileMenuBtn) wsCloseMobileMenuBtn.onclick = () => setWsSidebar(false);
    if (wsSidebarOverlay) wsSidebarOverlay.onclick = () => setWsSidebar(false);

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
    toast.className = `fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 ${type === 'success' ? 'bg-[#0D0D1A]' : 'bg-red-600'} text-white text-[11px] font-bold rounded-full shadow-2xl z-[200] animate-in slide-in-from-bottom duration-300`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
