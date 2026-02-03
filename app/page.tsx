'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import { motion, useScroll, useTransform, Variants } from 'framer-motion';
import {
  GraduationCap,
  Users,
  CreditCard,
  MessageCircle,
  Video,
  Shield,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 100], [0, 1]);
  const headerShadow = useTransform(scrollY, [0, 100], ["none", "0 4px 6px -1px rgb(0 0 0 / 0.1)"]);

  // Floating animation variants
  const floatAnimation: Variants = {
    initial: { y: 0 },
    animate: {
      y: [-20, 20, -20],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black overflow-hidden selection:bg-indigo-500 selection:text-white">
      <div className="bg-noise" />

      {/* Navigation */}
      <motion.nav
        style={{
          backgroundColor: useTransform(scrollY, [0, 100], ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.8)"]),
          backdropFilter: "blur(10px)",
          borderBottom: useTransform(scrollY, [0, 100], ["1px solid transparent", "1px solid rgba(229, 231, 235, 0.2)"]),
        }}
        className="fixed top-0 left-0 right-0 z-50 transition-colors dark:border-gray-800"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                Podium
              </span>
            </div>

            {/* Desktop Links - Only valid links */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Features
              </a>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <ThemeToggle />

              {!loading && (
                <>
                  {user ? (
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="px-6 py-2.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                      Dashboard
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Link
                        href="/auth/login"
                        className="text-sm font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        Log in
                      </Link>
                      <Link
                        href="/auth/register"
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5"
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
      </motion.nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 -z-10 w-[800px] h-[800px] bg-purple-500/20 dark:bg-purple-500/10 rounded-full blur-3xl opacity-50 mix-blend-multiply animate-blob" />
        <div className="absolute top-0 left-0 -z-10 w-[600px] h-[600px] bg-indigo-500/20 dark:bg-indigo-500/10 rounded-full blur-3xl opacity-50 mix-blend-multiply animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 -left-20 -z-10 w-[600px] h-[600px] bg-pink-500/20 dark:bg-pink-500/10 rounded-full blur-3xl opacity-50 mix-blend-multiply animate-blob animation-delay-4000" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 text-indigo-600 dark:text-indigo-300 text-sm font-medium mb-8 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>Teaching Reimagined. Learning Elevated.</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-6xl lg:text-8xl font-black tracking-tight text-gray-900 dark:text-white mb-8 leading-[0.9]"
            >
              The Virtual <br /> Classroom for <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 animate-gradient">
                Ghana's Future
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed font-light"
            >
              Experience seamless live streaming, instant mobile money payments, and interactive learning tools. Built mainly for Ghanaian education.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                href="/auth/register"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2 group"
              >
                Start Teaching Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/#features"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-sm text-gray-900 dark:text-white font-bold text-lg border border-gray-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
              >
                <Video className="w-5 h-5" />
                See Demo
              </Link>
            </motion.div>
          </div>

          {/* Floaty UI Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-24 relative"
          >
            <motion.div
              variants={floatAnimation}
              initial="initial"
              animate="animate"
              className="relative rounded-2xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl shadow-2xl p-4 md:p-8"
            >
              {/* Fake UI Header */}
              <div className="flex items-center gap-4 mb-6 border-b border-gray-100/20 dark:border-white/5 pb-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="h-6 w-32 rounded-full bg-white/20 dark:bg-white/5" />
              </div>

              {/* Fake UI Content */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <div className="aspect-video rounded-xl bg-gray-900/80 relative overflow-hidden group shadow-inner">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform cursor-pointer border border-white/10">
                        <div className="w-0 h-0 border-t-8 border-t-transparent border-l-[16px] border-l-white border-b-8 border-b-transparent ml-1" />
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500" />
                      <div className="flex-1">
                        <div className="h-3 w-24 rounded bg-white/20 mb-2" />
                        <div className="h-2 w-16 rounded bg-white/10" />
                      </div>
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">👍</div>
                        <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">❤️</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/30 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/5 h-full">
                    <div className="h-4 w-20 rounded bg-gray-200 dark:bg-white/10 mb-4" />
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 opacity-50" />
                          <div className="flex-1">
                            <div className="h-3 w-full rounded bg-gray-200 dark:bg-white/5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 border-y border-gray-100 dark:border-gray-800 bg-white/30 dark:bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: "Active Students", value: "2,000+" },
              { label: "Live Sessions", value: "500+" },
              { label: "Lecturers", value: "100+" },
              { label: "Payments Processed", value: "GH₵ 50k+" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-white dark:to-gray-400 mb-2 font-mono">
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl lg:text-6xl font-black text-gray-900 dark:text-white mb-6 tracking-tight">
              Everything you need to <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">run your digital classroom</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Podium brings together streaming, payments, and student management in one powerful platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Video className="w-8 h-8 text-indigo-500" />}
              title="HD Live Streaming"
              description="Crystal clear video quality using LiveKit integration. Screen sharing, webcams, and OBS support included."
              delay={0}
            />
            <FeatureCard
              icon={<CreditCard className="w-8 h-8 text-purple-500" />}
              title="Instant Payments"
              description="Accept Mobile Money (MTN, Vodafone, AT) and cards. Automatic access control for paid sessions."
              delay={0.1}
            />
            <FeatureCard
              icon={<MessageCircle className="w-8 h-8 text-pink-500" />}
              title="Interactive Chat"
              description="Real-time messaging with emoji reactions, role-based badges, and moderation tools."
              delay={0.2}
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8 text-green-500" />}
              title="Secure Access"
              description="Robust authentication and session management ensures only enrolled students can join."
              delay={0.3}
            />
            <FeatureCard
              icon={<Users className="w-8 h-8 text-blue-500" />}
              title="Student Management"
              description="Track attendance, manage enrollments, and view engagement statistics in real-time."
              delay={0.4}
            />
            <FeatureCard
              icon={<CheckCircle2 className="w-8 h-8 text-yellow-500" />}
              title="Automated Emails"
              description="Students receive instant confirmation emails with session details upon payment."
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden bg-gray-900 dark:bg-black border border-white/10 px-8 py-16 md:px-16 md:py-24 text-center shadow-2xl">
            {/* Background Gradients */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-blob" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 animate-blob animation-delay-2000" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight">
                Ready to elevate your teaching?
              </h2>
              <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto font-light">
                Join hundreds of lecturers using Podium to reach more students and monetize their knowledge.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/auth/register"
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-gray-900 font-bold text-lg hover:scale-105 transition-all shadow-xl"
                >
                  Get Started for Free
                </Link>
                <Link
                  href="/auth/login"
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/10 border border-white/20 text-white font-bold text-lg hover:bg-white/20 transition-all hover:scale-105 backdrop-blur-md"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white/50 dark:bg-black/50 backdrop-blur-md py-12 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">Podium</span>
            </div>
            {/* Removed inactive links for Privacy, Terms, Contact */}
            <div className="text-sm text-gray-500">
              © 2024 Podium. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      whileHover={{ y: -5 }}
      className="p-8 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl hover:shadow-indigo-500/10 transition-all group"
    >
      <div className="w-14 h-14 rounded-xl bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
