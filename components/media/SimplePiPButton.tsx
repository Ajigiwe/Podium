'use client';

import { useState, useEffect } from 'react';
import { PictureInPicture2 } from 'lucide-react';

interface SimplePiPButtonProps {
    videoElementRef: React.RefObject<HTMLVideoElement | null>;
    className?: string;
    onPiPChange?: (active: boolean) => void;
}

export default function SimplePiPButton({ videoElementRef, className, onPiPChange }: SimplePiPButtonProps) {
    const [isPiPActive, setIsPiPActive] = useState(false);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        setIsSupported(
            typeof document !== 'undefined' &&
            document.pictureInPictureEnabled &&
            !videoElementRef.current?.disablePictureInPicture
        );

        const video = videoElementRef.current;
        if (!video) return;

        const handleEnterPiP = () => {
            setIsPiPActive(true);
            onPiPChange?.(true);
        };
        const handleLeavePiP = () => {
            setIsPiPActive(false);
            onPiPChange?.(false);
        };

        video.addEventListener('enterpictureinpicture', handleEnterPiP);
        video.addEventListener('leavepictureinpicture', handleLeavePiP);

        return () => {
            video.removeEventListener('enterpictureinpicture', handleEnterPiP);
            video.removeEventListener('leavepictureinpicture', handleLeavePiP);
        };
    }, [videoElementRef, onPiPChange]);

    const togglePiP = async () => {
        if (!videoElementRef.current) return;

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await videoElementRef.current.requestPictureInPicture();
            }
        } catch (error) {
            console.error('PiP Error:', error);
        }
    };

    if (!isSupported) return null;

    return (
        <button
            onClick={togglePiP}
            className={`p-2 rounded-lg transition-colors border-white/20 ${isPiPActive ? 'bg-blue-600 text-white' : 'bg-gray-700/80 text-white hover:bg-gray-600'
                } ${className}`}
            title={isPiPActive ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
        >
            <PictureInPicture2 className="w-4 h-4" />
        </button>
    );
}
