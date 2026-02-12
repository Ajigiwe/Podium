'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Zap,
    Download,
    Play,
    CheckCircle2,
    RefreshCw,
    Clock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SimpleAttendanceConsoleProps {
    sessionId: string;
    isActive: boolean;
}

export const SimpleAttendanceConsole = ({ sessionId, isActive }: SimpleAttendanceConsoleProps) => {
    const { user } = useAuth();
    const [isStarting, setIsStarting] = useState(false);
    const [isTriggering, setIsTriggering] = useState(false);
    const [stats, setStats] = useState<{
        status: string;
        startedAt: number | null;
        durationMinutes: number;
        expectedVerificationCount: number;
        scheduledVerifications: number[];
        triggeredCount: number;
    } | null>(null);

    const [minutesElapsed, setMinutesElapsed] = useState(0);

    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch(`/api/attendance/session/status/${sessionId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.status === 'active') {
                    setStats({
                        status: data.status,
                        startedAt: data.startedAt,
                        durationMinutes: data.durationMinutes,
                        expectedVerificationCount: data.expectedVerificationCount,
                        scheduledVerifications: data.scheduledVerifications,
                        triggeredCount: data.triggeredCount
                    });
                } else {
                    setStats(null);
                }
            }
        } catch (error) {
            console.error('Error fetching attendance status:', error);
        }
    }, [sessionId]);

    useEffect(() => {
        if (isActive) fetchStatus();
    }, [isActive, fetchStatus]);

    useEffect(() => {
        if (!stats?.startedAt) return;
        const updateElapsed = () => {
            const now = Date.now();
            const elapsed = Math.floor((now - stats.startedAt!) / 60000);
            setMinutesElapsed(elapsed);
        };
        updateElapsed();
        const interval = setInterval(updateElapsed, 30000);
        return () => clearInterval(interval);
    }, [stats?.startedAt]);

    const handleStartAttendance = async () => {
        if (!user) return;
        setIsStarting(true);
        try {
            const response = await fetch('/api/attendance/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, lecturerId: user.uid })
            });

            if (response.ok) {
                await fetchStatus();
            }
        } catch (error) {
            console.error('Error starting attendance:', error);
        } finally {
            setIsStarting(false);
        }
    };

    const triggerManualCheck = async () => {
        setIsTriggering(true);
        try {
            const response = await fetch('/api/attendance/verification/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, triggeredBy: 'manual' })
            });
            if (response.ok) {
                await fetchStatus();
            }
        } catch (error) {
            console.error('Error triggering check:', error);
        } finally {
            setIsTriggering(false);
        }
    };

    if (!isActive) return null;

    return (
        <div className="flex items-center gap-2 bg-gray-900/40 backdrop-blur-sm border border-white/5 rounded-full px-4 py-1.5 h-10 shadow-lg">
            {!stats ? (
                <button
                    onClick={handleStartAttendance}
                    disabled={isStarting}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-[10px] font-black px-3 py-1 rounded-full transition-all active:scale-[0.98]"
                >
                    {isStarting ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                        <Play className="w-3 h-3 fill-current" />
                    )}
                    START ATTENDANCE
                </button>
            ) : (
                <>
                    <div className="flex items-center gap-2 pr-2 border-r border-white/10 mr-1">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[9px] font-black text-white uppercase tracking-widest">LIVE</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 min-w-[30px] tabular-nums">
                            {stats.triggeredCount}/{stats.expectedVerificationCount}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={triggerManualCheck}
                            disabled={isTriggering}
                            className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-500/20 rounded-lg transition-all"
                            title="Trigger Manual Check"
                        >
                            {isTriggering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        </button>

                        <button
                            onClick={fetchStatus}
                            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                            title="Refresh"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
