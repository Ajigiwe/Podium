'use client';

import React from 'react';
import Link from 'next/link';
import { GraduationCap, ArrowRight, UserPlus, LogIn, Sparkles } from 'lucide-react';

export default function AuthSelectionPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50  py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                {/* Logo/Brand */}
                <div className="text-center">
                    <Link href="/" className="inline-flex items-center justify-center gap-2 mb-6 transition-transform hover:scale-105">
                        <div className="w-14 h-14 rounded-2xl bg-blue-600  flex items-center justify-center border border-blue-700">
                            <GraduationCap className="w-8 h-8 text-white" />
                        </div>
                    </Link>
                    <h2 className="text-4xl font-black text-gray-900  tracking-tight">
                        Podium
                    </h2>
                    <p className="mt-3 text-lg text-gray-600  font-medium">
                        The future of classroom engagement
                    </p>
                </div>

                <div className="space-y-4">
                    {/* New User Option */}
                    <Link
                        href="/register"
                        className="group relative flex flex-col p-6 bg-white  rounded-lg border-2 border-gray-100 hover:border-blue-600 transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Sparkles className="w-24 h-24 text-blue-500" />
                        </div>

                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gray-100  flex items-center justify-center">
                                <UserPlus className="w-6 h-6 text-blue-600 " />
                            </div>
                            <div className="text-left">
                                <h3 className="text-xl font-bold text-gray-900 ">I&apos;m New Here</h3>
                                <p className="text-sm text-gray-500 ">Join our growing community</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Create an Account</span>
                            <ArrowRight className="w-5 h-5 text-gray-400 transform group-hover:translate-x-1 group-hover:text-blue-600  transition-all" />
                        </div>
                    </Link>

                    {/* Existing User Option */}
                    <Link
                        href="/login"
                        className="group relative flex flex-col p-6 bg-white  rounded-3xl border-2 border-gray-100  hover:border-blue-600 transition-all duration-300"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gray-100  flex items-center justify-center">
                                <LogIn className="w-6 h-6 text-blue-600 " />
                            </div>
                            <div className="text-left">
                                <h3 className="text-xl font-bold text-gray-900 ">I Have an Account</h3>
                                <p className="text-sm text-gray-500 ">Welcome back to Podium</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-semibold text-gray-600  group-hover:text-blue-600  transition-colors">Sign In</span>
                            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600  transform group-hover:translate-x-1 transition-all" />
                        </div>
                    </Link>
                </div>

                <div className="text-center pt-8">
                    <p className="text-xs text-gray-400 ">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
}
