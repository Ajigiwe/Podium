'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, ArrowLeft } from 'lucide-react';
import { getFriendlyAuthErrorMessage } from '@/lib/firebase/auth-errors';

export default function ForgotPasswordPage() {
    const { resetPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            await resetPassword(email);
            setMessage('Check your inbox (including spam/junk folder) for password reset instructions.');
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
                        Reset Password
                    </h2>
                    <p className="text-gray-500 font-medium text-[13px]">
                        We'll send you instructions via email
                    </p>
                </div>

                {/* Reset Card */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {error && (
                            <div className="rounded-md bg-red-50 border border-red-100 p-3 animate-in fade-in slide-in-from-top-1">
                                <p className="text-[11px] text-red-600 font-bold leading-tight">{error}</p>
                            </div>
                        )}
                        {message && (
                            <div className="rounded-2xl bg-green-50 border border-green-100 p-3">
                                <p className="text-[11px] text-green-600 font-bold leading-tight">{message}</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1.5 ml-1">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full px-4 py-3 bg-gray-50 border border-gray-100 focus:border-blue-600 text-gray-900 rounded-md focus:outline-none transition-all text-sm placeholder:text-gray-300"
                                placeholder="name@example.com"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-black text-sm shadow-md shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : 'Send Reset Link'}
                        </button>

                        <div className="text-center pt-2">
                            <Link href="/login" className="inline-flex items-center gap-2 text-[11px] font-black text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-colors">
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back to Login
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
