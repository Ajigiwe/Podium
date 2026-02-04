'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Users,
  CreditCard,
  Video,
  Shield,
  ArrowRight,
  Play,
  Smartphone,
  Zap,
  Globe,
  Clock,
  CheckCircle,
  Star,
  BookOpen,
  Wifi
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
    <div className="min-h-screen bg-[#FFFBF5] dark:bg-[#0a0a0f] overflow-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/90 dark:bg-[#0a0a0f]/90 backdrop-blur-lg shadow-sm' 
          : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Podium
              </span>
            </Link>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              
              {!loading && (
                <>
                  {user ? (
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:scale-105 transition-all shadow-lg"
                    >
                      Dashboard
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Link
                        href="/auth/login"
                        className="hidden sm:block text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                      >
                        Log in
                      </Link>
                      <Link
                        href="/auth/register"
                        className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-pink-600 text-white text-sm font-semibold hover:scale-105 transition-all shadow-lg shadow-orange-500/25"
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
      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6">
        {/* Decorative Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-orange-400/20 rounded-full blur-2xl" />
        <div className="absolute top-40 right-10 w-32 h-32 bg-pink-400/20 rounded-full blur-2xl" />
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-yellow-400/20 rounded-full blur-2xl" />
        
        <div className="max-w-6xl mx-auto relative">
          <div className="max-w-3xl lg:max-w-[55%] relative z-10">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs sm:text-sm font-medium mb-6 sm:mb-8"
            >
              <Wifi className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Live classes, real connections</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-gray-900 dark:text-white leading-[1.1] mb-6 sm:mb-8"
            >
              Teach live.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500">
                Learn Live.
              </span>
              <br />
              <span className="text-gray-400 dark:text-gray-500">Simple.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-8 sm:mb-10 leading-relaxed max-w-xl"
            >
              Ghana's virtual classroom platform. Lecturers host live paid classes, 
              students join with <strong className="text-gray-900 dark:text-white">Mobile Money</strong>. 
              Real-time video, chat, and learning — all in your browser.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4"
            >
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold text-base sm:text-lg hover:scale-105 transition-all shadow-xl shadow-orange-500/25 group"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-base sm:text-lg border-2 border-gray-200 dark:border-gray-700 hover:border-orange-500 dark:hover:border-orange-500 hover:scale-105 transition-all"
              >
                Log In
              </Link>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap items-center gap-4 sm:gap-6 mt-10 sm:mt-12 text-sm text-gray-500 dark:text-gray-400"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Free to start
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-500" />
                MTN & Vodafone MoMo
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-500" />
                No downloads needed
              </span>
            </motion.div>
          </div>

          {/* Hero Visual - Right side on desktop */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-12 lg:absolute lg:right-0 lg:top-32 lg:w-[42%] lg:mt-0"
          >
            <div className="relative">
              {/* Main card */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
                {/* Video preview mockup */}
                <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl relative overflow-hidden mb-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white ml-1" />
                    </div>
                  </div>
                  {/* Live badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 bg-red-500 rounded-full">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-bold">LIVE</span>
                  </div>
                  {/* Viewer count */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur rounded-full">
                    <Users className="w-3 h-3 text-white" />
                    <span className="text-white text-xs">47</span>
                  </div>
                </div>
                
                {/* Class info */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Advanced Mathematics</h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Prof. Mensah</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">GH₵ 20</span>
                  </div>
                </div>
              </div>

              {/* Floating notification */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 bg-green-500 text-white px-3 sm:px-4 py-2 rounded-xl shadow-lg text-xs sm:text-sm font-medium"
              >
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
                  Payment received!
                </span>
              </motion.div>

              {/* Floating student avatars */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-2 -left-2 sm:-bottom-4 sm:-left-4 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 border border-gray-100 dark:border-gray-700"
              >
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-orange-400" />
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-pink-400" />
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-400" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">+44 joined</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-4">
              How it works
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
              Whether you're teaching or learning, get started in minutes.
            </p>
          </div>

          {/* For Lecturers */}
          <div className="mb-12">
            <h3 className="text-lg font-bold text-orange-600 dark:text-orange-400 mb-6 text-center">For Lecturers</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  step: "01",
                  icon: <GraduationCap className="w-6 h-6" />,
                  title: "Create a class",
                  description: "Set a title and price (or make it free). Takes 30 seconds.",
                },
                {
                  step: "02", 
                  icon: <Users className="w-6 h-6" />,
                  title: "Share the code",
                  description: "Send your meeting code to students. They pay to get access.",
                },
                {
                  step: "03",
                  icon: <Video className="w-6 h-6" />,
                  title: "Go live",
                  description: "Click 'Go Live' and teach. Video, chat, screen sharing included.",
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative group"
                >
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-3xl p-6 sm:p-8 h-full border border-orange-100 dark:border-orange-800/30 hover:border-orange-300 dark:hover:border-orange-700 transition-colors">
                    <span className="text-5xl sm:text-6xl font-black text-orange-100 dark:text-orange-900/50 absolute top-4 right-4 sm:top-6 sm:right-6 select-none">
                      {item.step}
                    </span>
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4 sm:mb-6">
                      {item.icon}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
                      {item.title}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* For Students */}
          <div>
            <h3 className="text-lg font-bold text-pink-600 dark:text-pink-400 mb-6 text-center">For Students</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  step: "01",
                  icon: <CreditCard className="w-6 h-6" />,
                  title: "Enter code & pay",
                  description: "Get the meeting code from your lecturer. Pay with Mobile Money.",
                },
                {
                  step: "02", 
                  icon: <CheckCircle className="w-6 h-6" />,
                  title: "Instant access",
                  description: "Payment confirms in seconds. Class appears on your dashboard.",
                },
                {
                  step: "03",
                  icon: <Video className="w-6 h-6" />,
                  title: "Join & learn",
                  description: "Click to join when class goes live. Ask questions via chat.",
                }
              ].map((item, i) => (
                <motion.div
                  key={`student-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative group"
                >
                  <div className="bg-pink-50 dark:bg-pink-900/20 rounded-3xl p-6 sm:p-8 h-full border border-pink-100 dark:border-pink-800/30 hover:border-pink-300 dark:hover:border-pink-700 transition-colors">
                    <span className="text-5xl sm:text-6xl font-black text-pink-100 dark:text-pink-900/50 absolute top-4 right-4 sm:top-6 sm:right-6 select-none">
                      {item.step}
                    </span>
                    <div className="w-12 h-12 rounded-2xl bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center mb-4 sm:mb-6">
                      {item.icon}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
                      {item.title}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Feature List */}
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-6 sm:mb-8">
                Built for how{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">
                  Ghana teaches
                </span>
              </h2>

              <div className="space-y-4 sm:space-y-6">
                {[
                  {
                    icon: <Smartphone className="w-5 h-5" />,
                    title: "Mobile Money Built-in",
                    description: "MTN MoMo, Vodafone Cash, AirtelTigo. Students pay the way they're used to."
                  },
                  {
                    icon: <Zap className="w-5 h-5" />,
                    title: "Instant Access",
                    description: "Payment confirms in seconds. Students join your live class immediately."
                  },
                  {
                    icon: <Globe className="w-5 h-5" />,
                    title: "Works Anywhere",
                    description: "Runs in any browser. No app downloads. Works on smartphones and computers."
                  },
                  {
                    icon: <Shield className="w-5 h-5" />,
                    title: "Only Paid Students Join",
                    description: "Automatic access control. No more sharing links without payment."
                  },
                  {
                    icon: <Clock className="w-5 h-5" />,
                    title: "Track Attendance",
                    description: "See who joins, when they arrive, and download attendance sheets."
                  }
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4"
                  >
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right - Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-orange-500 to-pink-600 rounded-3xl p-6 sm:p-8 text-white">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-white/20" />
                  <div>
                    <p className="font-bold">Dr. Akua Serwaa</p>
                    <p className="text-sm text-white/80">Economics Lecturer</p>
                  </div>
                </div>
                <blockquote className="text-lg sm:text-xl font-medium mb-4 leading-relaxed">
                  "I used to struggle collecting payments from students. Now they pay before class even starts. It's changed everything."
                </blockquote>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </div>

              {/* Stats card */}
              <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl border border-gray-100 dark:border-gray-700">
                <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">300+</p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">students per class</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gray-900 dark:bg-black rounded-3xl p-8 sm:p-12 md:p-16 text-center overflow-hidden">
            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-4 sm:mb-6">
                Ready to get started?
              </h2>
              <p className="text-base sm:text-lg text-gray-400 mb-8 sm:mb-10 max-w-lg mx-auto">
                Join thousands of students and lecturers across Ghana. 
                Create your free account today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <Link
                  href="/auth/register"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold text-base sm:text-lg hover:scale-105 transition-all shadow-lg shadow-orange-500/25"
                >
                  Create Free Account
                </Link>
                <Link
                  href="/auth/login"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-white/10 border border-white/20 text-white font-bold text-base sm:text-lg hover:bg-white/20 transition-all"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">Podium</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © 2024 Podium. Made for Ghana.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
