'use client';

import { useState, useEffect } from 'react';
import { useAttendanceVerification } from '@/hooks/useAttendanceVerification';
import { CheckCircle, AlertTriangle, Clock, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface StudentVerificationModalProps {
    sessionId: string;
}

export const StudentVerificationModal = ({ sessionId }: StudentVerificationModalProps) => {
    const {
        activeVerification,
        respondToVerification,
        isResponding,
        dismissVerification
    } = useAttendanceVerification(sessionId);

    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        if (!activeVerification) {
            setIsVerified(false);
            return;
        }

        const timer = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((activeVerification.expiresAt - now) / 1000));
            setTimeLeft(remaining);

            if (remaining === 0) {
                clearInterval(timer);
                // Don't auto-dismiss if they already verified but message is still showing
                if (!isVerified) {
                    dismissVerification();
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [activeVerification, isVerified, dismissVerification]);

    const handleVerify = async () => {
        const success = await respondToVerification();
        if (success) {
            setIsVerified(true);
            // Show success for 2 seconds then dismiss
            setTimeout(() => {
                dismissVerification();
                setIsVerified(false);
            }, 2000);
        }
    };

    if (!activeVerification) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-500" />

            <div className="relative bg-[#0F172A] border border-blue-500/20 rounded-[2.5rem] p-10 max-w-md w-full shadow-[0_0_50px_-12px_rgba(59,130,246,0.5)] animate-in zoom-in duration-300">
                {isVerified ? (
                    <div className="text-center py-8 animate-in zoom-in duration-300">
                        <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
                            <CheckCircle2 className="w-12 h-12 text-green-500" />
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">Verified!</h2>
                        <p className="text-gray-400 font-medium">Your attendance has been recorded.</p>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-10">
                            <div className="relative w-24 h-24 mx-auto mb-6">
                                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                                <div className="relative w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500/30">
                                    <ShieldCheck className="w-12 h-12 text-blue-500" />
                                </div>
                            </div>
                            <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
                                Attendance Check
                            </h2>
                            <p className="text-gray-400 font-medium leading-relaxed">
                                Verification <span className="text-blue-400">#{activeVerification.verificationNumber}</span> is active.
                                Please confirm your presence now.
                            </p>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Time Remaining</span>
                                {timeLeft < 10 && (
                                    <span className="text-[10px] font-bold text-red-500 animate-pulse uppercase">Urgent</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <Clock className={`w-6 h-6 ${timeLeft < 10 ? 'text-red-500 animate-bounce' : 'text-blue-500'}`} />
                                <span className={`text-4xl font-black tabular-nums tracking-tighter ${timeLeft < 10 ? 'text-red-500' : 'text-white'}`}>
                                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </span>
                            </div>
                            <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ${timeLeft < 10 ? 'bg-red-500' : 'bg-blue-600'}`}
                                    style={{ width: `${(timeLeft / activeVerification.timeLimitSeconds) * 100}%` }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleVerify}
                            disabled={isResponding || timeLeft === 0}
                            className={`w-full font-black py-5 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 text-lg ${timeLeft < 10
                                    ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/40'
                                } text-white`}
                        >
                            {isResponding ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle className="w-6 h-6" />
                                    I AM PRESENT
                                </>
                            )}
                        </button>

                        <p className="mt-6 text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest opacity-60">
                            Podium Anti-Cheat Protection Active
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};
