import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, query, where, onSnapshot, doc, getDoc, updateDoc, getDocs, addDoc, Timestamp, serverTimestamp, setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initCommunities } from './communities.js';

// DOM Elements
const sidebarLinks = {
    records: document.getElementById('nav-records'),
    communities: document.getElementById('nav-communities'),
    attendance: document.getElementById('nav-attendance')
};
const contentSections = {
    records: document.getElementById('content-records'),
    communities: document.getElementById('content-communities'),
    attendance: document.getElementById('content-attendance')
};

const userName = document.getElementById('user-name');
const userRole = document.getElementById('user-role');
const userAvatar = document.getElementById('user-avatar');
const enrolledCount = document.getElementById('enrolled-count');
const hostedCount = document.getElementById('hosted-count');
const recordsList = document.getElementById('records-list');
const todayDate = document.getElementById('today-date');

// State
let activeWorkspace = 'records';
let activeRecordTab = 'join';
let currentUserId = null;
let userProfile = null;
let enrolledSessionsData = [];
let hostedSessionsData = [];

// Initialize Date
todayDate.innerText = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Auth Listener
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = './auth/login.html';
        return;
    }
    currentUserId = user.uid;
    
    // Fetch Profile
    const profileSnap = await getDoc(doc(db, 'profiles', user.uid));
    userProfile = profileSnap.data() || {};
    
    // Update UI
    userName.innerText = userProfile.fullName?.split(' ')[0] || user.email.split('@')[0];
    userRole.innerText = userProfile.role || 'Student';
    if (userProfile.photoURL) {
        userAvatar.innerHTML = `<img src="${userProfile.photoURL}" class="w-full h-full object-cover">`;
    } else {
        userAvatar.innerText = (userProfile.fullName || 'U').charAt(0).toUpperCase();
    }

    // Start Listeners
    setLoading(true);
    setupHostedSessions();
    setupEnrolledSessions();
    if (typeof initCommunities === 'function') initCommunities(user, userProfile);
    setupGroupOptions();
    setTimeout(() => setLoading(false), 800);

    // Show admin nav section if admin
    if (userProfile.role === 'admin' || userProfile.role === 'lecturer' || userProfile.role === 'rep' || userProfile.isVerified) {
        const adminSection = document.getElementById('admin-nav-section');
        if (adminSection && userProfile.role === 'admin') adminSection.classList.remove('hidden');
        
        const attendanceNav = document.getElementById('nav-attendance');
        if (attendanceNav) attendanceNav.classList.remove('hidden');
    } else {
        const attendanceNav = document.getElementById('nav-attendance');
        if (attendanceNav) attendanceNav.classList.add('hidden');
    }
    
    console.log('[Dashboard] Initialized for:', user.email);
});

// UI Helpers
const loadingBar = document.getElementById('top-loading-bar');
function setLoading(isLoading) {
    if (!loadingBar) return;
    loadingBar.style.width = isLoading ? '30%' : '100%';
    if (!isLoading) setTimeout(() => loadingBar.style.width = '0%', 400);
}

// Sidebar Logic
window.switchTab = (tab) => {
    activeWorkspace = tab;
    Object.keys(sidebarLinks).forEach(key => {
        const link = sidebarLinks[key];
        const section = contentSections[key];
        if (!link || !section) return;

        if (key === tab) {
            link.classList.add('sidebar-active');
            link.classList.remove('text-[#444460]', 'dark:text-slate-400', 'hover:bg-[#F5F6FA]', 'dark:hover:bg-slate-800', 'hover:text-[#0D0D1A]', 'dark:hover:text-white');
            section.classList.remove('hidden');
        } else {
            link.classList.remove('sidebar-active');
            link.classList.add('text-[#444460]', 'dark:text-slate-400', 'hover:bg-[#F5F6FA]', 'dark:hover:bg-slate-800', 'hover:text-[#0D0D1A]', 'dark:hover:text-white');
            section.classList.add('hidden');
        }
    });
};

