'use client';

import { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { TileWrapper } from './TileWrapper';

interface VideoGridProps {
    tracks: TrackReferenceOrPlaceholder[];
    currentPage: number;
    totalPages: number;
    onPrevPage: () => void;
    onNextPage: () => void;
    onTileClick: (track: TrackReferenceOrPlaceholder) => void;
}

export function VideoGrid({
    tracks,
    currentPage,
    totalPages,
    onPrevPage,
    onNextPage,
    onTileClick,
}: VideoGridProps) {
    const hasScreenShare = tracks.some(t => t.source === Track.Source.ScreenShare);

    if (hasScreenShare) {
        return (
            <div className="absolute inset-0 overflow-hidden bg-black">
                {tracks.filter(t => t.source === Track.Source.ScreenShare).map(trackRef => (
                    <div key={trackRef.participant.sid + '_screen'}>
                        <div className="block sm:hidden" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, background: 'black', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100vh', height: '100vw', transform: 'translate(-50%, -50%) rotate(90deg)', transformOrigin: 'center center' }}>
                                <TileWrapper track={trackRef} participant={trackRef.participant} onTileClick={onTileClick} className="w-full h-full !rounded-none" />
                            </div>
                        </div>
                        <div className="hidden sm:block absolute inset-0">
                            <TileWrapper track={trackRef} participant={trackRef.participant} onTileClick={onTileClick} className="w-full h-full !rounded-none" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-wrap items-center justify-center content-center gap-2 sm:gap-3 w-full h-full p-2 sm:p-4 overflow-y-auto pb-20 sm:pb-4">
            {totalPages > 1 && (
                <div className="absolute z-50 bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/80 px-4 py-2 rounded-full border border-white/10 backdrop-blur-xl">
                    <button onClick={onPrevPage} disabled={currentPage === 1} className="text-white disabled:opacity-30 hover:text-blue-400 transition-colors text-xs font-bold">&larr;</button>
                    <span className="text-white text-xs font-semibold tabular-nums">{currentPage} / {totalPages}</span>
                    <button onClick={onNextPage} disabled={currentPage === totalPages} className="text-white disabled:opacity-30 hover:text-blue-400 transition-colors text-xs font-bold">&rarr;</button>
                </div>
            )}

            {tracks.map((trackRef, index, arr) => {
                const count = arr.length;
                let tileClass = 'w-[calc(50%-0.5rem)] sm:w-[calc(33.33%-0.75rem)] lg:w-[calc(25%-0.75rem)] aspect-[3/4] sm:aspect-video shrink-0';
                if (count === 1) tileClass = 'w-full max-w-lg sm:max-w-2xl aspect-[3/4] sm:aspect-video shrink-0';
                else if (count === 2) tileClass = 'w-[calc(50%-0.5rem)] sm:w-[calc(50%-0.75rem)] max-w-4xl aspect-[3/4] sm:aspect-video shrink-0';
                else if (count <= 4) tileClass = 'w-[calc(50%-0.5rem)] sm:w-[calc(50%-0.75rem)] lg:w-[calc(50%-0.75rem)] max-w-3xl aspect-[3/4] sm:aspect-video shrink-0';

                return (
                    <div key={trackRef.participant.sid + '_' + trackRef.source} className={`${tileClass} transition-all duration-300`}>
                        <TileWrapper
                            track={trackRef}
                            participant={trackRef.participant}
                            onTileClick={onTileClick}
                            className="w-full h-full bg-gray-900 rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-colors"
                        />
                    </div>
                );
            })}
        </div>
    );
}
