'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/users');
    }, [router]);
    return (
        <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#1845D4] border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