// Record Tabs Logic
window.switchRecordTab = (tab) => {
    activeRecordTab = tab;
    const tabJoin = document.getElementById('tab-join');
    const tabHost = document.getElementById('tab-host');
    
    if (tab === 'join') {
        if (tabJoin) tabJoin.className = 'text-[12px] font-bold transition-all text-[#1845D4] dark:text-blue-400';
        if (tabHost) tabHost.className = 'text-[12px] font-bold transition-all text-[#8888A8] hover:text-[#0D0D1A] dark:hover:text-white';
    } else {
        if (tabHost) tabHost.className = 'text-[12px] font-bold transition-all text-[#1845D4] dark:text-blue-400';
        if (tabJoin) tabJoin.className = 'text-[12px] font-bold transition-all text-[#8888A8] hover:text-[#0D0D1A] dark:hover:text-white';
    }
    renderRecords();
};

// Drawer Logic
const drawer = document.getElementById('records-drawer');
const drawerBackdrop = document.getElementById('records-drawer-backdrop');
const drawerTitle = document.getElementById('drawer-title');
const drawerSubtitle = document.getElementById('drawer-subtitle');

window.openRecordsDrawer = (tab) => {
    activeRecordTab = tab;
    drawerTitle.innerText = tab === 'join' ? 'Classes Joined' : 'Classes Hosted';
    drawerSubtitle.innerText = tab === 'join' ? 'Your enrolled sessions' : 'Your teaching sessions';
    drawer.classList.remove('translate-x-full');
    drawerBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderRecords();
};

window.closeRecordsDrawer = () => {
    drawer.classList.add('translate-x-full');
    drawerBackdrop.classList.add('hidden');
    document.body.style.overflow = 'auto';
};


// Listeners
function setupHostedSessions() {
    const q = query(collection(db, 'sessions'), where('lecturerId', '==', currentUserId));
    onSnapshot(q, (snapshot) => {
        hostedSessionsData = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }));
        hostedCount.innerText = hostedSessionsData.length;
        renderRecords();
        renderQuickAccess();
    }, (err) => console.error('[HostedSessions] Error:', err));
}

function setupEnrolledSessions() {
    const qTx = query(collection(db, 'transactions'), where('userId', '==', currentUserId), where('isHidden', '==', false));
    onSnapshot(qTx, async (snapshot) => {
        if (snapshot.empty) {
            enrolledSessionsData = [];
            enrolledCount.innerText = '0';
            renderRecords();
            return;
        }

        const sessionIds = Array.from(new Set(snapshot.docs.map(d => d.data().sessionId)));
        const sessionSnaps = await Promise.all(sessionIds.map(id => getDoc(doc(db, 'sessions', id))));
        
        enrolledSessionsData = sessionSnaps
            .filter(s => s.exists())
            .map(s => ({ id: s.id, ...s.data() }));
            
        enrolledCount.innerText = enrolledSessionsData.length;
        renderRecords();
        renderQuickAccess();
    }, (err) => console.error('[EnrolledSessions] Error:', err));
}

