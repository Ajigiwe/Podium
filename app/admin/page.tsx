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
import { SystemSettings, UserProfile } from '@/lib/firebase/types';
import { Settings, Save, AlertCircle, Users, Search, Shield, GraduationCap, User } from 'lucide-react';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState<'settings' | 'users'>('settings');

    // Settings State
    const [fee, setFee] = useState<number>(200);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Users State
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch Settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'system_settings', 'subscription');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as SystemSettings;
                    setFee(data.semesterFee);
                } else {
                    // Create default if not exists
                    await setDoc(docRef, {
                        id: 'subscription',
                        semesterFee: 200,
                        currency: 'GHS',
                        durationMonths: 4,
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
            const fetchUsers = async () => {
                setLoadingUsers(true);
                try {
                    const usersRef = collection(db, 'profiles');
                    const q = query(usersRef, orderBy('createdAt', 'desc'));
                    const snapshot = await getDocs(q);
                    const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
                    setUsers(fetchedUsers);
                } catch (error) {
                    console.error('Error fetching users:', error);
                } finally {
                    setLoadingUsers(false);
                }
            };
            fetchUsers();
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

    // Filter Users
    const filteredUsers = users.filter(user =>
        user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        total: users.length,
        students: users.filter(u => u.role === 'student').length,
        lecturers: users.filter(u => u.role === 'lecturer').length,
        admins: users.filter(u => u.role === 'admin').length
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
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                        <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {loadingUsers ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-500">Loading users...</td>
                                        </tr>
                                    ) : filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-500">No users found.</td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((user) => (
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
                                                <td className="p-4 text-sm text-gray-500">
                                                    {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : 'N/A'}
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
        </div>
    );
}
