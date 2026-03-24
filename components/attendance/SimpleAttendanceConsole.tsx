'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Zap,
    Download,
    Play,
    CheckCircle2,
    RefreshCw,
    Clock,
    Settings,
    ChevronDown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';

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
    const [showSettings, setShowSettings] = useState(false);
    const [autoVerify, setAutoVerify] = useState(false);
    const [frequency, setFrequency] = useState(15); // Default 15 mins
    const [lastAutoTrigger, setLastAutoTrigger] = useState(0);

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
            console.error('[Attendance:Console:FetchStatus] Error fetching attendance status:', error);
        }
    }, [sessionId]);

    useEffect(() => {
        if (!isActive) return;
        fetchStatus();

        // Subscribe to session for auto-attendance settings
        const sessionRef = doc(db, 'sessions', sessionId);
        const unsubscribe = onSnapshot(sessionRef, (doc) => {
            const data = doc.data();
            if (data?.autoAttendanceSettings) {
                setAutoVerify(!!data.autoAttendanceSettings.isEnabled);
                setFrequency(data.autoAttendanceSettings.frequencyMinutes ?? 15);
                setLastAutoTrigger(data.autoAttendanceSettings.lastTriggeredAt?.toMillis() || 0);
            }
        }, (error) => {
            console.error('[Attendance:Console] Error listening to session:', error);
        });

        return () => unsubscribe();
    }, [isActive, sessionId, fetchStatus]);

    useEffect(() => {
        if (!stats?.startedAt) return;
        const updateElapsed = () => {
            const now = Date.now();
            const elapsed = Math.floor((now - stats.startedAt!) / 60000);
            setMinutesElapsed(elapsed);

            // Auto-trigger logic
            if (autoVerify && elapsed > 0) {
                const nextTrigger = lastAutoTrigger > 0
                    ? lastAutoTrigger + (frequency * 60000)
                    : stats.startedAt! + (frequency * 60000);

                if (now >= nextTrigger && !isTriggering) {
                    console.log(`Auto-triggering verification at ${elapsed}m`);
                    triggerManualCheck('automatic');
                    // We update lastAutoTrigger in Firestore inside triggerManualCheck logic if possible,
                    // or here locally then Firestore.
                }
            }
        };
        updateElapsed();
        const interval = setInterval(updateElapsed, 10000); // Check more frequently for auto-trigger
        return () => clearInterval(interval);
    }, [stats?.startedAt, autoVerify, frequency, lastAutoTrigger, isTriggering]);

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

    const triggerManualCheck = async (type: 'manual' | 'automatic' = 'manual') => {
        setIsTriggering(true);
        try {
            const response = await fetch('/api/attendance/verification/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, triggeredBy: type })
            });
            if (response.ok) {
                // Update persistent last trigger time
                const sessionRef = doc(db, 'sessions', sessionId);
                await updateDoc(sessionRef, {
                    'autoAttendanceSettings.lastTriggeredAt': new Date()
                });
                await fetchStatus();
            }
        } catch (error) {
            console.error('[Attendance:Console:Trigger] Error triggering check:', error);
        } finally {
            setIsTriggering(false);
        }
    };

    const toggleAutoAttendance = async () => {
        const newState = !autoVerify;
        setAutoVerify(newState);
        try {
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, {
                'autoAttendanceSettings.isEnabled': newState,
                'autoAttendanceSettings.frequencyMinutes': frequency
            });
        } catch (error) {
            console.error('[Attendance:Console:ToggleAuto] Error updating auto-attendance:', error);
        }
    };

    const updateFrequency = async (val: number) => {
        setFrequency(val);
        try {
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, {
                'autoAttendanceSettings.frequencyMinutes': val
            });
        } catch (error) {
            console.error('[Attendance:Console:UpdateFreq] Error updating frequency:', error);
        }
    };

    if (!isActive) return null;

    return (
        <div className="relative flex items-center gap-2 bg-gray-900 border border-white/10 rounded-full px-4 py-1.5 h-10">
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
                            onClick={() => triggerManualCheck('manual')}
                            disabled={isTriggering}
                            className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-500/20 rounded-md transition-all"
                            title="Trigger Manual Check"
                        >
                            {isTriggering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        </button>

                        <button
                            onClick={fetchStatus}
                            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all"
                            title="Refresh"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-1.5 rounded-md transition-all ${showSettings ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                                title="Auto-Attendance Settings"
                            >
                                <Settings className="w-3.5 h-3.5" />
                            </button>

                            {showSettings && (
                                <div className="absolute bottom-full right-0 mb-3 w-48 bg-gray-900 border border-white/10 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Auto-Verify</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={!!autoVerify} onChange={toggleAutoAttendance} className="sr-only peer" />
                                            <div className="w-8 h-4 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase">
                                            <span>Frequency</span>
                                            <span className="text-blue-400">{frequency}m</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="5"
                                            max="60"
                                            step="5"
                                            value={frequency ?? 15}
                                            onChange={(e) => updateFrequency(parseInt(e.target.value))}
                                            className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <p className="text-[8px] text-gray-500 leading-tight">
                                            Verification will pop up for students automatically every {frequency} minutes.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