function renderQuickAccess() {
    const quickSection = document.getElementById('quick-access-section');
    const quickList = document.getElementById('quick-access-list');
    if (!quickSection || !quickList) return;

    // Combine and prioritize: 1. Live sessions, 2. Most recent
    const combined = [
        ...enrolledSessionsData.map(s => ({ ...s, _type: 'join' })),
        ...hostedSessionsData.map(s => ({ ...s, _type: 'host' }))
    ].filter(s => !s.isDeleted)
    .sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt instanceof Date ? a.createdAt.getTime() : (typeof a.createdAt === 'number' ? a.createdAt : 0));
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt instanceof Date ? b.createdAt.getTime() : (typeof b.createdAt === 'number' ? b.createdAt : 0));
        return timeB - timeA;
    });

    const displayData = combined.slice(0, 4);

    if (displayData.length === 0) {
        quickSection.classList.add('hidden');
        return;
    }

    quickSection.classList.remove('hidden');
    quickList.innerHTML = '';

    displayData.forEach(session => {
        const div = document.createElement('div');
        div.className = 'group bg-white dark:bg-slate-900 border border-[#DDE0F0] dark:border-slate-800 rounded-lg p-5 flex items-center justify-between hover:border-[#1845D4] transition-all cursor-pointer';
        
        const isHost = session._type === 'host';
        const isActive = session.isActive;

        div.onclick = () => {
            if (isHost) window.location.href = `/classroom/${session.id}`;
            else window.openJoinPreview(session);
        };

        div.innerHTML = `
            <div class="flex items-center gap-4 flex-1 min-w-0">
                <div class="w-10 h-10 rounded-lg ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-[#1845D4] dark:text-blue-400' : 'bg-[#F5F6FA] dark:bg-slate-800 text-[#8888A8]'} flex items-center justify-center flex-shrink-0 transition-all group-hover:bg-[#1845D4] group-hover:text-white">
                    <i class="fas ${isActive ? 'fa-video animate-pulse' : 'fa-graduation-cap'} text-sm"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-[14px] font-bold text-[#0D0D1A] dark:text-white truncate group-hover:text-[#1845D4] transition-colors">${session.title}</h4>
                    <p class="text-[10px] font-bold text-[#8888A8] uppercase tracking-widest mt-0.5">${isHost ? 'Owner' : (session.lecturerName || 'Faculty')}</p>
                </div>
            </div>
            <div class="ml-4">
                ${isActive ? `
                    <span class="px-2 py-1 bg-[#1845D4] text-white text-[8px] font-black uppercase tracking-[0.2em] rounded shadow-lg shadow-blue-600/20">Live</span>
                ` : `
                    <i class="fas fa-chevron-right text-[#DDE0F0] group-hover:text-[#1845D4] transition-all"></i>
                `}
            </div>
        `;
        quickList.appendChild(div);
    });
}

