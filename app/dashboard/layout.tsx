'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { SystemSettings } from '@/lib/firebase/types';
import { initializeSubscription } from '@/lib/payments/initializeSubscription';
import { useAlert } from '@/contexts/AlertContext';
import {
    LayoutDashboard,
    LogOut,
    Menu,
    X,
    GraduationCap,
    UserCircle,
    History as HistoryIcon
} from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, profile, loading, signOut } = useAuth();
    const { showAlert } = useAlert();
    const pathname = usePathname();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);

    // Global Lock State
    const [isPayToUse, setIsPayToUse] = useState<boolean>(false);
    const [semesterFee, setSemesterFee] = useState<number>(200);
    const [currency, setCurrency] = useState('GHS');
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [initializingSub, setInitializingSub] = useState(false);

    useEffect(() => {
        if (!user) {
            setLoadingSettings(false);
            return;
        }

        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'system_settings', 'subscription'));
                if (docSnap.exists()) {
                    const data = docSnap.data() as SystemSettings;
                    setIsPayToUse(data.isPayToUse !== undefined ? data.isPayToUse : true);
                    setSemesterFee(data.semesterFee);
                    setCurrency(data.currency || 'GHS');
                }
            } catch (error) {
                console.error("[DashboardLayout:Settings] Error:", error);
            } finally {
                setLoadingSettings(false);
            }
        };
        fetchSettings();
    }, [user]);

    const handlePaySubscription = async () => {
        if (!user?.email) return;
        setInitializingSub(true);
        try {
            const url = await initializeSubscription(user.uid, user.email);
            if (url) window.location.href = url;
            else showAlert("Payment system offline.", "error");
        } catch (e) {
            console.error(e);
            showAlert("Failed to initialize payment.", "error");
        }
        finally { setInitializingSub(false); }
    };

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 1024);
            if (window.innerWidth >= 1024) {
                setIsSidebarOpen(false);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const navigation = [
        { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
        { name: 'History', href: '/dashboard/history', icon: HistoryIcon },
        { name: 'Profile', href: '/dashboard/profile', icon: UserCircle },
    ];

    const handleSignOut = async () => {
        await signOut();
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    };

    return (
        <div className="min-h-screen bg-gray-50 transition-colors duration-200">
            {/* Mobile Header */}
            <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-20">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg text-gray-900">Podium</span>
                </Link>
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Sidebar Backdrop (Mobile) */}
            {isSidebarOpen && (
                <div
                    onClick={() => setIsSidebarOpen(false)}
                    className="lg:hidden fixed inset-0 bg-black/50 z-30"
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                {/* Sidebar Header */}
                <div className="p-6 flex items-center justify-between border-b border-gray-200">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-bold text-xl text-gray-900">Podium</span>
                    </Link>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* User Info */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        {profile?.photoURL ? (
                            <img src={profile.photoURL} alt={profile.fullName} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                {profile?.fullName?.charAt(0)}
                            </div>
                        )}
                        <div>
                            <p className="font-semibold text-gray-900 text-sm truncate max-w-[140px]">
                                {profile?.fullName}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">
                                {profile?.role}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer / Actions */}
                <div className="p-4 border-t border-gray-200 space-y-2">
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </div>

            <div className="flex-1 lg:pl-72 flex flex-col min-h-screen transition-all duration-200">
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    {(loadingSettings || loading) ? (
                        <div className="flex items-center justify-center min-h-[60vh]">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (() => {
                        const isAdmin = profile?.role === 'admin';
                        const isSubscribed = profile?.subscriptionStatus === 'active';
                        const hasAccess = isAdmin || !isPayToUse || isSubscribed;

                        if (!hasAccess) {
                            return (
                                <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
                                    <div className="max-w-md w-full bg-white border border-gray-200 rounded-3xl p-8 text-center space-y-6 shadow-sm">
                                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                                            <LayoutDashboard className="w-10 h-10 text-blue-600" />
                                        </div>

                                        <div className="space-y-2">
                                            <h2 className="text-3xl font-black text-gray-900 leading-tight">Dashboard Locked</h2>
                                            <p className="text-gray-500 font-medium">
                                                Active semester subscription required to access platform features.
                                            </p>
                                        </div>

                                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex items-center justify-between">
                                            <div className="text-left">
                                                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Semester Fee</p>
                                                <p className="text-2xl font-black text-gray-900">{currency} {semesterFee}</p>
                                            </div>
                                            <HistoryIcon className="w-8 h-8 text-gray-300" />
                                        </div>

                                        <button
                                            onClick={handlePaySubscription}
                                            disabled={initializingSub}
                                            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 disabled:opacity-50"
                                        >
                                            {initializingSub ? (
                                                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    Pay Semester Fee
                                                </>
                                            )}
                                        </button>

                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pt-2">
                                            Secure Payment via Paystack
                                        </p>
                                    </div>
                                </div>
                            );
                        }
                        return children;
                    })()}
                </main>
            </div>
        </div>
    );
}
