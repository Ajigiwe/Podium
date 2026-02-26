'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, LayoutDashboard, Settings, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, profile, loading, signOut } = useAuth();
    const router = useRouter();
    const isAuthorized = !loading && user && profile?.role === 'admin';
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
            return;
        }

        if (!loading && profile?.role !== 'admin') {
            router.replace('/dashboard');
        }
    }, [user, profile, loading, router]);

    if (loading || !isAuthorized) {
        return (
            <div className="min-h-screen bg-gray-50  flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600/30 border-t-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 ">
            {/* Mobile Header */}
            <div className="lg:hidden flex items-center justify-between p-4 bg-white  border-b border-gray-200  sticky top-0 z-20">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg text-gray-900 ">Podium Admin</span>
                </Link>
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-gray-100  text-gray-600 "
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
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white  border-r border-gray-200  flex flex-col transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <div className="p-6 border-b border-gray-200  flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-gray-900 ">Admin</span>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-2 rounded-lg hover:bg-gray-100  text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <Link
                        href="/admin"
                        onClick={() => setIsSidebarOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 bg-blue-50  text-blue-600  rounded-lg font-medium"
                    >
                        <Settings className="w-5 h-5" />
                        Dashboard
                    </Link>
                </nav>

                <div className="p-4 border-t border-gray-200 ">
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-3 px-4 py-3 text-red-600  hover:bg-red-50  rounded-lg w-full transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="lg:pl-64 flex-1 overflow-auto min-h-screen transition-all duration-200">
                <div className="p-4 sm:p-6 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
