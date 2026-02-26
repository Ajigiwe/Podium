'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { getFriendlyAuthErrorMessage } from '@/lib/firebase/auth-errors';

export default function RegisterPage() {
    const router = useRouter();
    const { signInWithGoogle } = useAuth();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleSignUp = async () => {
        setError('');
        setLoading(true);

        try {
            await signInWithGoogle();
            router.push('/dashboard');
        } catch (err: any) {
            setError(getFriendlyAuthErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-[380px] w-full space-y-4">
                {/* Logo/Brand */}
                <div className="text-center">
                    <Link href="/" className="inline-flex items-center justify-center gap-2 mb-1 transition-transform hover:scale-105">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center border border-blue-700">
                            <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                    </Link>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                        Join Podium
                    </h2>
                    <p className="text-gray-500 font-medium text-[13px]">
                        Start your learning journey today
                    </p>
                </div>

                {/* Register Card */}
                <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 relative overflow-hidden shadow-sm">
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
                        <Sparkles className="w-32 h-32 text-blue-500" />
                    </div>

                    <div className="space-y-6 relative z-10">
                        {error && (
                            <div className="rounded-2xl bg-red-50 border border-red-100 p-3 animate-in fade-in slide-in-from-top-1">
                                <p className="text-[11px] text-red-600 font-bold leading-tight">{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex-shrink-0 flex items-center justify-center border border-blue-700 shadow-sm shadow-blue-100">
                                    <ShieldCheck className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-[13px] font-bold text-gray-900">One-Click Onboarding</h4>
                                    <p className="text-[11px] text-gray-500 mt-0.5">Secure verification via Google. Simple and instant.</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleGoogleSignUp()}
                                disabled={loading}
                                className="w-full group relative flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl text-base font-black text-white active:scale-[0.98] transition-all duration-300 border border-blue-700 shadow-md shadow-blue-100"
                            >
                                {loading ? (
                                    <div className="w-6 h-6 border-3 border-blue-200 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="currentColor" className="opacity-80" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="currentColor" className="opacity-80" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="currentColor" className="opacity-80" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        Register Now
                                        <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="pt-4 border-t border-gray-100 text-center">
                            <span className="text-[13px] text-gray-500 font-medium">Already using Podium?</span>
                            <br />
                            <Link href="/login" className="inline-block mt-2 text-sm font-black text-blue-600 hover:underline transition-colors">
                                Sign in to your account &rarr;
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Footer Links */}
                <div className="flex justify-center gap-6 pt-2">
                    <Link href="/terms" className="text-[10px] font-bold text-gray-400 hover:text-blue-600 transition-colors uppercase tracking-widest">Terms</Link>
                    <Link href="/privacy" className="text-[10px] font-bold text-gray-400 hover:text-blue-600 transition-colors uppercase tracking-widest">Privacy</Link>
                </div>
            </div>
        </div>
    );
}
