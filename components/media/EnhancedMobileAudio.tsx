'use client';

import { useEffect, useState, useCallback } from 'react';
import { Headset, Smartphone } from 'lucide-react';

interface EnhancedMobileAudioProps {
    title: string;
    userName: string;
    isActive: boolean;
}

export default function EnhancedMobileAudio({ title, userName, isActive }: EnhancedMobileAudioProps) {
    const [isAudioPersistent, setIsAudioPersistent] = useState(false);
    const [wakeLock, setWakeLock] = useState<any>(null);

    // Setup Media Session API for background audio
    const setupMediaSession = useCallback(() => {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: 'Podium Classroom',
            album: userName,
            artwork: [
                { src: '/logo.png', sizes: '96x96', type: 'image/png' },
                { src: '/logo.png', sizes: '512x512', type: 'image/png' },
            ],
        });

        // Set empty handlers to signify we are "active"
        navigator.mediaSession.setActionHandler('play', () => {
            console.log('Media session play');
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            console.log('Media session pause');
        });
    }, [title, userName]);

    // Request Wake Lock to prevent sleep on mobile
    const requestWakeLock = useCallback(async () => {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;

        try {
            const lock = await (navigator as any).wakeLock.request('screen');
            setWakeLock(lock);
            console.log('Wake Lock active');

            lock.onrelease = () => {
                console.log('Wake Lock released');
                setWakeLock(null);
            };
        } catch (err: any) {
            if (err.name !== 'NotAllowedError') {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    }, []);

    useEffect(() => {
        if (isActive) {
            setupMediaSession();
            requestWakeLock();
            setIsAudioPersistent(true);
        } else {
            if (wakeLock) {
                wakeLock.release();
            }
            setIsAudioPersistent(false);
        }

        return () => {
            if (wakeLock) {
                wakeLock.release();
            }
        };
    }, [isActive, setupMediaSession, requestWakeLock]);

    // Re-request wake lock if tab becomes visible again
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (isActive && document.visibilityState === 'visible') {
                requestWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isActive, requestWakeLock]);

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isAudioPersistent ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-400'
            }`}>
            {isAudioPersistent ? (
                <>
                    <Headset className="w-3 h-3 animate-pulse" />
                    <span>Background Audio Active</span>
                </>
            ) : (
                <>
                    <Smartphone className="w-3 h-3" />
                    <span>Mobile Optimization Off</span>
                </>
            )}
        </div>
    );
}
