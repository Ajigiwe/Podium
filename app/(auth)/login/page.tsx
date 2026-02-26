'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, GraduationCap, ArrowRight, KeyRound, ChevronDown, ChevronUp } from 'lucide-react';
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
                setResendMessage('Please verify your email to log in. Click here to resend the verification email.');
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
            setError(''); // Clear error message if resend is successful
        } catch (err: any) {
            setError('Failed to resend verification email. Please try again later.');
            setResendMessage(''); // Clear resend message if resend fails
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-4 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-[380px] w-full space-y-4">
                {/* Logo/Brand */}
                <div className="text-center">
                    <Link href="/" className="inline-flex items-center justify-center gap-2 mb-1 transition-transform hover:scale-105">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center border border-blue-700">
                            <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                    </Link>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                        Welcome Back
                    </h2>
                    <p className="text-gray-500 font-medium text-[13px]">
                        Enter your credentials to continue
                    </p>
                </div>

                {/* Main Login Card */}
                <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-sm">
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        {error && (
                            <div className="rounded-2xl bg-red-50 border border-red-100 p-3 animate-in fade-in slide-in-from-top-1">
                                <p className="text-[11px] text-red-600 font-bold leading-tight">{error}</p>
                                {resendMessage.includes('verify your email') && (
                                    <button
                                        type="button"
                                        onClick={handleResend}
                                        className="mt-1.5 text-[10px] text-red-600 underline hover:no-underline font-black uppercase tracking-wider block"
                                    >
                                        Resend Verification Email
                                    </button>
                                )}
                            </div>
                        )}
                        {resendMessage && !error && (
                            <div className="rounded-2xl bg-green-50 border border-green-100 p-3">
                                <p className="text-[11px] text-green-600 font-bold leading-tight">{resendMessage}</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label htmlFor="email" className="block text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1 ml-1">
                                    Email Address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-100 focus:border-blue-600 text-gray-900 rounded-xl focus:outline-none transition-all text-sm placeholder:text-gray-300"
                                    placeholder="name@example.com"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1 ml-1">
                                    <label htmlFor="password" className="block text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                                        Password
                                    </label>
                                    <Link href="/forgot-password" title="Reset Password" className="text-[9px] font-bold text-gray-400 hover:text-blue-600 transition-colors">
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
                                        className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-100 focus:border-blue-600 text-gray-900 rounded-xl focus:outline-none transition-all text-sm pr-12 placeholder:text-gray-300"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm shadow-md shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50 mt-1"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Sign In'}
                        </button>
                    </form>
                </div>

                {/* Bottom Actions Row */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="bg-white border border-gray-200 hover:border-blue-600 text-gray-900 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-50 group hover:text-blue-600"
                    >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Google
                    </button>

                    <Link
                        href="/register"
                        className="bg-white border border-gray-200 hover:border-blue-600 text-gray-900 flex items-center justify-center py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98] hover:text-blue-600"
                    >
                        Register &rarr;
                    </Link>
                </div>
            </div>
        </div>
    );
}
