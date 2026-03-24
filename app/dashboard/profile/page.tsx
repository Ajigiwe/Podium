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
import { BookOpen, Users, CreditCard, CheckCircle, History, Camera, Upload, X, Loader2, Star, Heart, Smile, Shield, Zap, User, GraduationCap, Laptop, Book, Music, Palette } from 'lucide-react';
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
    const [role, setRole] = useState<'student' | 'lecturer' | 'admin'>('student');
    const [indexNumber, setIndexNumber] = useState('');
    const [displayIcon, setDisplayIcon] = useState('User');

    const profileIcons = [
        { name: 'User', icon: User },
        { name: 'GraduationCap', icon: GraduationCap },
        { name: 'Book', icon: Book },
        { name: 'Laptop', icon: Laptop },
        { name: 'Star', icon: Star },
        { name: 'Heart', icon: Heart },
        { name: 'Smile', icon: Smile },
        { name: 'Shield', icon: Shield },
        { name: 'Zap', icon: Zap },
        { name: 'Music', icon: Music },
        { name: 'Palette', icon: Palette },
    ];

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
            router.push('/login');
            return;
        }

        // Load profile data
        setFullName(profile.fullName || '');
        setBio(profile.bio || '');
        setPhotoURL(profile.photoURL || '');
        setRole(profile.role || 'student');
        setIndexNumber(profile.indexNumber || '');
        setDisplayIcon(profile.displayIcon || 'User');

        // Load statistics
        loadStatistics();
        setLoading(false);
    }, [user, profile, router]);

    const loadStatistics = async () => {
        if (!user || !profile) return;

        try {
            if (profile.role === 'lecturer') {
                // 1. Get total sessions (filter deleted in-memory to avoid composite index)
                const sessionsQuery = query(
                    collection(db, 'sessions'),
                    where('lecturerId', '==', user.uid)
                );
                const sessionsSnapshot = await getDocs(sessionsQuery);
                const totalSessions = sessionsSnapshot.docs.filter(doc => doc.data().isDeleted !== true).length;

                // 2. Get total unique students from attendance_logs
                const logsQuery = query(
                    collection(db, 'attendance_logs'),
                    where('lecturerId', '==', user.uid)
                );
                const logsSnapshot = await getDocs(logsQuery);
                const studentIds = new Set<string>();
                logsSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.userId) studentIds.add(data.userId);
                });

                setStats({
                    totalSessions,
                    totalStudents: studentIds.size,
                    enrolledClasses: 0,
                });
            } else {
                // Student statistics from attendance_logs
                const logsQuery = query(
                    collection(db, 'attendance_logs'),
                    where('userId', '==', user.uid)
                );
                const logsSnapshot = await getDocs(logsQuery);

                const enrolledSessionIds = new Set<string>();
                logsSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.sessionId) enrolledSessionIds.add(data.sessionId);
                });

                setStats({
                    totalSessions: 0,
                    totalStudents: 0,
                    enrolledClasses: enrolledSessionIds.size,
                });
            }
        } catch (error) {
            console.error('[Profile:Stats] Error loading statistics:', error);
            await handleFirestoreError(db, error);
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
                role,
                indexNumber: role === 'student' ? indexNumber : '',
                displayIcon,
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
                        role,
                        indexNumber: role === 'student' ? indexNumber : '',
                        displayIcon,
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
                <div className="bg-white  rounded-lg p-8 border border-gray-200 ">
                    <div className="flex gap-6 items-center">
                        <Skeleton className="w-24 h-24 rounded-full" />
                        <div className="flex-1 space-y-3">
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-24 w-full rounded-md" />
                    <Skeleton className="h-24 w-full rounded-md" />
                    <Skeleton className="h-24 w-full rounded-md" />
                </div>
                <Skeleton className="h-[400px] w-full rounded-lg" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Profile Card */}
            <div className="bg-white  rounded-lg p-6 sm:p-8 border border-gray-200 ">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                    {/* Profile Picture */}
                    <div className="flex-shrink-0 relative group">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center border-2 border-gray-200">
                            {photoURL ? (
                                <img src={photoURL} alt={fullName} className="w-full h-full object-cover" />
                            ) : (
                                (() => {
                                    const SelectedIcon = profileIcons.find(i => i.name === displayIcon)?.icon || User;
                                    return <SelectedIcon className="w-12 h-12 text-white" />;
                                })()
                            )}
                        </div>

                        {/* Upload Overlay */}
                        <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
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
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Profile Info */}
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 ">{fullName}</h2>
                        <p className="text-gray-600 ">{profile?.email}</p>
                        <div className="mt-3 flex flex-wrap justify-center sm:justify-start items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${profile?.role === 'lecturer'
                                ? 'bg-amber-100  text-amber-700 '
                                : 'bg-blue-100  text-blue-700 '
                                }`}>
                                {role === 'lecturer' ? 'Lecturer' : role === 'admin' ? 'Admin' : 'Student'}
                            </span>
                            <span className="text-sm text-gray-500 ">
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
                        <div className="bg-white  rounded-md p-5 border border-gray-200 ">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100  rounded-md">
                                    <BookOpen className="w-5 h-5 text-blue-600 " />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 ">Total Sessions</p>
                                    <p className="text-2xl font-bold text-gray-900 ">{stats.totalSessions}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white  rounded-md p-5 border border-gray-200 ">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-100  rounded-md">
                                    <Users className="w-5 h-5 text-purple-600 " />
                                </div>
                                <div division-id="1">
                                    <p className="text-sm text-gray-600 ">Total Students</p>
                                    <p className="text-2xl font-bold text-gray-900 ">{stats.totalStudents}</p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-white  rounded-md p-5 border border-gray-200 ">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100  rounded-md">
                                    <BookOpen className="w-5 h-5 text-blue-600 " />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 ">Enrolled Classes</p>
                                    <p className="text-2xl font-bold text-gray-900 ">{stats.enrolledClasses}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white  rounded-md p-5 border border-gray-200 ">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-100  rounded-md">
                                    <CheckCircle className="w-5 h-5 text-purple-600 " />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 ">Status</p>
                                    <p className="text-2xl font-bold text-gray-900 ">Active</p>
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
                        className="px-5 py-2.5 bg-blue-50  text-blue-600  rounded-md hover:bg-blue-100  font-semibold transition-colors flex items-center gap-2"
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
            <div className="bg-white  rounded-lg p-6 sm:p-8 border border-gray-200 ">
                <h3 className="text-lg font-bold text-gray-900  mb-6">Edit Profile</h3>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Role
                            </label>
                            <div className="flex gap-2 p-1 bg-gray-100 rounded-md">
                                <button
                                    onClick={() => setRole('student')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${role === 'student' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Student
                                </button>
                                <button
                                    onClick={() => setRole('lecturer')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${role === 'lecturer' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Lecturer
                                </button>
                            </div>
                        </div>
                    </div>

                    {role === 'student' && (
                        <div className="animate-in slide-in-from-top duration-300">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Student Index Number <span className="text-xs text-blue-500 font-bold ml-2">(Stored Permanently)</span>
                            </label>
                            <input
                                type="text"
                                value={indexNumber}
                                onChange={(e) => setIndexNumber(e.target.value)}
                                placeholder="e.g. 10293847"
                                className="w-full px-4 py-3 bg-blue-50/30 border border-blue-100 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-6 font-bold">
                            Choose Your Display Icon
                            {photoURL ? (
                                <p className="text-xs font-normal text-blue-500 mt-1">Note: Your profile picture takes precedence over this icon.</p>
                            ) : (
                                <p className="text-xs font-normal text-gray-400 mt-1">Used if you don't have a profile picture.</p>
                            )}
                        </label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-3">
                            {profileIcons.map((item) => (
                                <button
                                    key={item.name}
                                    onClick={() => setDisplayIcon(item.name)}
                                    className={`p-3 rounded-md flex items-center justify-center transition-all ${displayIcon === item.name ? 'bg-blue-600 text-white shadow-lg scale-110' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                >
                                    <item.icon className="w-6 h-6" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700  mb-2">
                            Bio
                        </label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            maxLength={500}
                            rows={4}
                            placeholder="Tell us about yourself..."
                            className="w-full px-4 py-3 bg-gray-50  border border-gray-300  rounded-md text-gray-900  focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-sm text-gray-500  mt-1">
                            {bio.length}/500 characters
                        </p>
                    </div>

                    <button
                        onClick={handleSaveProfile}
                        disabled={submitting}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                    >
                        {submitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Change Password - Only for Email/Password users */}
            {user?.providerData.some(p => p.providerId === 'password') && (
                <div className="bg-white  rounded-lg p-6 sm:p-8 border border-gray-200 ">
                    <h3 className="text-lg font-bold text-gray-900  mb-6">Change Password</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700  mb-2">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50  border border-gray-300  rounded-md text-gray-900  focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700  mb-2">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50  border border-gray-300  rounded-md text-gray-900  focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700  mb-2">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50  border border-gray-300  rounded-md text-gray-900  focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {passwordError && (
                            <p className="text-sm text-red-600 ">{passwordError}</p>
                        )}

                        <button
                            onClick={handleChangePassword}
                            disabled={submitting}
                            className="px-6 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                        >
                            {submitting ? 'Updating...' : 'Update Password'}
                        </button>
                    </div>
                </div>
            )}

            {/* Recordings Section */}
            {profile?.role === 'lecturer' && (
                <div className="pt-8 border-t border-gray-200 ">
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
