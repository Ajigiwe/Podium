'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, GraduationCap, ArrowRight } from 'lucide-react';
import { getFriendlyAuthErrorMessage } from '@/lib/firebase/auth-errors';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const redirectUrl = searchParams.get('redirect') || '/dashboard';
    const { signIn, signInWithGoogle, resendVerification } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendMessage, setResendMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setResendMessage('');
        setLoading(true);

        try {
            await signIn(email, password);
            router.push(redirectUrl);
        } catch (err: any) {
            const friendlyMessage = getFriendlyAuthErrorMessage(err);
            setError(friendlyMessage);
            if (err.message && err.message.includes('verify your email')) {
                setResendMessage('Please verify your email to log in.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setLoading(true);
        try {
            await resendVerification();
            setResendMessage('Verification email sent! Check your inbox.');
            setError('');
        } catch (err: any) {
            setError('Failed to resend verification email.');
            setResendMessage('');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);

        try {
            await signInWithGoogle();
            router.push(redirectUrl);
        } catch (err: any) {
            setError(getFriendlyAuthErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA] py-12 px-6 font-sans">
            <div className="max-w-[380px] w-full space-y-8 animate-in fade-in duration-500">
                {/* Logo */}
                <div className="text-center space-y-6">
                    <Link href="/" className="inline-flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#1845D4] flex items-center justify-center shadow-lg shadow-blue-600/20">
                            <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-serif font-black text-[#1845D4] tracking-tighter">Podium</span>
                    </Link>
                    <div className="space-y-1">
                        <h2 className="text-3xl font-serif text-[#0D0D1A] tracking-tighter">Welcome back</h2>
                        <p className="text-[#8888A8] font-bold text-[10px] uppercase tracking-widest">
                            Ghana&apos;s Premium Academic Workbench
                        </p>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white rounded-lg border border-[#DDE0F0] p-10 shadow-sm">
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {error && (
                            <div className="rounded bg-red-50 border border-red-100 p-4">
                                <p className="text-[11px] text-red-600 font-bold leading-tight">{error}</p>
                                {resendMessage.includes('verify your email') && (
                                    <button type="button" onClick={handleResend} className="mt-2 text-[10px] text-red-600 underline font-black uppercase tracking-wider block">
                                        Resend Link
                                    </button>
                                )}
                            </div>
                        )}
                        {resendMessage && !error && (
                            <div className="rounded bg-blue-50 border border-blue-100 p-4">
                                <p className="text-[11px] text-[#1845D4] font-bold leading-tight">{resendMessage}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="block text-[12px] font-bold text-[#0D0D1A]">
                                    Email Address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full px-4 py-2.5 bg-white border-2 border-[#DDE0F0] focus:border-[#1845D4] text-[#0D0D1A] rounded-md focus:outline-none transition-all text-[14px] font-medium"
                                    placeholder="e.g. kwame@tetteh.com"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center ml-0.5">
                                    <label htmlFor="password" className="block text-[12px] font-bold text-[#0D0D1A]">
                                        Password
                                    </label>
                                    <Link href="/forgot-password" title="Reset Password" className="text-[11px] font-bold text-[#1845D4] hover:underline transition-all">
                                        Forgot?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full px-4 py-2.5 bg-white border-2 border-[#DDE0F0] focus:border-[#1845D4] text-[#0D0D1A] rounded-md focus:outline-none transition-all text-[14px] font-medium pr-10"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#DDE0F0] hover:text-[#1845D4] transition-all"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3.5 bg-[#1845D4] hover:bg-[#0F2FA8] text-white rounded-md font-bold text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-blue-600/10 active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    Sign In <ArrowRight className="w-4 h-4" />
                                </span>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-[#F5F6FA] flex flex-col gap-5">
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="bg-white border-2 border-[#DDE0F0] hover:border-[#1845D4] text-[#0D0D1A] flex items-center justify-center gap-3 py-2.5 rounded-md font-bold text-[11px] uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Google Access
                        </button>

                        <p className="text-[#8888A8] font-bold text-[9px] uppercase tracking-widest text-center">
                            New to Podium? {' '}
                            <Link href="/register" className="text-[#1845D4] hover:underline transition-all">
                                Create Account
                            </Link>
                        </p>
                    </div>
                </div>
            </div >
        </div >
    );
}
