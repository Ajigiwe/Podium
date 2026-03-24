'use client';

import { useState } from 'react';
import { Crown, Shield, UserPlus, UserMinus, X, Users } from 'lucide-react';
import { useClassroom } from '@/contexts/ClassroomContext';

interface CoHostManagementPanelProps {
    sessionId: string;
}

export function CoHostManagementPanel({ sessionId }: CoHostManagementPanelProps) {
    const [showPanel, setShowPanel] = useState(false);
    const {
        isHost,
        coHosts,
        participants,
        userId,
        assignCoHost,
        removeCoHost,
    } = useClassroom();

    // Only rendered for the host — bail early if not host
    if (!isHost) return null;

    // Participants eligible to become co-hosts (not self, not already a co-host)
    const eligibleParticipants = participants.filter(
        (p) =>
            !p.isLocal &&
            p.metadata?.userId !== userId &&
            !coHosts.some((ch) => ch.userId === p.metadata?.userId)
    );

    return (
        <>
            {/* Toolbar Button */}
            <button
                id="cohost-panel-toggle"
                onClick={() => setShowPanel((v) => !v)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
                title="Manage Co-Hosts"
            >
                <Crown className="w-4 h-4" />
                <span className="hidden lg:inline">Co-Hosts</span>
                {coHosts.length > 0 && (
                    <span className="bg-purple-900 text-purple-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {coHosts.length}
                    </span>
                )}
            </button>

            {/* Panel */}
            {showPanel && (
                <div className="fixed top-20 right-4 z-[150] w-80 bg-gray-900 rounded-lg shadow-2xl border border-purple-600/30 flex flex-col max-h-[70vh] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-800">
                        <h3 className="text-white font-bold flex items-center gap-2 text-sm">
                            <Crown className="w-4 h-4 text-purple-400" />
                            Co-Host Management
                        </h3>
                        <button
                            onClick={() => setShowPanel(false)}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {/* Current Co-Hosts */}
                        {coHosts.length > 0 && (
                            <div className="p-4 border-b border-gray-800/60">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 mb-2">
                                    Active Co-Hosts ({coHosts.length})
                                </p>
                                <div className="space-y-2">
                                    {coHosts.map((ch) => (
                                        <div
                                            key={ch.userId}
                                            className="flex items-center justify-between bg-purple-600/10 border border-purple-600/20 rounded-md p-3"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-7 h-7 rounded-md bg-purple-600/30 flex items-center justify-center shrink-0">
                                                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                                                </div>
                                                <p className="text-white font-semibold text-sm truncate">
                                                    {ch.userName}
                                                </p>
                                            </div>
                                            <button
                                                id={`remove-cohost-${ch.userId}`}
                                                onClick={() => removeCoHost(ch.userId)}
                                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors shrink-0"
                                                title="Remove co-host"
                                            >
                                                <UserMinus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Assign New Co-Host */}
                        <div className="p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">
                                Assign Co-Host
                            </p>
                            {eligibleParticipants.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                    <Users className="w-8 h-8 text-gray-700 mb-2" />
                                    <p className="text-gray-500 text-xs">
                                        No eligible participants to promote
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {eligibleParticipants.map((p) => {
                                        const targetId = p.metadata?.userId || p.identity;
                                        const targetName = p.displayName || 'Unknown';
                                        return (
                                            <div
                                                key={p.participantId}
                                                className="flex items-center justify-between bg-gray-800/50 border border-gray-700 rounded-md p-3 hover:border-purple-600/40 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-7 h-7 rounded-md bg-gray-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                                        {targetName[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <p className="text-white font-medium text-sm truncate">
                                                        {targetName}
                                                    </p>
                                                </div>
                                                <button
                                                    id={`assign-cohost-${targetId}`}
                                                    onClick={() => assignCoHost(targetId, targetName)}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-md transition-colors shrink-0"
                                                >
                                                    <UserPlus className="w-3 h-3" />
                                                    Make Co-Host
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer info */}
                    <div className="p-3 bg-purple-900/20 border-t border-purple-600/20">
                        <p className="text-purple-300 text-[10px] flex items-center gap-1.5">
                            <Shield className="w-3 h-3 shrink-0" />
                            Co-hosts have full classroom control. Only you can assign them.
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
