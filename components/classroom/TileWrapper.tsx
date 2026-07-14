'use client';

import { memo, useEffect, useState } from 'react';
import { ParticipantTile, useIsSpeaking } from '@livekit/components-react';
import { useInView } from 'react-intersection-observer';
import { Track, ParticipantEvent, VideoQuality } from 'livekit-client';
import { User, Mic, MoreVertical, MicOff, Maximize2 } from 'lucide-react';
import { useClassroom } from '@/contexts/ClassroomContext';
import { ParticipantMenu } from './ParticipantMenu';

export const TileWrapper = memo(({ track, participant, onTileClick, className, ...props }: any) => {
    const { ref, inView } = useInView({ threshold: 0 });
    const { isModerator, userId } = useClassroom();
    const [menuOpen, setMenuOpen] = useState(false);
    const hookSpeaking = useIsSpeaking(participant);
    const [rawSpeaking, setRawSpeaking] = useState(participant.isSpeaking);

    useEffect(() => {
        if (track.publication && typeof (track.publication as any).setVideoQuality === 'function') {
            const pub = track.publication as any;
            pub.setVideoQuality(inView ? VideoQuality.HIGH : VideoQuality.LOW);
            if (typeof pub.setSubscribed === 'function') pub.setSubscribed(!!inView);
        }
    }, [inView, track.publication]);

    useEffect(() => {
        const handler = (speaking: boolean) => setRawSpeaking(speaking);
        participant.on(ParticipantEvent.IsSpeakingChanged, handler);
        return () => { participant.off(ParticipantEvent.IsSpeakingChanged, handler); };
    }, [participant]);

    const isSpeaking = hookSpeaking || rawSpeaking;
    const isCameraOff = track.source === Track.Source.Camera && (track.publication?.isMuted || !participant.isCameraEnabled);

    let photoURL: string | null = null;
    try { photoURL = participant.metadata ? JSON.parse(participant.metadata).photoURL : null; } catch {}

    return (
        <div
            ref={ref}
            onClick={() => onTileClick(track)}
            className={`relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 ${isSpeaking ? 'ring-2 ring-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'ring-1 ring-white/5'} ${className || ''}`}
        >
            {inView ? (
                <ParticipantTile
                    trackRef={track}
                    {...props}
                    className={`!w-full !h-full [&_video]:!object-center ${track.source === Track.Source.ScreenShare ? '[&_video]:!object-contain bg-black' : '[&_video]:!object-cover'}`}
                />
            ) : (
                <div className="absolute inset-0 bg-gray-950 flex items-center justify-center">
                    <User className="w-10 h-10 text-gray-700" />
                </div>
            )}

            {isSpeaking && (
                <div className="absolute top-2.5 right-2.5 z-20 bg-emerald-500 text-white p-1 rounded-full shadow-lg pointer-events-none">
                    <Mic className="w-3 h-3" />
                </div>
            )}

            {isModerator && participant.identity !== userId && (
                <div className="absolute top-2.5 right-2.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                        className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10 transition-colors"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen && <ParticipantMenu participant={participant} closeMenu={() => setMenuOpen(false)} />}
                </div>
            )}

            {isCameraOff && inView && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center overflow-hidden bg-white/10 border-2 border-white/5 mb-3">
                        {photoURL ? (
                            <img src={photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-white font-black text-xl sm:text-2xl">{(participant.name || participant.identity || '?')[0].toUpperCase()}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/5">
                        {!participant.isMicrophoneEnabled && <MicOff className="w-3 h-3 text-red-400" />}
                        <span className="text-white text-xs font-semibold truncate max-w-[120px]">{participant.name || participant.identity || 'Participant'}</span>
                    </div>
                </div>
            )}

            <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-black/30">
                <div className="bg-white/20 backdrop-blur-md p-2.5 rounded-full scale-75 group-hover:scale-100 transition-transform duration-300">
                    <Maximize2 className="w-5 h-5 text-white" />
                </div>
            </div>
        </div>
    );
});

TileWrapper.displayName = 'TileWrapper';
