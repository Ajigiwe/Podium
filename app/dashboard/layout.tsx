'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import {
    LayoutDashboard,
    BookOpen,
    History,
    Settings,
    LogOut,
    Menu,
    X,
    GraduationCap,
    UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { profile, signOut } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 1024);
            if (window.innerWidth >= 1024) {
                setIsSidebarOpen(false);
            }
        };

        handleResize(); // Check on mount
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isLecturer = profile?.role === 'lecturer';

    const navigation = isLecturer ? [
        { name: 'Overview', href: '/dashboard/lecturer', icon: LayoutDashboard },
        { name: 'Profile', href: '/dashboard/profile', icon: UserCircle },
    ] : [
        { name: 'Overview', href: '/dashboard/student', icon: LayoutDashboard },
        { name: 'Profile', href: '/dashboard/profile', icon: UserCircle },
    ];

    const handleSignOut = async () => {
        await signOut();
        router.push('/auth/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300 relative overflow-hidden">
            {/* Animated Background */}
            <div className="bg-noise" />
            <div className="fixed top-0 right-0 -z-10 w-[800px] h-[800px] bg-purple-500/20 dark:bg-purple-500/10 rounded-full blur-3xl opacity-50 mix-blend-multiply animate-blob" />
            <div className="fixed bottom-0 left-0 -z-10 w-[600px] h-[600px] bg-indigo-500/20 dark:bg-indigo-500/10 rounded-full blur-3xl opacity-50 mix-blend-multiply animate-blob animation-delay-2000" />

            {/* Mobile Header */}
            <div className="lg:hidden flex items-center justify-between p-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg text-gray-900 dark:text-white">Podium</span>
                </div>
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Sidebar */}
            <AnimatePresence>
                {(isSidebarOpen || isDesktop) && (
                    <>
                        {/* Backdrop for mobile */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="lg:hidden fixed inset-0 bg-black/50 z-30 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ease-in-out ${!isSidebarOpen ? 'hidden lg:flex' : 'flex'}`}
                        >
                            {/* Sidebar Header */}
                            <div className="p-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <GraduationCap className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="font-bold text-xl text-gray-900 dark:text-white">Podium</span>
                                </div>
                                <button
                                    onClick={() => setIsSidebarOpen(false)}
                                    className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* User Info */}
                            <div className="px-6 mb-8">
                                <div className="p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-gray-100 dark:border-white/10 backdrop-blur-sm shadow-sm">
                                    <div className="flex items-center gap-3 mb-3">
                                        {profile?.photoURL ? (
                                            <img src={profile.photoURL} alt={profile.fullName} className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/20" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold ring-2 ring-indigo-500/20">
                                                {profile?.fullName?.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[120px]">
                                                {profile?.fullName}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                                {profile?.role}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                            <div className="h-full bg-indigo-500 w-3/4 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation */}
                            <nav className="flex-1 px-4 space-y-1">
                                {navigation.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            onClick={() => setIsSidebarOpen(false)}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                                ? 'bg-indigo-50/80 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 shadow-sm border border-indigo-100 dark:border-indigo-800'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50/50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'
                                                }`}
                                        >
                                            <item.icon className="w-5 h-5" />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </nav>

                            {/* Footer / Actions */}
                            <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50 space-y-2">
                                <div className="flex items-center justify-between px-4 py-2">
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Dark Mode</span>
                                    <ThemeToggle />
                                </div>
                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Sign Out
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <div className="flex-1 lg:pl-72 flex flex-col min-h-screen transition-all duration-300">
                <main className="flex-1 p-4 sm:p-6 lg:p-8 relative z-10">
                    {children}
                </main>
            </div>
        </div>
    );
}
