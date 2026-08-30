'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, ArrowLeft, LogOut, Menu, X, Settings, Users } from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, profile, loading, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const isAuthorized = !loading && user && profile?.role === 'admin';
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) { router.replace('/login'); return; }
        if (!loading && profile?.role !== 'admin') { router.replace('/dashboard'); }
    }, [user, profile, loading, router]);

    if (loading || !isAuthorized) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#1845D4] border-t-transparent rounded-full animate-spin" /></div>;

    const navItems = [
        { href: '/admin', label: 'System Oversight', icon: Shield, active: pathname === '/admin' },
        { href: '/admin/users', label: 'User Registry', icon: Users, active: pathname === '/admin/users' },
        { href: '/admin/settings', label: 'Settings', icon: Settings, active: pathname === '/admin/settings' },
    ];

    return (
        <div className="min-h-screen bg-[#F5F6FA] flex font-sans selection:bg-[#1845D4]/10">
            {/* Sidebar */}
            <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 bg-white border-r border-[#DDE0F0] z-30">
                <div className="p-8">
                    <Link href="/" className="flex flex-col gap-0.5">
                        <span className="text-2xl font-serif text-[#0D0D1A] tracking-tighter">Podium</span>
                        <span className="text-[10px] font-bold text-[#8888A8] uppercase tracking-widest">Admin Control</span>
                    </Link>
                </div>
                
                <nav className="flex-1 px-6 space-y-8 mt-10">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#DDE0F0] uppercase tracking-widest px-3 mb-4">Core Directory</p>
                        {navItems.map(item => (
                            <Link 
                                key={item.href}
                                href={item.href} 
                                className={`flex items-center gap-3 px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all ${item.active ? 'bg-[#1845D4] text-white shadow-lg shadow-blue-600/10' : 'text-[#8888A8] hover:text-[#0D0D1A] hover:bg-[#F5F6FA]'}`}
                            >
                                <item.icon className="w-4 h-4" /> {item.label}
                            </Link>
                        ))}
                    </div>

                    <div className="space-y-1 pt-8 border-t border-[#F5F6FA]">
                        <p className="text-[10px] font-bold text-[#DDE0F0] uppercase tracking-widest px-3 mb-4">Navigation</p>
                        <Link 
                            href="/dashboard" 
                            className="flex items-center gap-3 px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-widest text-[#8888A8] hover:text-[#0D0D1A] hover:bg-[#F5F6FA] transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" /> Return to Workspace
                        </Link>
                    </div>
                </nav>

                <div className="p-6 border-t border-[#F5F6FA]">
                    <button 
                        onClick={() => signOut()} 
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md text-[11px] font-bold uppercase tracking-widest text-[#8888A8] hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                        <LogOut className="w-4 h-4" /> End Admin Session
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#DDE0F0] flex items-center justify-between px-6 z-40">
                <span className="font-serif text-xl text-[#0D0D1A] tracking-tighter">Podium Admin</span>
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-[#0D0D1A] bg-[#F5F6FA] rounded-md"><Menu className="w-5 h-5" /></button>
            </div>

            {isSidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-[#0D0D1A]/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
                    <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col p-6 animate-in slide-in-from-left duration-300">
                        <div className="flex items-center justify-between mb-10">
                            <span className="font-serif text-xl text-[#0D0D1A]">Admin Control</span>
                            <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-[#8888A8] hover:text-[#0D0D1A]"><X className="w-6 h-6" /></button>
                        </div>
                        <nav className="flex-1 space-y-4">
                            {navItems.map(item => (
                                <Link key={item.href} href={item.href} onClick={() => setIsSidebarOpen(false)} className={`flex items-center gap-4 px-5 py-4 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all ${item.active ? 'bg-[#1845D4] text-white shadow-lg shadow-blue-600/10' : 'text-[#8888A8]'}`}>
                                    <item.icon className="w-5 h-5" /> {item.label}
                                </Link>
                            ))}
                        </nav>
                        <button onClick={() => signOut()} className="mt-auto w-full flex items-center justify-center gap-2 px-5 py-4 rounded-md text-[11px] font-bold uppercase tracking-widest text-red-500 bg-red-50">Log Out</button>
                    </div>
                </div>
            )}

            <main className="flex-1 flex flex-col min-w-0 lg:pl-64 pt-16 lg:pt-0">
                <div className="flex-1 px-6 py-10 lg:px-12 lg:py-16 max-w-7xl mx-auto w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
