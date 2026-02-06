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
    query
} from 'firebase/firestore';
import { SystemSettings, UserProfile, AttendanceLog } from '@/lib/firebase/types';
import { ArrowUpDown, ArrowUp, ArrowDown, Settings, Save, AlertCircle, Users, Search, Shield, GraduationCap, User } from 'lucide-react';
import StudentHistoryModal from './components/StudentHistoryModal';

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

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // History Modal State
    const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

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

    // Fetch Users when tab changes
    useEffect(() => {
        if (activeTab === 'users' && users.length === 0) {
            const fetchUsersAndLogs = async () => {
                setLoadingUsers(true);
                try {
                    // 1. Fetch Users
                    const usersRef = collection(db, 'profiles');
                    const q = query(usersRef, orderBy('createdAt', 'desc'));
                    const userSnapshot = await getDocs(q);
                    const fetchedUsers = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));

                    // 2. Fetch All Attendance Logs (Aggregate Count)
                    // Note: In a large app, we would use a counter trigger, but for this scale, fetching logs is okay
                    // We only need logs to count for each student.
                    // Doing client-side aggregation for now.
                    const logsRef = collection(db, 'attendance_logs');
                    const logsSnapshot = await getDocs(logsRef);
                    const logs = logsSnapshot.docs.map(doc => doc.data() as AttendanceLog);

                    // Map studentId -> Set of sessionIds (to count unique classes)
                    const studentClassCounts: Record<string, Set<string>> = {};

                    logs.forEach(log => {
                        if (log.userId) {
                            if (!studentClassCounts[log.userId]) {
                                studentClassCounts[log.userId] = new Set();
                            }
                            // Store sessionId to count distinct classes joined
                            // If user joined same class multiple times, we usually just want to know how many distinct classes.
                            // User asked: "number of classes a student has joined".
                            // Usually implies distinct classes.
                            studentClassCounts[log.userId].add(log.sessionId);
                        }
                    });

                    // Merge counts into users
                    const usersWithCounts = fetchedUsers.map(user => ({
                        ...user,
                        classCount: studentClassCounts[user.id]?.size || 0
                    }));

                    setUsers(usersWithCounts);
                } catch (error) {
                    console.error('Error fetching users:', error);
                } finally {
                    setLoadingUsers(false);
                }
            };
            fetchUsersAndLogs();
        }
    }, [activeTab, users.length]);

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

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filter and Sort Users
    const processedUsers = [...users]
        .filter(user =>
            user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
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

    const stats = {
        total: users.length,
        students: users.filter(u => u.role === 'student').length,
        lecturers: users.filter(u => u.role === 'lecturer').length,
        admins: users.filter(u => u.role === 'admin').length
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
        return sortConfig.direction === 'asc' ? (
            <ArrowUp className="w-4 h-4 text-blue-600" />
        ) : (
            <ArrowDown className="w-4 h-4 text-blue-600" />
        );
    };

    if (loadingSettings) return <div className="flex items-center justify-center h-64">Loading...</div>;

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
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                Registered Users
                            </h2>
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

                        <div className="overflow-x-auto">
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
                                            <td colSpan={5} className="p-8 text-center text-gray-500">No users found.</td>
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
                                                    {user.role === 'student' && (
                                                        <button
                                                            onClick={() => setSelectedStudent({ id: user.id, name: user.fullName })}
                                                            className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                                                        >
                                                            View History
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
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
        </div>
    );
}
