'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import ThemeToggle from '@/components/ThemeToggle';

export default function ProfilePage() {
    const router = useRouter();
    const { user, profile, signOut } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Profile data
    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState('');

    // Password change
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // Statistics
    const [stats, setStats] = useState({
        totalSessions: 0,
        totalRevenue: 0,
        totalStudents: 0,
        totalSpent: 0,
        enrolledClasses: 0,
    });

    useEffect(() => {
        if (!user || !profile) {
            router.push('/auth/login');
            return;
        }

        // Load profile data
        setFullName(profile.fullName || '');
        setBio(profile.bio || '');
        setPhotoURL(profile.photoURL || '');

        // Load statistics
        loadStatistics();
        setLoading(false);
    }, [user, profile, router]);

    const loadStatistics = async () => {
        if (!user || !profile) return;

        try {
            if (profile.role === 'lecturer') {
                // Get lecturer sessions
                const sessionsQuery = query(
                    collection(db, 'sessions'),
                    where('lecturerId', '==', user.uid)
                );
                const sessionsSnapshot = await getDocs(sessionsQuery);
                const totalSessions = sessionsSnapshot.size;

                // Get total revenue
                const transactionsQuery = query(
                    collection(db, 'transactions'),
                    where('status', '==', 'succeeded')
                );
                const transactionsSnapshot = await getDocs(transactionsQuery);

                let totalRevenue = 0;
                const studentIds = new Set<string>();

                transactionsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Check if transaction is for lecturer's session
                    const sessionId = data.sessionId;
                    const isLecturerSession = sessionsSnapshot.docs.some(s => s.id === sessionId);

                    if (isLecturerSession) {
                        totalRevenue += data.amount || 0;
                        studentIds.add(data.userId);
                    }
                });

                setStats({
                    totalSessions,
                    totalRevenue: totalRevenue / 100, // Convert from pesewas to cedis
                    totalStudents: studentIds.size,
                    totalSpent: 0,
                    enrolledClasses: 0,
                });
            } else {
                // Student statistics
                const transactionsQuery = query(
                    collection(db, 'transactions'),
                    where('userId', '==', user.uid),
                    where('status', '==', 'succeeded')
                );
                const transactionsSnapshot = await getDocs(transactionsQuery);

                let totalSpent = 0;
                const enrolledSessionIds = new Set<string>();

                transactionsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    totalSpent += data.amount || 0;
                    enrolledSessionIds.add(data.sessionId);
                });

                setStats({
                    totalSessions: 0,
                    totalRevenue: 0,
                    totalStudents: 0,
                    totalSpent: totalSpent / 100, // Convert from pesewas to cedis
                    enrolledClasses: enrolledSessionIds.size,
                });
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    };



    const handleSaveProfile = async () => {
        if (!user) return;

        setSaving(true);
        try {
            await updateDoc(doc(db, 'profiles', user.uid), {
                fullName,
                bio,
                updatedAt: Timestamp.now(),
            });

            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!user) return;

        setPasswordError('');

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('All password fields are required');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        setSaving(true);
        try {
            // Reauthenticate user
            const credential = EmailAuthProvider.credential(user.email!, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Update password
            await updatePassword(user, newPassword);

            alert('Password updated successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error('Error changing password:', error);
            if (error.code === 'auth/wrong-password') {
                setPasswordError('Current password is incorrect');
            } else {
                setPasswordError(error.message || 'Failed to change password');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-orange-50 to-pink-50 dark:from-gray-900 dark:via-orange-950 dark:to-pink-950">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-600/30 border-t-orange-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50 to-pink-50 dark:from-gray-900 dark:via-orange-950 dark:to-pink-950">
            {/* Header Removed - Handled by Layout */}

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Profile Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                        {/* Profile Picture */}
                        <div className="flex-shrink-0">
                            <div className="relative">
                                <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center">
                                    {photoURL ? (
                                        <img src={photoURL} alt={fullName} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-4xl font-bold text-white">
                                            {fullName.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Profile Info */}
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white break-all">{fullName}</h2>
                            <p className="text-gray-600 dark:text-gray-400 break-all">{profile?.email}</p>
                            <div className="mt-2 flex flex-wrap justify-center sm:justify-start items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${profile?.role === 'lecturer'
                                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                    : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                    }`}>
                                    {profile?.role === 'lecturer' ? '👨‍🏫 Lecturer' : '👨‍🎓 Student'}
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Member since {profile?.createdAt ? new Date(profile.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {profile?.role === 'lecturer' ? (
                        <>
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-xl">
                                        <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Sessions</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSessions}</p>
                                    </div>
                                </div>
                            </div>



                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl">
                                        <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Students</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalStudents}</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
                                        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Enrolled Classes</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.enrolledClasses}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-green-100 dark:bg-green-900 rounded-xl">
                                        <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">GHS {stats.totalSpent.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl">
                                        <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">Active</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Edit Profile */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200/50 dark:border-gray-700/50">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Edit Profile</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Bio
                            </label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={500}
                                rows={4}
                                placeholder="Tell us about yourself..."
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {bio.length}/500 characters
                            </p>
                        </div>

                        <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-lg hover:from-orange-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-lg"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {/* Change Password */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200/50 dark:border-gray-700/50">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Change Password</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        {passwordError && (
                            <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                        )}

                        <button
                            onClick={handleChangePassword}
                            disabled={saving}
                            className="px-6 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg hover:from-red-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-lg"
                        >
                            {saving ? 'Updating...' : 'Update Password'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