function renderRecords() {
    // Only render if drawer is open
    const drawer = document.getElementById('records-drawer');
    if (drawer.classList.contains('translate-x-full')) return;

    const raw = activeRecordTab === 'join' ? enrolledSessionsData : hostedSessionsData;
    const data = [...raw].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    recordsList.innerHTML = '';

    if (data.length === 0) {
        recordsList.innerHTML = `<div class="py-20 text-center"><p class="text-[11px] font-bold text-[#8888A8] uppercase tracking-[0.4em] italic">No records found.</p></div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    data.forEach((session, index) => {
        const item = createRecordItem(session, activeRecordTab === 'host');
        item.classList.add('animate-fade-in');
        item.style.animationDelay = `${index * 0.05}s`;
        fragment.appendChild(item);
    });
    recordsList.appendChild(fragment);
}

function createRecordItem(session, isHost) {
    const div = document.createElement('div');
    div.className = `flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-5 sm:py-4 hover:bg-[#F5F6FA] transition-all group border-b border-[#F5F6FA] sm:border-none ${!isHost ? 'cursor-pointer' : ''}`;
    
    const isActive = session.isActive;
    const dotColor = isActive ? 'bg-[#1845D4] animate-pulse' : 'bg-[#DDE0F0]';
    
    if (!isHost) {
        div.onclick = () => window.openJoinPreview(session);
    }

    div.innerHTML = `
        <div class="flex items-center gap-4 flex-1 min-w-0">
            <div class="w-2 h-2 rounded-full flex-shrink-0 ${dotColor}"></div>
            <div class="flex-1 min-w-0">
                <div class="text-[14px] font-medium text-[#0D0D1A] dark:text-white group-hover:text-[#1845D4] transition-colors truncate">
                    ${session.title}
                    ${session.isDeleted ? '<span class="ml-2 text-[8px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded border border-red-100 uppercase font-black">Deleted</span>' : ''}
                </div>
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                    <span class="text-[10px] font-bold text-[#8888A8] uppercase tracking-widest bg-[#F5F6FA] px-2 py-0.5 rounded whitespace-nowrap">${session.meetingCode || 'NO CODE'}</span>
                    <span class="text-[11px] text-[#8888A8] truncate">· ${session.course || session.lecturerName || 'General'}</span>
                </div>
            </div>
        </div>
        <div class="flex items-center gap-2 sm:flex-shrink-0">
            ${isHost ? `
                <button onclick="window.copyCode('${session.meetingCode}', event)" class="p-2 text-[#8888A8] hover:text-[#1845D4] transition-colors flex-shrink-0"><i class="fas fa-copy"></i></button>
                ${!session.isDeleted ? `
                    <a href="/classroom/${session.id}" class="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-900 border border-[#DDE0F0] dark:border-slate-800 text-[#0D0D1A] dark:text-white text-[10px] font-bold uppercase tracking-widest rounded hover:border-[#1845D4] transition-all whitespace-nowrap text-center">Control</a>
                    <button onclick="window.toggleLive('${session.id}', ${isActive}, event)" class="flex-1 sm:flex-none px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${isActive ? 'bg-[#1845D4] text-white shadow-lg shadow-blue-600/10' : 'bg-[#F5F6FA] text-[#8888A8] hover:bg-[#E8EEFF]'}">
                        ${isActive ? 'Live' : 'Go Live'}
                    </button>
                    <button onclick="window.deleteSession('${session.id}', event)" class="p-2 text-[#DDE0F0] hover:text-red-600 transition-colors flex-shrink-0"><i class="fas fa-trash-alt"></i></button>
                ` : `
                    <span class="px-4 py-2 text-[#8888A8] text-[9px] font-bold uppercase tracking-widest italic">Archived</span>
                `}
            ` : `
                <span class="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest ${isActive ? 'bg-blue-50 text-[#1845D4]' : 'bg-[#F5F6FA] text-[#8888A8]'}">
                    ${isActive ? 'Live' : 'Active'}
                </span>
                <i class="fas fa-chevron-right text-[#DDE0F0] group-hover:text-[#1845D4] transition-all"></i>
            `}
        </div>
    `;
    return div;
}

// Global Actions
window.copyCode = (code, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(code);
    showToast('Meeting code copied!');
};

window.toggleLive = async (id, current, e) => {
    if (e) e.stopPropagation();
    try {
        const nextState = !current;
        await updateDoc(doc(db, 'sessions', id), { isActive: nextState });
        
        // Notification Logic (Optional Parity)
        if (nextState) {
            const snap = await getDoc(doc(db, 'sessions', id));
            const session = snap.data();
            if (session.groupId) {
                // Fetch emails and notify...
            }
        }
    } catch (err) {
        showToast('Failed to toggle live state.', 'error');
    }
};

window.deleteSession = async (id, e) => {
    if (e) e.stopPropagation();
    if (confirm('Purge this session?')) {
        await updateDoc(doc(db, 'sessions', id), { isDeleted: true });
        showToast('Deleted successfully.');
    }
};

// Create Modal Logic
const createModal = document.getElementById('modal-create-class');
const createForm = document.getElementById('create-class-form');
const groupSelect = document.getElementById('class-group-id');
const groupContainer = document.getElementById('group-link-container');

// Modal Helpers
window.openModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
    else console.warn(`[Modal] Element not found: ${id}`);
};

const openCreateBtn = document.getElementById('open-create-modal');
const openCreateCardBtn = document.getElementById('open-create-modal-card');

if (openCreateBtn) openCreateBtn.onclick = () => openModal('modal-create-class');
if (openCreateCardBtn) openCreateCardBtn.onclick = () => openModal('modal-create-class');

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        const modals = ['modal-create-class', 'modal-join-preview', 'modal-create-community', 'modal-join-community'];
        modals.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    });
});

async function setupGroupOptions() {
    const q = query(collection(db, 'groups'), where('ownerId', '==', currentUserId));
    const snap = await getDocs(q);
    if (!snap.empty) {
        groupContainer.style.display = 'block';
        snap.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.innerText = d.data().name;
            groupSelect.appendChild(opt);
        });
    }
}

