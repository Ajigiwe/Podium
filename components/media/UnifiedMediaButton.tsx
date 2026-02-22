'use client';

import { usePiPPersistence } from '@/hooks/usePiPPersistence';
import SimplePiPButton from './SimplePiPButton';
import EnhancedMobileAudio from './EnhancedMobileAudio';
import { useClassroom } from '@/contexts/ClassroomContext';

import { PhoneOff } from 'lucide-react';

export default function UnifiedMediaButton({ onLeave }: { onLeave?: () => void }) {
    const { videoRef, isPiPActive, setIsPiPActive } = usePiPPersistence();
    const { title, userName, isActive } = useClassroom();

    return (
        <div className="flex items-center gap-2">
            {/* Desktop PiP Button */}
            <div className="hidden sm:block">
                <SimplePiPButton
                    videoElementRef={videoRef}
                    onPiPChange={setIsPiPActive}
                />
            </div>

            {/* Mobile: Leave Call Red Button (Replaces Background Audio Active) */}
            <div className="sm:hidden">
                <button
                    onClick={onLeave}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span className="hidden min-[360px]:inline">LEAVE</span>
                </button>
            </div>

            {/* Always show Background Audio indicator on desktop if possible/relevant, 
                but for now we keep it simple as per instructions. */}
        </div>
    );
}
