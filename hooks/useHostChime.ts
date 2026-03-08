'use client';

import { useCallback, useRef } from 'react';

/**
 * Generates short notification chime tones using the Web Audio API.
 * Only the host should call these — no audio files are needed.
 */
export function useHostChime() {
    const audioCtxRef = useRef<AudioContext | null>(null);

    const getAudioContext = useCallback(() => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioContext();
        }
        // Resume if suspended (browsers require user gesture first)
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    }, []);

    const playTone = useCallback((frequency: number, startTime: number, duration: number, ctx: AudioContext, volume = 0.15) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startTime);

        // Fade in and out to avoid clicks
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }, []);

    /** Two-tone ascending chime — played when someone joins */
    const playJoinChime = useCallback(() => {
        try {
            const ctx = getAudioContext();
            const now = ctx.currentTime;
            playTone(523.25, now, 0.15, ctx);        // C5
            playTone(659.25, now + 0.12, 0.2, ctx);  // E5
        } catch (e) {
            console.warn('Could not play join chime:', e);
        }
    }, [getAudioContext, playTone]);

    /** Single short tone — played when someone enables mic or camera */
    const playMediaChime = useCallback(() => {
        try {
            const ctx = getAudioContext();
            const now = ctx.currentTime;
            playTone(783.99, now, 0.12, ctx, 0.1);  // G5, quieter
        } catch (e) {
            console.warn('Could not play media chime:', e);
        }
    }, [getAudioContext, playTone]);

    return { playJoinChime, playMediaChime };
}
