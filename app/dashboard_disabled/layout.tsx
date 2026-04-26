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
    LayoutDashboard, LogOut, Menu, X, GraduationCap, History as HistoryIcon, User, CircleUser, Shield, ShieldCheck
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode; }) {
    const { user, profile, loading, signOut } = useAuth();
    const { showAlert } = useAlert();
    const pathname = usePathname();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [isPayToUse, setIsPayToUse] = useState<boolean>(false);
    const [semesterFee, setSemesterFee] = useState<number>(200);
    const [currency, setCurrency] = useState('GHS');
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [initializingSub, setInitializingSub] = useState(false);

    useEffect(() => {
        if (!user) { setLoadingSettings(false); return; }
        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'system_settings', 'subscription'));
                if (docSnap.exists()) {
                    const data = docSnap.data() as SystemSettings;
                    setIsPayToUse(data.isPayToUse !== undefined ? data.isPayToUse : true);
                    setSemesterFee(data.semesterFee);
                    setCurrency(data.currency || 'GHS');
                }
            } catch (error) {} finally { setLoadingSettings(false); }
        };
        fetchSettings();
    }, [user]);

    const handlePaySubscription = async () => {
        if (!user?.email) return; setInitializingSub(true);
        try {
            const url = await initializeSubscription(user.uid, user.email);
            if (url) window.location.href = url; else showAlert("Offline.", "error");
        } catch (e) { showAlert("Failed.", "error"); } finally { setInitializingSub(false); }
    };

    useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

    if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]"><div className="w-8 h-8 border-2 border-[#1845D4] border-t-transparent rounded-full animate-spin" /></div>;

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'History', href: '/dashboard/history', icon: GraduationCap },
        { name: 'Settings', href: '/dashboard/profile', icon: CircleUser },
    ];

    const handleSignOut = async () => { await signOut(); router.push('/login'); };

    return (
        <div className="min-h-screen bg-[#F5F6FA] flex font-sans selection:bg-blue-100">
            {/* Sidebar (Based on dashboard.html) */}
            <aside className="hidden lg:flex w-60 flex-col fixed inset-y-0 bg-white border-r border-[#DDE0F0] z-30">
                <Link href="/" className="h-[60px] px-6 flex items-center border-b border-[#DDE0F0] font-serif text-[1.3rem] text-[#1845D4] decoration-none">Podium</Link>
                
                <nav className="flex-1 px-3 py-6 overflow-y-auto">
                    <div className="px-3 mb-2 text-[10px] font-bold text-[#8888A8] uppercase tracking-[0.1em]">Main</div>
                    <div className="space-y-0.5">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link key={item.name} href={item.href} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium transition-all ${isActive ? 'bg-[#E8EEFF] text-[#1845D4]' : 'text-[#444460] hover:bg-[#F5F6FA] hover:text-[#0D0D1A]'}`}><item.icon className="w-4 h-4 stroke-[2px]" /> {item.name}</Link>
                            );
                        })}
                    </div>
                </nav>

                <div className="p-3 border-t border-[#DDE0F0]">
                    <Link href="/dashboard/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[#F5F6FA] transition-all group">
                        <div className="w-8 h-8 rounded-full bg-[#1845D4] flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shadow-sm">
                            {profile?.photoURL ? <img src={profile.photoURL} className="w-full h-full object-cover" /> : profile?.fullName?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-[#0D0D1A] truncate">{profile?.fullName?.split(' ')[0] || 'User'}</p>
                            <p className="text-[10px] font-bold text-[#8888A8] uppercase tracking-widest truncate">{profile?.role || 'Student'}</p>
                        </div>
                    </Link>
                    <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2.5 rounded-md text-[13px] font-medium text-[#8888A8] hover:text-red-600 hover:bg-red-50 transition-all"><LogOut className="w-4 h-4" /> Sign Out</button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#DDE0F0] flex items-center justify-between px-6 z-40">
                <Link href="/" className="font-serif font-black text-[#1845D4] text-lg">Podium</Link>
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-[#0D0D1A] bg-[#F5F6FA] rounded-md"><Menu className="w-5 h-5" /></button>
            </div>

            {isSidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-[#0D0D1A]/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
                    <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-2xl flex flex-col p-5 animate-in slide-in-from-left duration-300">
                        <div className="flex items-center justify-between mb-8"><span className="font-serif text-[#1845D4] text-xl">Podium</span><button onClick={() => setIsSidebarOpen(false)} className="p-2 text-[#8888A8] hover:text-[#0D0D1A]"><X className="w-5 h-5" /></button></div>
                        <nav className="flex-1 space-y-1">
                            {navigation.map((item) => (
                                <Link key={item.name} href={item.href} onClick={() => setIsSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-md text-[13px] font-medium transition-colors ${pathname === item.href ? 'bg-[#E8EEFF] text-[#1845D4]' : 'text-[#444460] hover:bg-[#F5F6FA]'}`}><item.icon className="w-4 h-4" /> {item.name}</Link>
                            ))}
                        </nav>
                        <button onClick={handleSignOut} className="mt-auto w-full flex items-center justify-center gap-2 py-3 rounded-md text-[13px] font-medium text-red-600 bg-red-50">Sign Out</button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 lg:pl-60 pt-16 lg:pt-0">
                <div className="flex-1 p-8 lg:p-10 max-w-6xl mx-auto w-full">
                    {(loadingSettings || loading) ? (
                        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4"><div className="w-8 h-8 border-2 border-[#1845D4] border-t-transparent rounded-full animate-spin" /></div>
                    ) : (() => {
                        const hasAccess = (profile?.role === 'admin') || !isPayToUse || (profile?.subscriptionStatus === 'active');
                        if (!hasAccess) {
                            return (
                                <div className="min-h-[50vh] flex flex-col items-center justify-center">
                                    <div className="max-w-xs w-full bg-white border border-[#DDE0F0] rounded-xl p-8 text-center space-y-8 shadow-sm">
                                        <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mx-auto border border-blue-100 text-[#1845D4]"><Shield className="w-7 h-7" /></div>
                                        <div className="space-y-1.5"><h2 className="text-xl font-serif font-black text-[#0D0D1A]">Access Restricted</h2><p className="text-[13px] text-[#444460] font-medium leading-relaxed">Please activate your semester subscription to continue.</p></div>
                                        <div className="bg-[#F5F6FA] rounded-md p-4 flex items-center justify-between text-left border border-[#DDE0F0]"><p className="text-[9px] font-bold uppercase tracking-widest text-[#8888A8]">Semester Fee</p><p className="text-xl font-serif font-black text-[#0D0D1A]">{currency} {semesterFee}</p></div>
                                        <button onClick={handlePaySubscription} disabled={initializingSub} className="w-full py-3.5 bg-[#1845D4] hover:bg-[#0F2FA8] text-white rounded-lg font-bold text-[9px] uppercase tracking-widest shadow-lg shadow-blue-600/10 transition-all active:scale-95 disabled:opacity-50">{initializingSub ? 'Initializing...' : 'Pay Now'}</button>
                                        <p className="text-[8px] text-[#8888A8] font-bold uppercase tracking-widest">Secure Checkout via Paystack</p>
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
