'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  GraduationCap,
  Users,
  Video,
  ArrowRight,
  Play,
  Smartphone,
  Zap,
  Globe,
  CheckCircle,
  Wifi,
  MessageCircle,
  Mail,
  Hand,
  History as HistoryIcon,
  Fingerprint,
  Smile,
  Heart,
  Share2
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
        ? 'bg-white border-b border-slate-200 py-3 shadow-sm'
        : 'bg-transparent py-5'
        }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                Podium
              </span>
            </Link>

            {/* Actions */}
            <div className="flex items-center gap-6">
              {!loading && (
                <>
                  {user ? (
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors active:scale-95"
                    >
                      Dashboard
                    </button>
                  ) : (
                    <div className="flex items-center gap-6">
                      <Link
                        href="/login"
                        className="hidden sm:block text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors"
                      >
                        Log in
                      </Link>
                      <Link
                        href="/login"
                        className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-black transition-colors active:scale-95"
                      >
                        Get Started
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 lg:pt-48 lg:pb-40">

        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10">
              {/* Badge */}
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-50 border border-blue-100">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                </span>
                <span className="text-sm font-black text-blue-700 tracking-wide uppercase">Used by 12k+ Ghana Students</span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl lg:text-7xl xl:text-8xl font-black text-slate-900 leading-[1.05] tracking-tight">
                Education <br />
                <span className="text-blue-600">
                  Without Limits.
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl lg:text-2xl text-slate-600 leading-relaxed font-medium max-w-xl">
                Ghana&apos;s premium virtual classroom. Built for speed, deep engagement, and absolute reliability.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-5 pt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-xl bg-blue-600 text-white font-black text-xl hover:bg-blue-700 transition-colors group"
                >
                  Start Teaching Now
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1.5 transition-transform" />
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-xl bg-white text-slate-900 font-black text-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  See Demo
                </Link>
              </div>

              {/* Trust markers */}
              <div className="flex flex-wrap items-center gap-8 pt-6">
                <div className="space-y-1">
                  <p className="text-2xl font-black text-slate-900 tracking-tight">4.9/5</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Student Rating</p>
                </div>
                <div className="w-px h-10 bg-slate-200" />
                <div className="space-y-1">
                  <p className="text-2xl font-black text-slate-900 tracking-tight">99.9%</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Uptime Record</p>
                </div>
                <div className="w-px h-10 bg-slate-200" />
                <div className="space-y-1">
                  <p className="text-2xl font-black text-slate-900 tracking-tight">LOW DATA</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Adaptive Streaming</p>
                </div>
              </div>
            </div>

            {/* Hero Visual Block */}
            <div className="relative lg:mt-0 animate-in fade-in slide-in-from-right-8 duration-1000">
              <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md border border-slate-200 relative overflow-hidden group">
                {/* Classroom Mockup */}
                <div className="aspect-[4/3] bg-slate-950 rounded-xl relative overflow-hidden">
                  {/* Grid overlay */}
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-3 p-3 opacity-40">
                    <div className="bg-slate-800 rounded-2xl" />
                    <div className="bg-slate-900 rounded-2xl" />
                    <div className="bg-slate-900 rounded-2xl" />
                    <div className="bg-slate-800 rounded-2xl" />
                  </div>

                  {/* Floating Elements */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center border-8 border-white animate-pulse">
                      <Play className="w-8 h-8 text-white fill-white ml-1.5" />
                    </div>
                  </div>

                  {/* Top Bar Mockup */}
                  <div className="absolute top-6 left-6 right-6 flex justify-between items-center">
                    <div className="flex items-center gap-3 px-4 py-2 bg-red-600 rounded-full shadow-lg">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      <span className="text-white text-[10px] font-black uppercase tracking-widest">LIVE CLASS</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-700" />
                        ))}
                      </div>
                      <span className="text-white text-xs font-bold">+1.4k</span>
                    </div>
                  </div>

                  {/* Reaction Simulation */}
                  <div className="absolute bottom-10 right-8 flex flex-col gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 animate-bounce">
                      <Heart className="w-6 h-6 text-red-500 fill-red-500" />
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                      <Smile className="w-6 h-6 text-yellow-500" />
                    </div>
                  </div>
                </div>

                {/* Info Overlay */}
                <div className="mt-8 px-2 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 leading-none">Advanced Mathematics</h3>
                      <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest">Professor Samuel Mensah</p>
                    </div>
                    <div className="px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                      <span className="text-blue-600 font-bold text-sm">Session #104</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-1.5 flex-1 bg-blue-600 rounded-full" />
                    <div className="h-1.5 w-1/4 bg-slate-100 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 lg:py-32 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <span className="text-3xl font-black text-white tracking-tight">Podium</span>
              </div>
              <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-sm">
                Transforming the educational landscape of Ghana through technology.
              </p>
            </div>
            <div className="flex flex-wrap gap-10 md:justify-end">
              <div className="space-y-4">
                <p className="text-white font-black uppercase tracking-widest text-xs">Contact</p>
                <ul className="space-y-2 text-slate-400 font-bold text-sm">
                  <li>support@podium.com</li>
                  <li>+233 550 599 755</li>
                </ul>
              </div>
              <div className="space-y-4">
                <p className="text-white font-black uppercase tracking-widest text-xs">Social</p>
                <div className="flex gap-4">
                  <Share2 className="w-6 h-6 text-slate-400 hover:text-blue-500 cursor-pointer transition-colors" />
                  <Globe className="w-6 h-6 text-slate-400 hover:text-blue-500 cursor-pointer transition-colors" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-10 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">
              &copy; 2026 Podium Technologies. All rights reserved.
            </p>
            <div className="flex gap-8 text-slate-500 text-sm font-bold uppercase tracking-widest">
              <span className="hover:text-blue-500 cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-blue-500 cursor-pointer transition-colors">Terms</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Branded Widgets */}
      <div className="fixed bottom-8 right-8 z-[60] flex flex-col gap-4">
        {/* WhatsApp Branded */}
        <a
          href="https://wa.me/233550599755"
          target="_blank"
          rel="noopener noreferrer"
          className="w-14 h-14 rounded-xl bg-white shadow-md border border-slate-200 flex items-center justify-center text-[#25D366] hover:scale-110 active:scale-95 transition-all group"
        >
          <MessageCircle className="w-7 h-7 fill-current" />
          <span className="absolute right-full mr-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 tracking-widest uppercase">
            WhatsApp Support
          </span>
        </a>

        {/* Support Portal */}
        <a
          href="mailto:minatoflash82@gmail.com"
          className="w-14 h-14 rounded-xl bg-blue-600 shadow-md flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all group"
        >
          <Mail className="w-7 h-7" />
          <span className="absolute right-full mr-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 tracking-widest uppercase">
            Email Center
          </span>
        </a>
      </div>
    </div>
  );
}
