'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    getDocs,
    orderBy,
    query,
    limit,
    startAfter,
    getCountFromServer,
    where,
    writeBatch
} from 'firebase/firestore';
import { SystemSettings, UserProfile, AttendanceLog } from '@/lib/firebase/types';
import { ArrowUpDown, ArrowUp, ArrowDown, Settings, Save, AlertCircle, Users, Search, Shield, GraduationCap, User, Trash2, UserX, UserCheck, MoreVertical, RefreshCw } from 'lucide-react';
import StudentHistoryModal from './components/StudentHistoryModal';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState<'settings' | 'users'>('settings');

    // Settings State
    const [fee, setFee] = useState<number>(200);
    const [isPayToUse, setIsPayToUse] = useState<boolean>(true); // Default to true
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Users State
    const [users, setUsers] = useState<(UserProfile & { classCount?: number })[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [totalUsers, setTotalUsers] = useState(0);
    const [globalStats, setGlobalStats] = useState({ total: 0, students: 0, lecturers: 0, admins: 0 });

    // Pagination State
    const PAGE_SIZE = 100;
    const [lastDocs, setLastDocs] = useState<(any)[]>([null]); // Array of cursors
    const [page, setPage] = useState(0);
    const [isLastPage, setIsLastPage] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // History Modal State
    const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

    // Management State
    const [managingUser, setManagingUser] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
    const [processingAction, setProcessingAction] = useState<string | null>(null);

    // Fetch Settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'system_settings', 'subscription');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as SystemSettings;
                    setFee(data.semesterFee);
                    // If isPayToUse is undefined, assume true (legacy)
                    setIsPayToUse(data.isPayToUse !== undefined ? data.isPayToUse : true);
                } else {
                    // Create default if not exists
                    await setDoc(docRef, {
                        id: 'subscription',
                        semesterFee: 200,
                        currency: 'GHS',
                        durationMonths: 4,
                        isPayToUse: true,
                        updatedAt: serverTimestamp()
                    });
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
                setMessage({ type: 'error', text: 'Failed to load settings.' });
            } finally {
                setLoadingSettings(false);
            }
        };

        fetchSettings();
    }, []);

    // Fetch Users when tab changes or page changes
    useEffect(() => {
        if (activeTab === 'users') {
            const fetchUsers = async () => {
                setLoadingUsers(true);
                try {
                    const usersRef = collection(db, 'profiles');

                    // Base query
                    let q = query(
                        usersRef,
                        orderBy('createdAt', 'desc'),
                        limit(PAGE_SIZE + 1) // Fetch one extra to check if there is a next page
                    );

                    // Apply pagination cursor
                    if (lastDocs[page]) {
                        q = query(
                            usersRef,
                            orderBy('createdAt', 'desc'),
                            startAfter(lastDocs[page]),
                            limit(PAGE_SIZE + 1)
                        );
                    }

                    const userSnapshot = await getDocs(q);

                    const docs = userSnapshot.docs;
                    const hasNext = docs.length > PAGE_SIZE;
                    setIsLastPage(!hasNext);

                    // Slice to batch size
                    const batchDocs = hasNext ? docs.slice(0, PAGE_SIZE) : docs;

                    const fetchedUsers = batchDocs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        classCount: doc.data().classCount || 0
                    } as (UserProfile & { classCount: number })));

                    setUsers(fetchedUsers);

                    // Update cursor for next page if we haven't already
                    if (hasNext && !lastDocs[page + 1]) {
                        const newLastDocs = [...lastDocs];
                        newLastDocs[page + 1] = docs[PAGE_SIZE - 1];
                        setLastDocs(newLastDocs);
                    }

                } catch (error) {
                    console.error('Error fetching users:', error);
                } finally {
                    setLoadingUsers(false);
                }
            };
            if (!isSearching) {
                fetchUsers();
            }
        }
    }, [activeTab, page, isSearching]);

    // Global Search Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchTerm.length >= 3) {
                setIsSearching(true);
                setLoadingUsers(true);
                try {
                    const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(searchTerm)}`);
                    const data = await res.json();
                    if (data.users) {
                        setSearchResults(data.users);
                    }
                } catch (error) {
                    console.error('Global search error:', error);
                } finally {
                    setLoadingUsers(false);
                }
            } else {
                setIsSearching(false);
                setSearchResults([]);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch Global Stats independently
    useEffect(() => {
        if (activeTab === 'users') {
            const fetchGlobalStats = async () => {
                try {
                    const usersRef = collection(db, 'profiles');

                    const [totalSnap, studentSnap, lecturerSnap, adminSnap] = await Promise.all([
                        getCountFromServer(query(usersRef)),
                        getCountFromServer(query(usersRef, where('role', '==', 'student'))),
                        getCountFromServer(query(usersRef, where('role', '==', 'lecturer'))),
                        getCountFromServer(query(usersRef, where('role', '==', 'admin')))
                    ]);

                    setGlobalStats({
                        total: totalSnap.data().count,
                        students: studentSnap.data().count,
                        lecturers: lecturerSnap.data().count,
                        admins: adminSnap.data().count
                    });
                } catch (error) {
                    console.error('Error fetching global stats:', error);
                }
            };
            fetchGlobalStats();
        }
    }, [activeTab]); // Removed users.length check to allow re-fetching on page change

    const recalculateClassCounts = async () => {
        if (!confirm('This will scan all attendance logs to update student class counts. Continue?')) return;
        setLoadingUsers(true);
        setMessage({ type: 'success', text: 'Fetching attendance logs...' });

        try {
            // 1. Fetch all attendance logs
            const logsRef = collection(db, 'attendance_logs');
            const logsSnapshot = await getDocs(logsRef);
            const logs = logsSnapshot.docs.map(doc => doc.data() as AttendanceLog);

            // 2. Aggregate counts per user
            const counts: Record<string, Set<string>> = {};
            logs.forEach(log => {
                if (log.userId) {
                    if (!counts[log.userId]) counts[log.userId] = new Set();
                    counts[log.userId].add(log.sessionId);
                }
            });

            const userIds = Object.keys(counts);
            const totalToUpdate = userIds.length;
            setMessage({ type: 'success', text: `Preparing updates for ${totalToUpdate} students...` });

            // 3. Update profiles in batches of 500 (Firestore limit)
            const BATCH_SIZE = 500;
            let processed = 0;

            for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = userIds.slice(i, i + BATCH_SIZE);

                chunk.forEach(userId => {
                    const profileRef = doc(db, 'profiles', userId);
                    batch.set(profileRef, { classCount: counts[userId].size }, { merge: true });
                });

                await batch.commit();
                processed += chunk.length;
                setMessage({ type: 'success', text: `Updated ${processed}/${totalToUpdate} student profiles...` });
            }

            // 4. Reset local users state to trigger re-fetch
            setUsers([]);
            setMessage({ type: 'success', text: 'Class counts recalculated successfully!' });
        } catch (error) {
            console.error('Recalculation error:', error);
            setMessage({ type: 'error', text: 'Recalculation failed.' });
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const docRef = doc(db, 'system_settings', 'subscription');
            await setDoc(docRef, {
                semesterFee: Number(fee),
                isPayToUse: isPayToUse,
                updatedAt: serverTimestamp()
            }, { merge: true });

            setMessage({ type: 'success', text: 'Semester fee updated successfully.' });
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage({ type: 'error', text: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    const handleUserAction = async (userId: string, action: 'role' | 'disable' | 'enable' | 'delete', data?: any) => {
        // Immediate UI feedback
        setManagingUser(null);
        if (action !== 'delete') {
            setProcessingAction(userId);
        }

        // Snapshot for rollback
        const previousUsers = [...users];

        // Optimistic Update
        if (action === 'delete') {
            setUsers(prev => prev.filter(u => u.id !== userId));
            setConfirmDelete(null);
        } else {
            setUsers(prev => prev.map(u => {
                if (u.id === userId) {
                    const updated = { ...u };
                    if (action === 'role') updated.role = data;
                    if (action === 'disable') (updated as any).status = 'disabled';
                    if (action === 'enable') (updated as any).status = 'active';
                    return updated;
                }
                return u;
            }));
        }

        try {
            let res;
            if (action === 'delete') {
                res = await fetch('/api/admin/users', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
            } else {
                const body: any = { userId };
                if (action === 'role') body.role = data;
                if (action === 'disable') body.disabled = true;
                if (action === 'enable') body.disabled = false;

                res = await fetch('/api/admin/users', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }

            const result = await res.json();
            if (!result.success) {
                // Rollback on failure
                setUsers(previousUsers);
                setMessage({ type: 'error', text: result.error || 'Action failed' });
            } else {
                // Success - Message is optional since UI already updated
                if (action === 'delete') {
                    setMessage({ type: 'success', text: result.message });
                }
            }
        } catch (error) {
            console.error('Error performing user action:', error);
            // Rollback on error
            setUsers(previousUsers);
            setMessage({ type: 'error', text: 'An unexpected error occurred' });
        } finally {
            setProcessingAction(null);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filter and Sort Users
    const usersToProcess = isSearching ? searchResults : users;
    const processedUsers = [...usersToProcess]
        .filter(user => {
            if (isSearching) return true; // Already filtered by server
            return user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchTerm.toLowerCase());
        })
        .sort((a, b) => {
            if (!sortConfig) return 0;

            const { key, direction } = sortConfig;
            let aValue: any = a[key as keyof typeof a];
            let bValue: any = b[key as keyof typeof b];

            // Handle nested or special cases
            if (key === 'createdAt') {
                aValue = a.createdAt?.seconds || 0;
                bValue = b.createdAt?.seconds || 0;
            }

            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const stats = globalStats;

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
        return sortConfig.direction === 'asc' ? (
            <ArrowUp className="w-4 h-4 text-blue-600" />
        ) : (
            <ArrowDown className="w-4 h-4 text-blue-600" />
        );
    };

    if (loadingSettings) {
        return (
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-64" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-24 w-full rounded-xl" />
                    ))}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-96">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <Skeleton className="h-6 w-32" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>

                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'settings'
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                    >
                        Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'users'
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                    >
                        User Management
                    </button>
                </div>
            </div>

            {activeTab === 'settings' ? (
                <div className="max-w-2xl bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <Settings className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Subscription Configuration</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Set the global fee for student access.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        <form onSubmit={handleSave} className="space-y-6">
                            {/* Pay-to-Use Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Enable Pay-to-Use</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        If disabled, the system is in "Testing Mode" (Free for all students).
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPayToUse}
                                        onChange={(e) => setIsPayToUse(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Semester Fee (GHS)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">GH₵</span>
                                    <input
                                        type="number"
                                        value={fee}
                                        onChange={(e) => setFee(Number(e.target.value))}
                                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                        min="0"
                                        step="1"
                                        required
                                    />
                                </div>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Payment grants 4 months of access to all classes.
                                </p>
                            </div>

                            {message && (
                                <div className={`p-4 rounded-lg flex items-center gap-2 text-sm font-medium ${message.type === 'success'
                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                    }`}>
                                    {message.type === 'success' ? (
                                        <Save className="w-4 h-4" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4" />
                                    )}
                                    {message.text}
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                            <p className="text-sm font-medium text-gray-500">Total Users</p>
                            <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{stats.total}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                            <p className="text-sm font-medium text-blue-600">Students</p>
                            <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{stats.students}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                            <p className="text-sm font-medium text-purple-600">Lecturers</p>
                            <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{stats.lecturers}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                            <p className="text-sm font-medium text-red-600">Admins</p>
                            <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{stats.admins}</p>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    Registered Users
                                </h2>
                                <button
                                    onClick={recalculateClassCounts}
                                    title="Recalculate class counts from logs"
                                    className="p-1 px-2 text-[10px] uppercase font-bold tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-600 rounded transition-colors flex items-center gap-1 border border-gray-200 dark:border-gray-700"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Sync Counts
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full sm:w-64"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto min-h-[300px] pb-32">
                            {loadingUsers ? (
                                <div className="p-6 space-y-4">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="flex gap-4">
                                            <Skeleton className="h-12 w-12 rounded-full" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-1/4" />
                                                <Skeleton className="h-3 w-1/2" />
                                            </div>
                                            <Skeleton className="h-10 w-24" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                                        <tr>
                                            <th
                                                className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                onClick={() => handleSort('fullName')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    User
                                                    <SortIcon columnKey="fullName" />
                                                </div>
                                            </th>
                                            <th
                                                className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                onClick={() => handleSort('role')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Role
                                                    <SortIcon columnKey="role" />
                                                </div>
                                            </th>
                                            <th
                                                className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                onClick={() => handleSort('classCount')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Classes Joined
                                                    <SortIcon columnKey="classCount" />
                                                </div>
                                            </th>
                                            <th
                                                className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                onClick={() => handleSort('createdAt')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    Joined At
                                                    <SortIcon columnKey="createdAt" />
                                                </div>
                                            </th>
                                            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {loadingUsers ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-gray-500">Loading users...</td>
                                            </tr>
                                        ) : processedUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-12 text-center">
                                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                                        <Search className="w-8 h-8 opacity-20" />
                                                        <p className="text-sm text-gray-500">No users found{isSearching ? ' for this search' : ''}.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            processedUsers.map((user) => (
                                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                                                                {user.photoURL ? (
                                                                    <img src={user.photoURL} alt={user.fullName} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-sm font-bold text-gray-500">{user.fullName?.[0] || '?'}</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-900 dark:text-white">{user.fullName}</p>
                                                                <p className="text-sm text-gray-500">{user.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1 ${user.role === 'admin' ? 'bg-red-100 text-red-700' :
                                                            user.role === 'lecturer' ? 'bg-purple-100 text-purple-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {user.role === 'admin' && <Shield className="w-3 h-3" />}
                                                            {user.role === 'lecturer' && <GraduationCap className="w-3 h-3" />}
                                                            {user.role === 'student' && <User className="w-3 h-3" />}
                                                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {user.role === 'student' ? (
                                                            <span className="font-medium text-gray-900 dark:text-white">
                                                                {user.classCount || 0}
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="p-4 text-sm text-gray-500">
                                                        {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            {user.role === 'student' && (
                                                                <button
                                                                    onClick={() => setSelectedStudent({ id: user.id, name: user.fullName })}
                                                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                                                                >
                                                                    History
                                                                </button>
                                                            )}

                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => setManagingUser(managingUser === user.id ? null : user.id)}
                                                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                                                    disabled={processingAction === user.id}
                                                                >
                                                                    <MoreVertical className="w-4 h-4 text-gray-400" />
                                                                </button>

                                                                {managingUser === user.id && (
                                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50">
                                                                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Change Role</div>
                                                                        <button onClick={() => handleUserAction(user.id, 'role', 'admin')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                                                                            <Shield className="w-4 h-4 text-red-500" /> Admin
                                                                        </button>
                                                                        <button onClick={() => handleUserAction(user.id, 'role', 'lecturer')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                                                                            <GraduationCap className="w-4 h-4 text-purple-500" /> Lecturer
                                                                        </button>
                                                                        <button onClick={() => handleUserAction(user.id, 'role', 'student')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                                                                            <User className="w-4 h-4 text-blue-500" /> Student
                                                                        </button>

                                                                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />

                                                                        {(user as any).status === 'disabled' ? (
                                                                            <button onClick={() => handleUserAction(user.id, 'enable')} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                                                                                <UserCheck className="w-4 h-4" /> Enable Account
                                                                            </button>
                                                                        ) : (
                                                                            <button onClick={() => handleUserAction(user.id, 'disable')} className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                                                                                <UserX className="w-4 h-4" /> Disable Account
                                                                            </button>
                                                                        )}

                                                                        <button onClick={() => setConfirmDelete({ id: user.id, name: user.fullName })} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                                                                            <Trash2 className="w-4 h-4" /> Delete Permanently
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination Controls - Hide during search */}
                        {!isSearching && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    Page <span className="font-bold text-gray-900 dark:text-white">{page + 1}</span>
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0 || loadingUsers}
                                        className="px-4 py-2 text-sm font-semibold border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setPage(p => p + 1)}
                                        disabled={isLastPage || loadingUsers}
                                        className="px-4 py-2 text-sm font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedStudent && (
                <StudentHistoryModal
                    isOpen={!!selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                    studentId={selectedStudent.id}
                    studentName={selectedStudent.name}
                />
            )}

            {confirmDelete && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold">Delete Account?</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-white">{confirmDelete.name}</span>? This action is irreversible and will remove their access and profile.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleUserAction(confirmDelete.id, 'delete')}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                            >
                                Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
