'use client';

import { useEffect, useState } from 'react';
import { useInstantPiP } from '@/hooks/useInstantPiP';
import { Zap, ZapOff, Maximize2, Headphones } from 'lucide-react';

export const InstantPiPManager = () => {
    // Always enabled now as per "Always-On" requirement
    const { isActive, isMobile } = useInstantPiP({ enabled: true });

    return (
        <>
            {/* Toggle Button removed - Feature is Always ON */}

            {/* Active Indicator */}
            {isActive && (
                <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-[150] animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-gradient-to-r from-blue-600/90 to-purple-600/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/20">
                        {isMobile ? (
                            <>
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                                    <Headphones className="w-5 h-5 animate-pulse" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Background Audio Active</p>
                                    <p className="text-xs opacity-90">Audio continues while you use other apps</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                                    <Maximize2 className="w-5 h-5 animate-pulse" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Picture-in-Picture Active</p>
                                    <p className="text-xs opacity-90">Video continues in floating window</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
