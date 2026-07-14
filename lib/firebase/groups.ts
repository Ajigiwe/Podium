import { db } from './config';
import { 
    collection, 
    doc, 
    setDoc, 
    updateDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    serverTimestamp, 
    increment,
    Timestamp,
    addDoc,
    deleteDoc,
    orderBy,
    writeBatch,
    limit
} from 'firebase/firestore';
import { Group, GroupMembership, GroupRequest } from './types';

/**
 * Create a new group/class
 */
export const createGroup = async (name: string, description: string, ownerId: string, ownerName: string, ownerEmail: string, isPublic: boolean = true, joinCode?: string) => {
    const groupsRef = collection(db, 'groups');
    const newGroupDoc = doc(groupsRef);
    
    const groupData: Group = {
        id: newGroupDoc.id,
        name,
        description,
        ownerId,
        ownerName,
        ownerEmail,
        isPublic,
        joinCode: joinCode || null as any,
        memberCount: 1,
        createdAt: Timestamp.now(),
    };
    
    const batch = writeBatch(db);
    batch.set(newGroupDoc, groupData);

    const membershipRef = doc(db, 'group_memberships', `${ownerId}_${newGroupDoc.id}`);
    const membershipData: GroupMembership = {
        id: `${ownerId}_${newGroupDoc.id}`,
        userId: ownerId,
        groupId: newGroupDoc.id,
        role: 'owner',
        joinedAt: Timestamp.now(),
        userName: ownerName
    };

    batch.set(membershipRef, membershipData);
    await batch.commit();
    return newGroupDoc.id;
};

/**
 * Find a group by its secret join code
 */
export const findGroupByCode = async (code: string) => {
    const q = query(collection(db, 'groups'), where('joinCode', '==', code.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Group;
};

/**
 * Request to join a group
 */
export const requestToJoinGroup = async (groupId: string, userId: string, userName: string, userEmail: string) => {
    const requestsRef = collection(db, 'group_requests');
    const q = query(requestsRef, where('groupId', '==', groupId), where('userId', '==', userId), where('status', '==', 'pending'));
    const existing = await getDocs(q);
    
    if (!existing.empty) throw new Error('Request already pending');
    
    const requestData: Omit<GroupRequest, 'id'> = {
        groupId,
        userId,
        userName,
        userEmail,
        status: 'pending',
        createdAt: Timestamp.now()
    };
    
    await addDoc(requestsRef, requestData);
};

/**
 * Handle join request (Approve/Reject)
 */
export const handleJoinRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    const requestRef = doc(db, 'group_requests', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) throw new Error('Request not found');
    const request = requestSnap.data() as GroupRequest;
    
    if (status === 'approved') {
        const membershipId = `${request.userId}_${request.groupId}`;
        const membershipRef = doc(db, 'group_memberships', membershipId);
        
        const membershipData: GroupMembership = {
            id: membershipId,
            userId: request.userId,
            groupId: request.groupId,
            role: 'student',
            joinedAt: Timestamp.now(),
            userName: request.userName,
            userEmail: request.userEmail
        };
        
        const batch = writeBatch(db);
        batch.set(membershipRef, membershipData);
        batch.update(doc(db, 'groups', request.groupId), { memberCount: increment(1) });
        batch.update(requestRef, { status, updatedAt: serverTimestamp() });
        await batch.commit();
        return;
    }
    
    await updateDoc(requestRef, { status, updatedAt: serverTimestamp() });
};

/**
 * Check if a user is a member of a group
 */
export const checkGroupMembership = async (groupId: string, userId: string) => {
    const membershipRef = doc(db, 'group_memberships', `${userId}_${groupId}`);
    const snap = await getDoc(membershipRef);
    return snap.exists() ? (snap.data() as GroupMembership) : null;
};

/**
 * Get all members of a group
 */
export const getGroupMembers = async (groupId: string) => {
    const q = query(collection(db, 'group_memberships'), where('groupId', '==', groupId), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as GroupMembership);
};

/**
 * Remove a member from a group
 */
export const removeMember = async (groupId: string, userId: string) => {
    const batch = writeBatch(db);
    const membershipRef = doc(db, 'group_memberships', `${userId}_${groupId}`);
    batch.delete(membershipRef);
    batch.update(doc(db, 'groups', groupId), { memberCount: increment(-1) });
    await batch.commit();
};

/**
 * Post an announcement to a group
 */
export const postAnnouncement = async (groupId: string, content: string, authorId: string, authorName: string) => {
    const announcementsRef = collection(db, 'groups', groupId, 'announcements');
    await addDoc(announcementsRef, {
        content,
        authorId,
        authorName,
        createdAt: Timestamp.now()
    });
};

/**
 * Get announcements for a group
 */
export const getAnnouncements = async (groupId: string) => {
    const q = query(collection(db, 'groups', groupId, 'announcements'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Add a resource to a group
 */
export const addResource = async (groupId: string, title: string, url: string, type: string) => {
    const resourcesRef = collection(db, 'groups', groupId, 'resources');
    await addDoc(resourcesRef, {
        title,
        url,
        type,
        createdAt: Timestamp.now()
    });
};

/**
 * Get resources for a group
 */
export const getResources = async (groupId: string) => {
    const q = query(collection(db, 'groups', groupId, 'resources'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Get all member emails for a group
 */
export const getGroupMemberEmails = async (groupId: string): Promise<string[]> => {
    const q = query(collection(db, 'group_memberships'), where('groupId', '==', groupId), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data().userEmail).filter(Boolean);
};
