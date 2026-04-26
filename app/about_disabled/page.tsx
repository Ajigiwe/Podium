'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    GraduationCap,
    Fingerprint,
    Smile,
    Video,
    Zap,
    History as HistoryIcon,
    Smartphone,
    ArrowRight,
    ChevronLeft
} from 'lucide-react';

export default function AboutPage() {
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${scrolled ? 'bg-white border-b border-gray-100' : 'bg-transparent'
                }`}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="flex justify-between items-center h-16 sm:h-20">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center border border-blue-700">
                                <GraduationCap className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-black text-gray-900 tracking-tight">Podium</span>
                        </Link>
                        <Link href="/" className="text-sm font-bold text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                            Back to Home
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-16 px-4 sm:px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-6 tracking-tight">
                        Designed for the <span className="text-blue-600">Modern Classroom.</span>
                    </h1>
                    <p className="text-lg text-gray-500 font-medium max-w-2xl mx-auto leading-relaxed">
                        Podium is built from the ground up to solve the unique challenges of large-scale virtual education. We focus on reliability, engagement, and automated management.
                    </p>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 px-4 sm:px-6 border-t border-gray-50">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
                        {[
                            {
                                icon: <Fingerprint className="w-6 h-6" />,
                                title: "Smart Attendance",
                                description: "Trigger 30-second verification prompts that ensure students are actually present and engaged during the session."
                            },
                            {
                                icon: <Smile className="w-6 h-6" />,
                                title: "Live Reactions",
                                description: "Real-time emoji reactions that float across the screen, allowing students to express themselves without interrupting."
                            },
                            {
                                icon: <Video className="w-6 h-6" />,
                                title: "Dynamic Grid",
                                description: "Optimized video layouts that handle up to 400+ participants with zero lag, perfect for large university lectures."
                            },
                            {
                                icon: <Zap className="w-6 h-6" />,
                                title: "Crystal Clear Sharing",
                                description: "High-performance screen sharing at 1080p, ensuring slides and technical demos look sharp for every student."
                            },
                            {
                                icon: <HistoryIcon className="w-6 h-6" />,
                                title: "Detailed Session Logs",
                                description: "Automated history of attendance, participation duration, and verification status for every student in the room."
                            },
                            {
                                icon: <Smartphone className="w-6 h-6" />,
                                title: "Data Optimized Engine",
                                description: "Smart quality scaling that dynamically adjusts to save data for students using limited mobile bundles."
                            }
                        ].map((feature, i) => (
                            <div key={i} className="flex flex-col gap-5">
                                <div className="w-12 h-12 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                                    {feature.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-2 text-lg">
                                        {feature.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 px-4 sm:px-6 bg-gray-50 border-t border-gray-100">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-3xl font-black text-gray-900 mb-6">Ready to experience Podium?</h2>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            href="/login"
                            className="w-full sm:w-auto px-8 py-4 rounded-md bg-blue-600 text-white font-black hover:bg-blue-700 transition-all border border-blue-700"
                        >
                            Get Started for Free
                        </Link>
                        <Link
                            href="/"
                            className="w-full sm:w-auto px-8 py-4 rounded-md bg-white text-gray-900 font-black border border-gray-200 hover:bg-gray-50 transition-all"
                        >
                            Back Home
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-6 px-4 sm:px-6 border-t border-gray-100 bg-white">
                <div className="max-w-6xl mx-auto text-center">
                    <p className="text-xs font-black text-gray-300 uppercase tracking-[0.2em]">
                        PODIUM CLASSROOM &copy; 2026
                    </p>
                </div>
            </footer>
        </div>
    );
}
