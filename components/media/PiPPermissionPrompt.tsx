'use client';

import { useState, useEffect } from 'react';
import { Maximize2, X, Sparkles } from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';

export const PiPPermissionPrompt = () => {
    const [showPrompt, setShowPrompt] = useState(false);
    // Read the persisted value in a lazy initializer rather than syncing it in an
    // effect. Safe for SSR because showPrompt starts false, so the server and the
    // initial client render both produce null regardless of this value.
    const [hasPermission, setHasPermission] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('podium_pip_permission_granted') === 'true';
    });
    const { showAlert } = useAlert();

    useEffect(() => {
        // Check if user has already granted permission
        const granted = localStorage.getItem('podium_pip_permission_granted');

        if (!granted && typeof document !== 'undefined' && 'pictureInPictureEnabled' in document) {
            // Show prompt after 5 seconds to not overwhelm
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, []);

    const requestPermission = async () => {
        try {
            // Find any video element
            const video = document.querySelector('video');

            if (video && video.readyState >= 2) {
                // Prime the video with autoPictureInPicture so browser handles minimize
                if ('autoPictureInPicture' in video) {
                    (video as any).autoPictureInPicture = true;
                }

                // Try to enter and exit PiP to establish permission
                await video.requestPictureInPicture();
                await document.exitPictureInPicture();

                localStorage.setItem('podium_pip_permission_granted', 'true');
                setHasPermission(true);
                setShowPrompt(false);
            } else {
                // Video not ready yet or not found, try to search for any LiveKit video
                const lkVideos = document.querySelectorAll('.lk-participant-media-video video');
                if (lkVideos.length > 0) {
                    const lkVideo = lkVideos[0] as HTMLVideoElement;

                    if ('autoPictureInPicture' in lkVideo) {
                        (lkVideo as any).autoPictureInPicture = true;
                    }

                    if (lkVideo.readyState >= 2) {
                        await lkVideo.requestPictureInPicture();
                        await document.exitPictureInPicture();
                        localStorage.setItem('podium_pip_permission_granted', 'true');
                        setHasPermission(true);
                        setShowPrompt(false);
                        return;
                    }
                }
                showAlert("Please ensure your camera or a shared screen is visible to enable Instant PiP.", "info");
            }
        } catch (error) {
            console.log('PiP permission flow:', error);
            // Still mark as attempted
            localStorage.setItem('podium_pip_permission_granted', 'attempted');
            setShowPrompt(false);
        }
    };

    const dismiss = () => {
        localStorage.setItem('podium_pip_permission_granted', 'dismissed');
        setShowPrompt(false);
    };

    if (!showPrompt || hasPermission) return null;

    return (
        <div className="fixed bottom-24 right-6 z-[200] max-w-sm animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-5 rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 backdrop-blur-sm">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-md flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-yellow-300" />
                        </div>
                        <p className="font-black text-lg tracking-tight">Instant PiP</p>
                    </div>
                    <button onClick={dismiss} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 opacity-70" />
                    </button>
                </div>

                <p className="text-sm mb-5 leading-relaxed opacity-90 font-medium">
                    Stay focused even when you switch tabs! We&apos;ll open a floating window automatically when you minimize.
                </p>

                <button
                    onClick={requestPermission}
                    className="w-full bg-white text-indigo-600 font-bold py-3 px-4 rounded-md hover:bg-indigo-50 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                    <Maximize2 className="w-4 h-4" />
                    Enable Now
                </button>
            </div>
        </div>
    );
};
