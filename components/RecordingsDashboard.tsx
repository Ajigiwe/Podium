import { useEffect, useState } from 'react';
import { Download, Clock, HardDrive, Video, Trash2, Calendar, RefreshCw } from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';
import { Skeleton } from './ui/Skeleton';

interface Recording {
    id: string;
    roomId: string; // Using roomId as egressId often in list logic, but id is doc id
    egressId: string;
    classTitle: string;
    status: string;
    durationSeconds: number;
    fileSizeBytes: number;
    startedAt: string;
    endedAt: string;
    createdAt: string;
}

interface RecordingsDashboardProps {
    lecturerId: string;
}

export const RecordingsDashboard = ({ lecturerId }: RecordingsDashboardProps) => {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState(true);
    const { showAlert } = useAlert();

    useEffect(() => {
        if (lecturerId) {
            fetchRecordings();
        }
    }, [lecturerId]);

    const fetchRecordings = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/recordings/lecturer/${lecturerId}`);
            const data = await response.json();

            if (data.success) {
                setRecordings(data.recordings);
            }
        } catch (error) {
            console.error('[Recordings:Dashboard:Fetch] Failed to fetch recordings:', error);
        } finally {
            setLoading(false);
        }
    };

    const downloadRecording = async (recordingId: string, classTitle: string, startedAt: string) => {
        try {
            const dateStr = new Date(startedAt).toISOString().split('T')[0];
            const safeTitle = (classTitle || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${safeTitle}-${dateStr}.mp4`;

            const link = document.createElement('a');
            link.href = `/api/recordings/download/${recordingId}`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('[Recordings:Dashboard:Download] Download failed:', error);
            showAlert('Failed to download recording', 'error');
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>
                <div className="grid gap-4">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (recordings.length === 0) {
        return (
            <div className="text-center p-12 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 min-h-[300px] flex flex-col items-center justify-center">
                <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-3xl mb-4 border border-gray-100 dark:border-gray-700">
                    <Video className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Recordings Yet</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto text-sm leading-relaxed">
                    Record your classes using the "Start Recording" button in the classroom. They will appear here automatically.
                </p>
            </div>
        );
    }

    const formatDuration = (seconds: number) => {
        if (!seconds) return '--:--';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        }
        return `${minutes}m ${secs}s`;
    };

    const formatSize = (bytes: number) => {
        if (!bytes) return '0 MB';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Class Recordings</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review and download your previous class sessions.</p>
                </div>
                <button
                    onClick={fetchRecordings}
                    className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                    title="Refresh List"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            <div className="grid gap-4">
                {recordings.map((recording) => (
                    <div
                        key={recording.id}
                        className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                        {recording.classTitle || 'Untitled Class'}
                                    </h3>
                                    <span
                                        className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-black ${recording.status === 'finished'
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : recording.status === 'recording'
                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse'
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                            }`}
                                    >
                                        {recording.status}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-500 dark:text-gray-400 mt-3">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                        <span className="font-medium">
                                            {new Date(recording.startedAt).toLocaleDateString(undefined, {
                                                weekday: 'short',
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </span>
                                    </div>

                                    {recording.durationSeconds > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                            <span className="font-medium">{formatDuration(recording.durationSeconds)}</span>
                                        </div>
                                    )}

                                    {recording.fileSizeBytes > 0 && (
                                        <div className="flex items-center gap-2">
                                            <HardDrive className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                            <span className="font-medium">{formatSize(recording.fileSizeBytes)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 sm:self-center">
                                {recording.status === 'finished' && (
                                    <button
                                        onClick={() => downloadRecording(recording.id, recording.classTitle, recording.startedAt)}
                                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all text-sm font-bold shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
