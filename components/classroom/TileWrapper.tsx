'use client';

import { memo, useEffect, useState } from 'react';
import { ParticipantTile, useIsSpeaking } from '@livekit/components-react';
import { useInView } from 'react-intersection-observer';
import { Track, ParticipantEvent, VideoQuality } from 'livekit-client';
import { User, Mic, MoreVertical, MicOff, Maximize2 } from 'lucide-react';
import { useClassroom } from '@/contexts/ClassroomContext';
import { ParticipantMenu } from './ParticipantMenu';

export const TileWrapper = memo(({ track, participant, onTileClick, className, ...props }: any) => {
    const { ref, inView } = useInView({
        threshold: 0,
    });

    const { isModerator, userId } = useClassroom();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const hookIsSpeaking = useIsSpeaking(participant);
    const [manualIsSpeaking, setManualIsSpeaking] = useState(participant.isSpeaking);

    // Bandwidth Optimization: Adjust video quality based on visibility
    useEffect(() => {
        if (track.publication && typeof (track.publication as any).setVideoQuality === 'function') {
            const pub = track.publication as any;
            if (inView) {
                pub.setVideoQuality(VideoQuality.HIGH);
                if (typeof pub.setSubscribed === 'function') pub.setSubscribed(true);
            } else {
                pub.setVideoQuality(VideoQuality.LOW);
                if (typeof pub.setSubscribed === 'function') pub.setSubscribed(false);
            }
        }
    }, [inView, track.publication]);

    useEffect(() => {
        const handleSpeakingChanged = (speaking: boolean) => {
            setManualIsSpeaking(speaking);
        };
        participant.on(ParticipantEvent.IsSpeakingChanged, handleSpeakingChanged);
        return () => {
            participant.off(ParticipantEvent.IsSpeakingChanged, handleSpeakingChanged);
        };
    }, [participant]);

    const isSpeaking = hookIsSpeaking || manualIsSpeaking;
    const isCameraOff = track.source === Track.Source.Camera && (track.publication?.isMuted || !participant.isCameraEnabled);

    // Metadata for Avatar
    let photoURL = null;
    try {
        if (participant.metadata) {
            const metadata = JSON.parse(participant.metadata);
            photoURL = metadata.photoURL;
        }
    } catch (e) {}

    const showMenu = isModerator && participant.identity !== userId;

    return (
        <div
            ref={ref}
            className={`h-full w-full max-w-full relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-500 ${
                isSpeaking ? 'ring-4 ring-green-500 shadow-lg shadow-green-500/20' : 'ring-1 ring-white/10'
            } ${className || ''}`}
            onClick={() => onTileClick(track)}
        >
            {inView ? (
                <ParticipantTile 
                    trackRef={track} 
                    {...props} 
                    className={`!w-full !h-full [&_video]:!object-center ${
                        track.source === Track.Source.ScreenShare ? '[&_video]:!object-contain bg-black' : '[&_video]:!object-cover'
                    }`} 
                />
            ) : (
                <div className="absolute inset-0 bg-gray-950 flex items-center justify-center">
                    <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center border border-white/5">
                        <User className="w-8 h-8 text-gray-700" />
                    </div>
                </div>
            )}

            {/* Speaking Indicator */}
            {isSpeaking && (
                <div className="absolute top-3 right-3 z-20 bg-green-500 text-black p-1.5 rounded-full shadow-lg border border-green-400 animate-pulse">
                    <Mic className="w-3.5 h-3.5" />
                </div>
            )}

            {/* Moderator Menu */}
            {showMenu && (
                <div className="absolute top-3 right-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                        className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>
                    {isMenuOpen && (
                        <ParticipantMenu
                            participant={participant}
                            closeMenu={() => setIsMenuOpen(false)}
                        />
                    )}
                </div>
            )}

            {/* Camera Off Placeholder */}
            {isCameraOff && inView && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 bg-gradient-to-br from-gray-950 to-gray-900">
                    <div className="rounded-full flex items-center justify-center overflow-hidden bg-gray-800 border-4 border-white/5 shadow-2xl transition-transform duration-500 group-hover:scale-110" style={{ width: 'min(30%, 100px)', aspectRatio: '1/1' }}>
                        {photoURL ? (
                            <img src={photoURL} alt={participant.name || 'User'} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-white font-black text-4xl">
                                {(participant.name || participant.identity || 'P')[0].toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/40 backdrop-blur-xl rounded-lg px-3 py-1.5 border border-white/5">
                        {!participant.isMicrophoneEnabled && <MicOff className="w-3.5 h-3.5 text-red-500" />}
                        <span className="text-white text-xs font-bold truncate max-w-[140px]">
                            {participant.name || participant.identity || 'Participant'}
                        </span>
                    </div>
                </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 z-10 opacity-0 hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <div className="bg-white/10 backdrop-blur-md p-3 rounded-full text-white border border-white/20 transform scale-50 group-hover:scale-100 transition-transform duration-300">
                    <Maximize2 className="w-5 h-5" />
                </div>
            </div>
        </div>
    );
});

TileWrapper.displayName = 'TileWrapper';
