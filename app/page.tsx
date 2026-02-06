'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
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
  BookOpen,
  Wifi,
  MessageCircle,
  Mail
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
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled
        ? 'bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800'
        : 'bg-transparent'
        }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center">
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
                      className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Dashboard
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Link
                        href="/auth/login"
                        className="hidden sm:block text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        Log in
                      </Link>
                      <Link
                        href="/auth/register"
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
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl lg:max-w-[55%]">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-medium mb-6 sm:mb-8">
              <Wifi className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Live classes, real connections</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-gray-900 dark:text-white leading-[1.1] mb-6 sm:mb-8">
              Teach live.{' '}
              <span className="text-blue-600 dark:text-blue-400">
                Learn Live.
              </span>
              <br />
              <span className="text-gray-400 dark:text-gray-500">Simple.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-8 sm:mb-10 leading-relaxed max-w-xl">
              Ghana's virtual classroom platform. Lecturers host live classes,
              students get unlimited access with a <strong className="text-gray-900 dark:text-white">Semester Pass</strong>.
              Real-time video, chat, and learning — all in your browser.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-lg bg-blue-600 text-white font-bold text-base sm:text-lg hover:bg-blue-700 transition-colors group"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold text-base sm:text-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Log In
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-10 sm:mt-12 text-sm text-gray-500 dark:text-gray-400">
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
          <div className="mt-12 lg:absolute lg:right-8 lg:top-48 lg:w-[40%] lg:mt-0">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6">
              {/* Video preview mockup */}
              <div className="aspect-video bg-gray-900 rounded-xl relative overflow-hidden mb-4">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 flex items-center justify-center">
                    <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white ml-1" />
                  </div>
                </div>
                {/* Live badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 bg-red-500 rounded-full">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-xs font-bold">LIVE</span>
                </div>
                {/* Viewer count */}
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-gray-800 rounded-full">
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
                  <span className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">GH₵ 200</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gray-50 dark:bg-gray-900">
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
            <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-6 text-center">For Lecturers</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  step: "01",
                  icon: <GraduationCap className="w-6 h-6" />,
                  title: "Create a class",
                  description: "Set a title and go. No complex setup. Takes 30 seconds.",
                },
                {
                  step: "02",
                  icon: <Users className="w-6 h-6" />,
                  title: "Share the code",
                  description: "Send your meeting code to students. Everyone with a Semester Pass can join.",
                },
                {
                  step: "03",
                  icon: <Video className="w-6 h-6" />,
                  title: "Go live",
                  description: "Click 'Go Live' and teach. Video, chat, screen sharing included.",
                }
              ].map((item, i) => (
                <div key={i} className="relative">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 h-full border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                    <span className="text-5xl sm:text-6xl font-black text-gray-100 dark:text-gray-800 absolute top-4 right-4 sm:top-6 sm:right-6 select-none">
                      {item.step}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 sm:mb-6">
                      {item.icon}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
                      {item.title}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* For Students */}
          <div>
            <h3 className="text-lg font-bold text-green-600 dark:text-green-400 mb-6 text-center">For Students</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {[
                {
                  step: "01",
                  icon: <CreditCard className="w-6 h-6" />,
                  title: "Get Semester Pass",
                  description: "One simple payment covers all your classes for the entire semester.",
                },
                {
                  step: "02",
                  icon: <CheckCircle className="w-6 h-6" />,
                  title: "Instant access",
                  description: "Payment confirms in seconds. Access all your enrolled courses immediately.",
                },
                {
                  step: "03",
                  icon: <Video className="w-6 h-6" />,
                  title: "Join & learn",
                  description: "Enter the code from your lecturer to join live classes instantly.",
                }
              ].map((item, i) => (
                <div key={`student-${i}`} className="relative">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 h-full border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 transition-colors">
                    <span className="text-5xl sm:text-6xl font-black text-gray-100 dark:text-gray-800 absolute top-4 right-4 sm:top-6 sm:right-6 select-none">
                      {item.step}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 flex items-center justify-center mb-4 sm:mb-6">
                      {item.icon}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
                      {item.title}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
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
                <span className="text-blue-600 dark:text-blue-400">
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
                    icon: <Users className="w-5 h-5" />,
                    title: "Unlimited Access",
                    description: "Students pay once and attend unlimited classes for the entire semester."
                  },
                  {
                    icon: <Clock className="w-5 h-5" />,
                    title: "Track Attendance",
                    description: "See who joins, when they arrive, and download attendance sheets."
                  }
                ].map((feature, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
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
                  </div>
                ))}
              </div>
            </div>

            {/* Right - Testimonial */}
            <div className="bg-blue-600 rounded-2xl p-6 sm:p-8 text-white">
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
                {[1, 2, 3, 4, 5].map(i => (
                  <svg key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Stats */}
              <div className="mt-6 pt-6 border-t border-white/20">
                <p className="text-3xl sm:text-4xl font-black">300+</p>
                <p className="text-sm text-white/80">students per class</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 dark:bg-gray-800 rounded-2xl p-8 sm:p-12 md:p-16 text-center">
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
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-lg bg-blue-600 text-white font-bold text-base sm:text-lg hover:bg-blue-700 transition-colors"
              >
                Create Free Account
              </Link>
              <Link
                href="/auth/login"
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-lg bg-gray-700 border border-gray-600 text-white font-bold text-base sm:text-lg hover:bg-gray-600 transition-colors"
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-4">
            Need help? Get in touch.
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-10 max-w-lg mx-auto">
            Have questions about setting up a class? We're here to help you get started.
          </p>

          <div className="flex items-center justify-center gap-8">
            {/* WhatsApp */}
            <a
              href="https://wa.me/233550599755"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
              aria-label="Chat on WhatsApp"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center">
                <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform" />
              </div>
            </a>

            {/* Email */}
            <a
              href="mailto:minatoflash82@gmail.com"
              className="group relative"
              aria-label="Send Email"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center">
                <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">Podium</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © 2025 Podium. Made by Emmanuel Ajigiwe Atio.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
