'use client';

import { useMediaPersistence } from '@/hooks/useMediaPersistence';
import { Loader2, AlertCircle } from 'lucide-react';

export const MediaRestorationIndicator = () => {
    const { restorationStatus } = useMediaPersistence();

    if (restorationStatus === 'success') {
        return null; // Don't show anything when successful
    }

    if (restorationStatus === 'pending') {
        return (
            <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100]">
                <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Restoring camera and microphone...</span>
                </div>
            </div>
        );
    }

    if (restorationStatus === 'error') {
        return (
            <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100]">
                <div className="bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Could not restore camera/mic. Please check permissions.</span>
                </div>
            </div>
        );
    }

    return null;
};
