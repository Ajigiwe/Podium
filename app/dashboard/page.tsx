'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardRedirect() {
    const router = useRouter();
    const { user, profile, loading } = useAuth();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/auth/login');
            } else if (profile) {
                if (profile.role === 'lecturer') {
                    router.push('/dashboard/lecturer');
                } else if (profile.role === 'admin') {
                    router.push('/admin');
                } else {
                    router.push('/dashboard/student');
                }
            }
        }
    }, [user, profile, loading, router]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 space-y-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-12">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Skeleton className="h-64 w-full rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
            </div>
        </div>
    );
}