if (createForm) {
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('class-title').value;
        const course = document.getElementById('class-course').value;
        const program = document.getElementById('class-program').value;
        const durationMinutes = parseInt(document.getElementById('class-duration').value) || 60;
        const verificationCount = parseInt(document.getElementById('class-checks').value) || 3;
        const groupId = groupSelect.value;
        const submitBtn = createForm.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.innerText = 'Creating...';

        try {
            const sessionRef = doc(collection(db, 'sessions'));
            const code = `pod-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}`;
            
            await setDoc(sessionRef, {
                id: sessionRef.id,
                title,
                course,
                program,
                durationMinutes,
                verificationCount,
                groupId: groupId || null,
                lecturerId: currentUserId,
                lecturerName: userProfile.fullName || 'Faculty',
                isActive: false,
                status: 'active',
                meetingCode: code,
                createdAt: serverTimestamp()
            });
            
            createModal.classList.add('hidden');
            createForm.reset();
            showToast('Class created successfully!');
        } catch (err) {
            console.error('Create Error:', err);
            showToast('Failed to create class.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Create class';
        }
    });
}

// Join Logic
const joinForm = document.getElementById('join-form');
const joinPreviewModal = document.getElementById('modal-join-preview');
const joinTitle = document.getElementById('join-preview-title');
const joinFaculty = document.getElementById('join-preview-faculty');
const confirmJoinBtn = document.getElementById('confirm-join');
let pendingSessionId = null;

joinForm.onsubmit = async (e) => {
    e.preventDefault();
    const code = document.getElementById('join-link').value.trim();
    if (!code) return;

    try {
        const q = query(collection(db, 'sessions'), where('meetingCode', '==', code.toLowerCase()));
        const snap = await getDocs(q);
        if (snap.empty) {
            showToast('Invalid meeting code.', 'error');
            return;
        }
        const session = { id: snap.docs[0].id, ...snap.docs[0].data() };
        window.openJoinPreview(session);
    } catch (err) {
        showToast('Error searching for class.', 'error');
    }
};

window.openJoinPreview = (session) => {
    pendingSessionId = session.id;
    joinTitle.innerText = session.title;
    joinFaculty.innerText = session.lecturerName || 'Faculty Member';
    joinPreviewModal.classList.remove('hidden');
};

confirmJoinBtn.onclick = async () => {
    if (!pendingSessionId) return;
    confirmJoinBtn.disabled = true;
    confirmJoinBtn.innerText = 'Processing...';

    try {
        // Enroll Logic
        const qTx = query(collection(db, 'transactions'), where('userId', '==', currentUserId), where('sessionId', '==', pendingSessionId));
        const snap = await getDocs(qTx);
        
        if (snap.empty) {
            await addDoc(collection(db, 'transactions'), {
                userId: currentUserId,
                sessionId: pendingSessionId,
                amount: 0,
                status: 'succeeded',
                email: auth.currentUser.email,
                isHidden: false,
                createdAt: serverTimestamp()
            });
        } else if (snap.docs[0].data().isHidden) {
            await updateDoc(snap.docs[0].ref, { isHidden: false });
        }
        
        window.location.href = `/classroom/${pendingSessionId}`;
    } catch (err) {
        showToast('Enrollment failed.', 'error');
        confirmJoinBtn.disabled = false;
        confirmJoinBtn.innerText = 'Enter Classroom';
    }
};

// Communities UI Connectors
const openCreateCommBtn = document.getElementById('open-create-community-modal');
const openJoinCommBtn = document.getElementById('open-join-community-modal');

if (openCreateCommBtn) openCreateCommBtn.onclick = () => openModal('modal-create-community');
if (openJoinCommBtn) openJoinCommBtn.onclick = () => openModal('modal-join-community');

// Toast Helper
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

// Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));
window.logout = () => signOut(auth);
