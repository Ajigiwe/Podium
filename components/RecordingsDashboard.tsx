import { useEffect, useState } from 'react';
import { Download, Clock, HardDrive, Video, Trash2, Calendar } from 'lucide-react';

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
            console.error('Failed to fetch recordings:', error);
        } finally {
            setLoading(false);
        }
    };

    const downloadRecording = async (recordingId: string, classTitle: string, startedAt: string) => {
        try {
            // Direct download link logic
            // We can just open the window to the API route which streams the file
            // But doing it via fetch blob allows better error handling before download starts
            // However, for large files, direct link is better.
            // Let's use the API route as a direct link target for simplicity and performance.

            // Generate a safe filename
            const dateStr = new Date(startedAt).toISOString().split('T')[0];
            const safeTitle = (classTitle || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${safeTitle}-${dateStr}.mp4`;

            // Trigger download via hidden anchor
            const link = document.createElement('a');
            link.href = `/api/recordings/download/${recordingId}`;
            link.download = filename; // This might be overridden by Content-Disposition header
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download recording');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 min-h-[300px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-500 text-sm">Loading your recordings...</p>
            </div>
        );
    }

    if (recordings.length === 0) {
        return (
            <div className="text-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 min-h-[300px] flex flex-col items-center justify-center">
                <div className="bg-gray-50 p-4 rounded-full mb-4">
                    <Video className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recordings Yet</h3>
                <p className="text-gray-500 max-w-sm mx-auto">
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
                <h2 className="text-2xl font-bold text-gray-900">Class Recordings</h2>
                <button
                    onClick={fetchRecordings}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                    Refresh List
                </button>
            </div>

            <div className="grid gap-4">
                {recordings.map((recording) => (
                    <div
                        key={recording.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow group"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                                        {recording.classTitle || 'Untitled Class'}
                                    </h3>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${recording.status === 'finished'
                                                ? 'bg-green-100 text-green-700'
                                                : recording.status === 'recording'
                                                    ? 'bg-red-100 text-red-700 animate-pulse'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}
                                    >
                                        {recording.status}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 mt-2">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span>
                                            {// Create Date object safely
                                                new Date(recording.startedAt).toLocaleDateString(undefined, {
                                                    weekday: 'short',
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })
                                            }
                                        </span>
                                    </div>

                                    {recording.durationSeconds > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            <span>{formatDuration(recording.durationSeconds)}</span>
                                        </div>
                                    )}

                                    {recording.fileSizeBytes > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <HardDrive className="w-4 h-4 text-gray-400" />
                                            <span>{formatSize(recording.fileSizeBytes)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 mt-2 sm:mt-0">
                                {recording.status === 'finished' && (
                                    <button
                                        onClick={() => downloadRecording(recording.id, recording.classTitle, recording.startedAt)}
                                        className="flex-1 sm:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download
                                    </button>
                                )}
                                {/* Optional: Add delete button later */}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
