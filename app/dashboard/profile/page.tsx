'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { db, handleFirestoreError } from '@/lib/firebase/config';
import { doc, updateDoc, collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { BookOpen, Users, CreditCard, CheckCircle, History, Camera, Upload, X, Loader2 } from 'lucide-react';
import AttendanceHistoryModal from '@/components/AttendanceHistoryModal';
import ImageCropperModal from '@/components/ImageCropperModal';
import { RecordingsDashboard } from '@/components/RecordingsDashboard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useQueryClient } from '@tanstack/react-query';

export default function ProfilePage() {
    const router = useRouter();
    const { user, profile, signOut } = useAuth();
    const { showAlert } = useAlert();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Image Cropping State
    const [tempImage, setTempImage] = useState<string | null>(null);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [uploadingFile, setUploadingFile] = useState<File | null>(null);

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
        totalStudents: 0,
        enrolledClasses: 0,
    });

    // History Modal
    const [showHistoryModal, setShowHistoryModal] = useState(false);

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

                // Calculate total unique students across all sessions
                // We need to fetch attendance logs or transactions?
                // Previously it used transactions to count students.
                // If we remove transactions query, we lose accurate student count if it was based on payment.
                // But the requirement is just to remove revenue.
                // Let's keep logic to count students if possible, or simplify.
                // The previous logic counted students who PAID (transactions).
                // "Remove total revenue" - typically implies hiding the Money aspect.
                // I should probably keep counting students but maybe fetch it differently or keep fetching transactions solely for student count?
                // Actually, counting distinct students from transactions is still valid for "Total Students" (paid students).
                // Let's re-read the code I'm replacing:
                // lines 71-90 fetched transactions to calculate revenue AND count students.
                // If I remove revenue, I still need student count?
                // "remove total revenue from lecturer profile and student profile"
                // It likely implicitly means remove the "Financials" aspect.
                // I will keep the transaction fetching just to count students to ensure "Total Students" doesn't break,
                // OR I can switch to counting 'attendance_logs' for "Total Students" (students who attended).
                // Given the variable name 'totalStudents', let's stick to the previous source (transactions) or switch to attendance.
                // Attendance is safer for "Total Students" anyway as it reflects engagement.
                // However, modifying the metric definition might be out of scope.
                // The safest bet is to keep fetching transactions to count students but NOT sum up revenue.

                // OPTIMIZATION: In a large system, we should add 'lecturerId' to the transaction document
                // to avoid fetching all transactions. For now, we fetch the last 100 succeeded ones
                // to calculate stats without crashing the client on a massive dataset.
                const transactionsQuery = query(
                    collection(db, 'transactions'),
                    where('status', '==', 'succeeded'),
                    orderBy('createdAt', 'desc'),
                    limit(100)
                );
                const transactionsSnapshot = await getDocs(transactionsQuery);

                const studentIds = new Set<string>();

                transactionsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    const sessionId = data.sessionId;
                    // Check if transaction is for lecturer's session
                    const isLecturerSession = sessionsSnapshot.docs.some(s => s.id === sessionId);

                    if (isLecturerSession) {
                        studentIds.add(data.userId);
                    }
                });

                setStats({
                    totalSessions,
                    totalStudents: studentIds.size,
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

                const enrolledSessionIds = new Set<string>();

                transactionsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    enrolledSessionIds.add(data.sessionId);
                });

                setStats({
                    totalSessions: 0,
                    totalStudents: 0,
                    enrolledClasses: enrolledSessionIds.size,
                });
            }
        } catch (error) {
            console.error('[Profile:Stats] Error loading statistics:', error);
            // Attempt to handle Firestore error and retry
            const handled = await handleFirestoreError(db, error);
            if (handled) {
                // Retry logic (simplified)
                try {
                    if (profile.role === 'lecturer') {
                        const sessionsQuery = query(
                            collection(db, 'sessions'),
                            where('lecturerId', '==', user.uid)
                        );
                        const sessionsSnapshot = await getDocs(sessionsQuery);
                        const totalSessions = sessionsSnapshot.size;

                        const transactionsQuery = query(
                            collection(db, 'transactions'),
                            where('status', '==', 'succeeded'),
                            orderBy('createdAt', 'desc'),
                            limit(100)
                        );
                        const transactionsSnapshot = await getDocs(transactionsQuery);

                        const studentIds = new Set<string>();

                        transactionsSnapshot.forEach((doc) => {
                            const data = doc.data();
                            const isLecturerSession = sessionsSnapshot.docs.some(s => s.id === data.sessionId);
                            if (isLecturerSession) {
                                studentIds.add(data.userId);
                            }
                        });

                        setStats({
                            totalSessions,
                            totalStudents: studentIds.size,
                            enrolledClasses: 0,
                        });
                    } else {
                        const transactionsQuery = query(
                            collection(db, 'transactions'),
                            where('userId', '==', user.uid),
                            where('status', '==', 'succeeded')
                        );
                        const transactionsSnapshot = await getDocs(transactionsQuery);

                        const enrolledSessionIds = new Set<string>();

                        transactionsSnapshot.forEach((doc) => {
                            const data = doc.data();
                            enrolledSessionIds.add(data.sessionId);
                        });

                        setStats({
                            totalSessions: 0,
                            totalStudents: 0,
                            enrolledClasses: enrolledSessionIds.size,
                        });
                    }
                } catch (retryError) {
                    console.error('[Profile:Stats:Retry] Retry failed to load statistics:', retryError);
                }
            }
        }
    };



    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Basic validation
        if (file.size > 5 * 1024 * 1024) {
            showAlert('Image must be less than 5MB', 'error');
            return;
        }

        if (!file.type.startsWith('image/')) {
            showAlert('Please upload an image file', 'error');
            return;
        }

        setUploadingFile(file);
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setTempImage(reader.result as string);
            setShowCropper(true);
        });
        reader.readAsDataURL(file);
    };

    const getResizedImage = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
        const image = new Image();
        image.src = imageSrc;
        await new Promise((resolve) => (image.onload = resolve));

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2d context');

        // Target size: 400x400
        canvas.width = 400;
        canvas.height = 400;

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            400,
            400
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas to Blob failed'));
            }, 'image/jpeg', 0.9);
        });
    };

    const handleConfirmCrop = async () => {
        if (!tempImage || !croppedAreaPixels || !user) return;

        setSubmitting(true);
        setShowCropper(false);
        console.log('Starting upload of cropped image...');

        try {
            const croppedBlob = await getResizedImage(tempImage, croppedAreaPixels);
            const storageRef = ref(storage, `profile-pictures/${user.uid}`);
            const uploadTask = uploadBytesResumable(storageRef, croppedBlob);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload is ' + progress + '% done');
                },
                (error) => {
                    console.error('Upload task error:', error);
                    showAlert(`Upload failed: ${error.message}`, 'error');
                    setSubmitting(false);
                },
                async () => {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    console.log('Cropped file available at', url);

                    await updateDoc(doc(db, 'profiles', user.uid), {
                        photoURL: url,
                        updatedAt: Timestamp.now(),
                    });

                    // Invalidate profile query to update the entire site
                    queryClient.invalidateQueries({ queryKey: ['profile', user.uid] });

                    setPhotoURL(url);
                    setSubmitting(false);
                    setTempImage(null);
                    setUploadingFile(null);
                    showAlert('Profile picture updated!', 'success');
                }
            );
        } catch (error: any) {
            console.error('Error processing or uploading photo:', error);
            showAlert('Failed to process image. Try again.', 'error');
            setSubmitting(false);
            setTempImage(null);
            setUploadingFile(null);
        }
    };

    const handleSaveProfile = async () => {
        if (!user) return;

        setSubmitting(true);
        try {
            await updateDoc(doc(db, 'profiles', user.uid), {
                fullName,
                bio,
                updatedAt: Timestamp.now(),
            });

            // Invalidate profile query
            queryClient.invalidateQueries({ queryKey: ['profile', user.uid] });

            showAlert('Profile updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            // Attempt to handle Firestore error and retry
            const handled = await handleFirestoreError(db, error);
            if (handled) {
                try {
                    await updateDoc(doc(db, 'profiles', user.uid), {
                        fullName,
                        bio,
                        updatedAt: Timestamp.now(),
                    });
                    showAlert('Profile updated successfully!', 'success');
                } catch (retryError) {
                    console.error('Retry failed to update profile:', retryError);
                    showAlert('Failed to update profile after retry', 'error');
                }
            } else {
                showAlert('Failed to update profile', 'error');
            }
        } finally {
            setSubmitting(false);
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

        setSubmitting(true);
        try {
            // Reauthenticate user
            const credential = EmailAuthProvider.credential(user.email!, currentPassword);
            await reauthenticateWithCredential(user, credential);

            // Update password
            await updatePassword(user, newPassword);

            showAlert('Password updated successfully!', 'success');
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
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white dark:bg-gray-900 rounded-xl p-8 border border-gray-200 dark:border-gray-800">
                    <div className="flex gap-6 items-center">
                        <Skeleton className="w-24 h-24 rounded-full" />
                        <div className="flex-1 space-y-3">
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
                <Skeleton className="h-[400px] w-full rounded-xl" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Profile Card */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                    {/* Profile Picture */}
                    <div className="flex-shrink-0 relative group">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-lg">
                            {photoURL ? (
                                <img src={photoURL} alt={fullName} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-3xl font-bold text-white">
                                    {fullName.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>

                        {/* Upload Overlay */}
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-[2px]">
                            <Camera className="w-8 h-8 text-white" />
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                disabled={submitting}
                            />
                        </label>

                        {submitting && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full backdrop-blur-[2px]">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Profile Info */}
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{fullName}</h2>
                        <p className="text-gray-600 dark:text-gray-400">{profile?.email}</p>
                        <div className="mt-3 flex flex-wrap justify-center sm:justify-start items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${profile?.role === 'lecturer'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                }`}>
                                {profile?.role === 'lecturer' ? 'Lecturer' : 'Student'}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Member since {profile?.createdAt ? new Date(profile.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {profile?.role === 'lecturer' ? (
                    <>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                    <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Sessions</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalSessions}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                    <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
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
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                    <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Enrolled Classes</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.enrolledClasses}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                    <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
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

            {/* Lecturer Actions (History) */}
            {profile?.role === 'lecturer' && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowHistoryModal(true)}
                        className="px-5 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 font-semibold transition-colors flex items-center gap-2"
                    >
                        <History className="w-5 h-5" />
                        View Attendance History
                    </button>

                    <AttendanceHistoryModal
                        isOpen={showHistoryModal}
                        onClose={() => setShowHistoryModal(false)}
                        userId={user?.uid || ''}
                    />
                </div>
            )}

            {/* Edit Profile */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Edit Profile</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {bio.length}/500 characters
                        </p>
                    </div>

                    <button
                        onClick={handleSaveProfile}
                        disabled={submitting}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                    >
                        {submitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Change Password */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Change Password</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Current Password
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {passwordError && (
                        <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                    )}

                    <button
                        onClick={handleChangePassword}
                        disabled={submitting}
                        className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                    >
                        {submitting ? 'Updating...' : 'Update Password'}
                    </button>
                </div>
            </div>

            {/* Recordings Section */}
            {profile?.role === 'lecturer' && (
                <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
                    <RecordingsDashboard lecturerId={user?.uid || ''} />
                </div>
            )}

            {/* Cropper Modal */}
            {showCropper && tempImage && (
                <ImageCropperModal
                    image={tempImage}
                    onCropComplete={(pixels) => setCroppedAreaPixels(pixels)}
                    onClose={() => {
                        setShowCropper(false);
                        setTempImage(null);
                        setUploadingFile(null);
                    }}
                    onConfirm={handleConfirmCrop}
                />
            )}
        </div>
    );
}
