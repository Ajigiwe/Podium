'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, GraduationCap } from 'lucide-react';
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
    const [showResend, setShowResend] = useState(false);
    const [resendMessage, setResendMessage] = useState('');
    const [role, setRole] = useState<'student' | 'lecturer'>('student');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setResendMessage('');
        setShowResend(false);
        setLoading(true);

        try {
            await signIn(email, password);
            router.push(redirectUrl);
        } catch (err: any) {
            const friendlyMessage = getFriendlyAuthErrorMessage(err);
            setError(friendlyMessage);
            if (err.message && err.message.includes('verify your email')) {
                setShowResend(true);
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
            setShowResend(false);
        } catch (err: any) {
            setError('Failed to resend verification email. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);

        try {
            await signInWithGoogle(role);
            router.push(redirectUrl);
        } catch (err: any) {
            setError(getFriendlyAuthErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                {/* Logo/Brand */}
                <div className="text-center">
                    <Link href="/" className="inline-flex items-center justify-center gap-2 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
                            <GraduationCap className="w-7 h-7 text-white" />
                        </div>
                    </Link>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Welcome back
                    </h2>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Sign in to your Podium account
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
                                {showResend && (
                                    <button
                                        type="button"
                                        onClick={handleResend}
                                        className="mt-2 text-xs text-red-600 dark:text-red-400 underline hover:no-underline"
                                    >
                                        Resend Verification Email
                                    </button>
                                )}
                            </div>
                        )}
                        {resendMessage && (
                            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                                <p className="text-sm text-green-600 dark:text-green-400 font-medium">{resendMessage}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Password
                                    </label>
                                    <Link
                                        href="/auth/forgot-password"
                                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors pr-12"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </span>
                            ) : 'Sign in'}
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">Or continue with</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                                Joining us for the first time? Select your role:
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className={`relative flex items-center justify-center px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${role === 'student' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                                    <input
                                        type="radio"
                                        name="role"
                                        value="student"
                                        checked={role === 'student'}
                                        onChange={(e) => setRole(e.target.value as 'student')}
                                        className="sr-only"
                                    />
                                    <span className={`text-sm font-medium ${role === 'student' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>Student</span>
                                </label>
                                <label className={`relative flex items-center justify-center px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${role === 'lecturer' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                                    <input
                                        type="radio"
                                        name="role"
                                        value="lecturer"
                                        checked={role === 'lecturer'}
                                        onChange={(e) => setRole(e.target.value as 'lecturer')}
                                        className="sr-only"
                                    />
                                    <span className={`text-sm font-medium ${role === 'lecturer' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>Lecturer</span>
                                </label>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Sign in with Google
                        </button>

                        <div className="text-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
                            <Link href="/auth/register" className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                                Register here
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
