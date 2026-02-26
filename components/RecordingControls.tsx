import { useState, useEffect } from 'react';
import { Video, Square, Clock } from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';

interface RecordingControlsProps {
    roomId: string;
    lecturerId: string;
    classTitle: string;
    isLecturer: boolean;
}

export const RecordingControls = ({
    roomId,
    lecturerId,
    classTitle,
    isLecturer
}: RecordingControlsProps) => {
    console.log('DEBUG: RecordingControls mounted', { roomId, lecturerId, isLecturer });
    const [isRecording, setIsRecording] = useState(false);
    const [egressId, setEgressId] = useState<string | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const { showAlert, showConfirm } = useAlert();

    // Timer for recording duration
    useEffect(() => {
        if (!isRecording || !startTime) return;

        const interval = setInterval(() => {
            setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [isRecording, startTime]);

    const startRecording = async () => {
        try {
            const response = await fetch('/api/recordings/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId,
                    lecturerId,
                    classTitle,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setIsRecording(true);
                setEgressId(data.egressId);
                setStartTime(Date.now());
                console.log('Recording started:', data.egressId);
            } else {
                showAlert('Failed to start recording: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Failed to start recording:', error);
            showAlert('Failed to start recording', 'error');
        }
    };

    const stopRecording = async () => {
        if (!egressId) return;

        showConfirm('Are you sure you want to stop the recording?', async () => {
            try {
                const response = await fetch('/api/recordings/stop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        egressId,
                        roomId,
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    setIsRecording(false);
                    setEgressId(null);
                    setRecordingTime(0);
                    setStartTime(null);
                    showAlert('Recording saved! You can download it from your dashboard.', 'success');
                } else {
                    showAlert('Failed to stop recording: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                console.error('Failed to stop recording:', error);
                showAlert('Failed to stop recording', 'error');
            }
        }, 'Stop Recording');
    };

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isLecturer) {
        if (!isRecording) return null;

        return (
            <div className="bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 border border-red-500">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse border border-red-400" />
                <span className="font-bold text-[10px] tracking-tight">REC</span>
                <span className="font-mono text-xs opacity-90">{formatTime(recordingTime)}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center">
            {!isRecording ? (
                <button
                    onClick={startRecording}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-gray-800 hover:bg-red-600 rounded-lg transition-all flex items-center gap-2 border border-gray-700 hover:border-red-500 group"
                    title="Start Recording"
                >
                    <div className="w-2 h-2 rounded-full bg-red-500 group-hover:bg-white transition-colors" />
                    <span>Record</span>
                </button>
            ) : (
                <div className="flex items-center">
                    <div className="bg-red-600 text-white px-3 py-1.5 rounded-l-lg flex items-center gap-2 border border-red-500">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse border border-red-400" />
                        <span className="font-bold text-xs tracking-wide">REC</span>
                        <span className="font-mono text-xs border-l border-white/20 pl-2">{formatTime(recordingTime)}</span>
                    </div>
                    <button
                        onClick={stopRecording}
                        className="bg-gray-900 hover:bg-gray-800 text-white p-1.5 rounded-r-lg border border-l-0 border-white/10 transition-colors flex items-center justify-center"
                        title="Stop Recording"
                    >
                        <Square className="w-3 h-3 fill-white" />
                    </button>
                </div>
            )}
        </div>
    );
};
