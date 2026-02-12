'use client';

import { usePiPPersistence } from '@/hooks/usePiPPersistence';
import SimplePiPButton from './SimplePiPButton';
import EnhancedMobileAudio from './EnhancedMobileAudio';
import { useClassroom } from '@/contexts/ClassroomContext';

export default function UnifiedMediaButton() {
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

            {/* Mobile Audio & Persistence Banner (Subtle indicator) */}
            <div className="sm:hidden">
                <EnhancedMobileAudio
                    title={title || 'Classroom'}
                    userName={userName || 'User'}
                    isActive={isActive}
                />
            </div>

            {/* Always show Background Audio indicator on desktop if possible/relevant, 
                but for now we keep it simple as per instructions. */}
        </div>
    );
}
