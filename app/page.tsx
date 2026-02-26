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
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled
        ? 'bg-white border-b border-gray-200'
        : 'bg-transparent'
        }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group transition-transform hover:scale-105">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center border border-blue-700">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black text-gray-900 tracking-tight">
                Podium
              </span>
            </Link>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {!loading && (
                <>
                  {user ? (
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Dashboard
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Link
                        href="/login"
                        className="hidden sm:block text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors"
                      >
                        Log in
                      </Link>
                      <Link
                        href="/login"
                        className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
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
      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="max-w-3xl lg:max-w-[55%]">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-bold mb-6 sm:mb-8 border border-blue-100 animate-fade-in">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
                  <Wifi className="w-3 h-3 text-white" />
                </div>
                <div className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center">
                  <Play className="w-3 h-3 text-white" />
                </div>
              </div>
              <span>Join 12,000+ students across Ghana</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.1] mb-6 tracking-tight">
              Education <br />
              <span className="text-blue-600">
                Without Limits.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-gray-600 mb-8 sm:mb-10 leading-relaxed max-w-xl font-medium">
              Ghana&apos;s most powerful virtual classroom. Built for reliability, engagement, and results. Experience <strong className="text-blue-600">zero-lag</strong> teaching with Podium.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-blue-600 text-white font-black text-lg hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-[0.98] border border-blue-700 group"
              >
                Launch Your First Class
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-gray-900 font-black text-lg border-2 border-gray-100 hover:bg-gray-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Learn More
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-10 sm:mt-12 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Free to start
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-600" />
                MTN & Vodafone MoMo
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-600" />
                No downloads needed
              </span>
            </div>
          </div>

          {/* Hero Visual - Right side on desktop */}
          <div className="mt-12 lg:absolute lg:right-4 lg:top-40 lg:w-[45%] lg:mt-0">
            <div className="bg-white rounded-3xl border border-gray-200 p-4 sm:p-6 overflow-hidden relative">

              {/* Video preview mockup with current features */}
              <div className="aspect-video bg-gray-950 rounded-2xl relative overflow-hidden mb-6 ring-1 ring-gray-800">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="grid grid-cols-2 grid-rows-2 gap-2 p-2 w-full h-full opacity-60">
                    <div className="bg-gray-800 rounded-lg animate-pulse" />
                    <div className="bg-gray-900 rounded-lg animate-pulse" />
                    <div className="bg-gray-900 rounded-lg animate-pulse" />
                    <div className="bg-gray-800 rounded-lg animate-pulse" />
                  </div>
                  <div className="absolute w-20 h-20 rounded-full bg-blue-600/20 flex items-center justify-center animate-ping" />
                  <div className="absolute w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center border-4 border-blue-700">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </div>

                {/* Reaction Overlay Simulation */}
                <div className="absolute bottom-16 right-4 flex flex-col gap-2">
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center animate-float-up border border-white/10">
                    <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center animate-float-up animation-delay-500 border border-white/10">
                    <Smile className="w-5 h-5 text-yellow-500" />
                  </div>
                </div>

                {/* Live badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">Live Room</span>
                </div>

                {/* Attendance Marker Simulation */}
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-green-600 rounded-full border border-green-500">
                  <Fingerprint className="w-3 h-3 text-white" />
                  <span className="text-white text-[10px] font-black">72% Verified</span>
                </div>

                {/* Control bar mockup */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-12 bg-black/60 border border-white/20 rounded-2xl flex items-center justify-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-800" />
                  <div className="w-8 h-8 rounded-full bg-gray-800" />
                  <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center border border-yellow-600"><Hand className="w-4 h-4 text-black" /></div>
                  <div className="w-8 h-8 rounded-full bg-red-600" />
                </div>
              </div>

              {/* Class info */}
              <div className="flex items-center justify-between px-2">
                <div>
                  <h3 className="font-black text-gray-900 text-base sm:text-lg">Real-time Advanced Physics</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs sm:text-sm text-gray-500 font-bold uppercase tracking-widest">DR. KWAME TETTEH</p>
                    <div className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span className="flex items-center gap-1 text-blue-600 text-xs font-black">
                      <Users className="w-3 h-3" /> 1420 ONLINE
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>





      {/* Footer */}
      <footer className="py-12 sm:py-20 px-4 sm:px-6 border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-gray-100 gap-4">
            <p className="text-sm font-black text-blue-600/40 uppercase tracking-[0.2em]">
              PODIUM CLASSROOM &copy; 2026
            </p>
            <div className="flex gap-6">
              <Share2 className="w-5 h-5 text-gray-400 cursor-pointer hover:text-blue-600 transition-colors" />
              <Globe className="w-5 h-5 text-gray-400 cursor-pointer hover:text-blue-600 transition-colors" />
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Contact Widgets */}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-row-reverse gap-3">
        {/* WhatsApp Widget */}
        <a
          href="https://wa.me/233550599755"
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-green-600 hover:scale-110 hover:-translate-y-1 active:scale-95 transition-all group relative"
          aria-label="Chat on WhatsApp"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute bottom-full mb-4 right-0 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-800">
            Chat on WhatsApp
          </span>
        </a>

        {/* Email Widget */}
        <a
          href="mailto:minatoflash82@gmail.com"
          className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-blue-600 hover:scale-110 hover:-translate-y-1 active:scale-95 transition-all group relative"
          aria-label="Send Email"
        >
          <Mail className="w-6 h-6" />
          <span className="absolute bottom-full mb-4 right-0 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-800">
            Send Email
          </span>
        </a>
      </div>
    </div>
  );
}
