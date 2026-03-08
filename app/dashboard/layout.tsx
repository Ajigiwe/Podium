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
    History as HistoryIcon,
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

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">Loading Podium...</p>
                </div>
            </div>
        );
    }

    const navigation = [
        { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
        { name: 'History', href: '/dashboard/history', icon: HistoryIcon },
    ];

    const handleSignOut = async () => {
        await signOut();
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-72 flex-col fixed inset-y-0 bg-white border-r border-slate-200 z-30">
                <div className="p-8">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                            Podium
                        </span>
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-1.5 mt-4">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                <span className="tracking-tight">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Profile Section */}
                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                            {profile?.fullName?.[0] || user.email?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">
                                {profile?.fullName || 'User'}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                {profile?.role || 'STUDENT'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 transition-colors uppercase tracking-widest"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Top Bar */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-40">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-black text-slate-900 tracking-tight">Podium</span>
                </Link>
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div
                        className="fixed inset-0 bg-black/40 transition-opacity"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                    <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-lg flex flex-col">
                        <div className="p-6 flex items-center justify-between border-b border-slate-100">
                            <span className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                                    <GraduationCap className="w-5 h-5 text-white" />
                                </div>
                                Menu
                            </span>
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <nav className="flex-1 px-4 py-6 space-y-2">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setIsSidebarOpen(false)}
                                        className={`flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-500 hover:bg-slate-50'
                                            }`}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        <span className="tracking-tight">{item.name}</span>
                                    </Link>
                                );
                            })}
                        </nav>
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => {
                                    setIsSidebarOpen(false);
                                    signOut();
                                }}
                                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 bg-red-50 transition-colors"
                            >
                                <LogOut className="w-5 h-5" />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 lg:pl-72 pt-16 lg:pt-0">
                <div className="flex-1 px-6 py-8 lg:px-10 lg:py-12 max-w-7xl mx-auto w-full">
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
                </div>
            </main>
        </div>
    );
}
