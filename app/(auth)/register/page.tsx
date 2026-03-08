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
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-[420px] w-full space-y-8">
                {/* Logo/Brand */}
                <div className="text-center space-y-4">
                    <Link href="/" className="inline-flex items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
                            <GraduationCap className="w-7 h-7 text-white" />
                        </div>
                    </Link>
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                            Create Account
                        </h2>
                        <p className="text-slate-500 font-bold text-sm">
                            Join Ghana&apos;s most powerful classroom
                        </p>
                    </div>
                </div>

                {/* Register Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-8">
                    <div className="space-y-6">
                        {error && (
                            <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                                <p className="text-xs text-red-600 font-bold leading-tight">{error}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex-shrink-0 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900">Verified Access</h4>
                                    <p className="text-xs text-slate-500 mt-1">Secure onboarding via Google. No extra passwords needed.</p>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleGoogleSignUp()}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-3.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="currentColor" className="opacity-80" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="currentColor" className="opacity-80" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="currentColor" className="opacity-80" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Register with Google
                                    <ArrowRight className="w-5 h-5 opacity-70 group-hover:translate-x-1.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>

                    <div className="pt-6 border-t border-slate-100 text-center">
                        <span className="text-sm text-slate-400">Already have an account?</span>
                        <br />
                        <Link href="/login" className="inline-block mt-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                            Sign In &rarr;
                        </Link>
                    </div>
                </div>

                {/* Footer Links */}
                <div className="flex justify-center gap-8 pt-2">
                    <Link href="/terms" className="text-xs text-slate-400 hover:text-blue-600 transition-colors">Terms of Service</Link>
                    <Link href="/privacy" className="text-xs text-slate-400 hover:text-blue-600 transition-colors">Privacy Policy</Link>
                </div>
            </div>
        </div>
    );
}
