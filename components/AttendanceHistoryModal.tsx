'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { AttendanceLog } from '@/lib/firebase/types';
import { X, History, Download } from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';
import { Skeleton } from './ui/Skeleton';

interface AttendanceHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

export default function AttendanceHistoryModal({ isOpen, onClose, userId }: AttendanceHistoryModalProps) {
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const { showAlert } = useAlert();

    useEffect(() => {
        if (isOpen && userId) {
            handleOpenHistory();
        }
    }, [isOpen, userId]);

    const handleOpenHistory = async () => {
        setLoadingHistory(true);
        try {
            // Query logs specifically for this lecturer
            const logsRef = collection(db, 'attendance_logs');
            const q = query(
                logsRef,
                where('lecturerId', '==', userId),
                orderBy('joinedAt', 'desc')
            );

            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map(doc => doc.data() as AttendanceLog);

            // Group by Session ID
            const grouped: Record<string, {
                sessionId: string;
                title: string;
                studentIds: Set<string>;
                lastJoined: Timestamp;
            }> = {};

            logs.forEach(log => {
                const sid = log.sessionId;
                if (!grouped[sid]) {
                    grouped[sid] = {
                        sessionId: sid,
                        title: log.sessionTitle || 'Unknown Class', // Fallback
                        studentIds: new Set(),
                        lastJoined: log.joinedAt
                    };
                }

                if (log.userId) {
                    grouped[sid].studentIds.add(log.userId);
                }

                // Keep the most recent date
                if (log.joinedAt > grouped[sid].lastJoined) {
                    grouped[sid].lastJoined = log.joinedAt;
                }
            });

            setHistoryData(Object.values(grouped).map(item => ({
                ...item,
                count: item.studentIds.size
            })).sort((a, b) => b.lastJoined.seconds - a.lastJoined.seconds));
        } catch (error) {
            console.error("Error fetching history:", error);
            showAlert("Failed to load attendance history.", "error");
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDownloadAttendance = async (sessionId: string, title: string) => {
        try {
            // 1. Fetch Session Details (to get Lecturer Name, Program, Course, Time)
            const sessionRef = doc(db, 'sessions', sessionId);
            const sessionSnap = await getDoc(sessionRef);

            let lecturerName = 'N/A';
            let program = 'N/A';
            let course = 'N/A';
            let classDate = 'N/A';
            let classTime = 'N/A';

            if (sessionSnap.exists()) {
                const data = sessionSnap.data();
                lecturerName = data.lecturerName || 'N/A';
                program = data.program || 'N/A';
                course = data.course || 'N/A';

                if (data.scheduledStartTime) {
                    const dateObj = data.scheduledStartTime.toDate();
                    classDate = dateObj.toLocaleDateString();
                    classTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else if (data.createdAt) {
                    const dateObj = data.createdAt.toDate();
                    classDate = dateObj.toLocaleDateString();
                    classTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            } else {
                // Fallback for hard-deleted sessions
                try {
                    const profileRef = doc(db, 'profiles', userId);
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        lecturerName = profileSnap.data().fullName || 'N/A';
                    }
                } catch (err) {
                    console.error("[AttendanceHistory:ProfileFallback] Error fetching profile fallback:", err);
                }
            }

            // 2. Fetch Join Logs (attendance_logs)
            const logsRef = collection(db, 'attendance_logs');
            const qLogs = query(
                logsRef,
                where('sessionId', '==', sessionId)
            );
            const logsSnap = await getDocs(qLogs);
            const basicLogs = logsSnap.docs
                .map(doc => doc.data() as AttendanceLog)
                .sort((a, b) => {
                    const timeA = a.joinedAt?.toMillis?.() || 0;
                    const timeB = b.joinedAt?.toMillis?.() || 0;
                    return timeA - timeB;
                });

            if (basicLogs.length === 0) {
                showAlert("No join records found for this class.", "info");
                return;
            }

            // 3. Fetch Verification Stats (subcollection)
            const attendanceSubRef = collection(db, 'sessions', sessionId, 'attendance');
            const verifSnap = await getDocs(attendanceSubRef);
            const verifData: Record<string, number> = {};
            verifSnap.docs.forEach(doc => {
                const data = doc.data();
                verifData[doc.id] = data.totalVerificationsCompleted || 0;
            });

            // 4. Form CSV Content
            const csvRows = [];

            // Header Section
            csvRows.push(['ATTENDANCE REPORT']);
            csvRows.push([`Class Title,${title.replace(/,/g, ' ')}`]);
            csvRows.push([`Lecturer Name,${lecturerName.replace(/,/g, ' ')}`]);
            csvRows.push([`Date,${classDate}`]);
            csvRows.push([`Time,${classTime}`]);
            csvRows.push([`Program,${program.replace(/,/g, ' ')}`]);
            csvRows.push([`Course,${course.replace(/,/g, ' ')}`]);
            csvRows.push([`Generated At,${new Date().toLocaleString()}`]);
            csvRows.push([]); // Empty line

            // Table Header
            const headers = ['Student Name', 'Index Number', 'Joined At', 'Presence Checks'];
            csvRows.push([headers.join(',')]);

            // Table Data (Group by student to avoid duplicates if they joined multiple times)
            const uniqueStudents: Record<string, {
                name: string;
                index: string;
                joinedAt: string;
                checks: number;
            }> = {};

            basicLogs.forEach(log => {
                if (!uniqueStudents[log.userId]) {
                    uniqueStudents[log.userId] = {
                        name: log.userName || 'Unknown',
                        index: log.userIndexNumber || 'N/A',
                        joinedAt: log.joinedAt?.toDate ? log.joinedAt.toDate().toLocaleString() : 'N/A',
                        checks: verifData[log.userId] || 0
                    };
                }
            });

            Object.values(uniqueStudents).forEach(student => {
                const name = `"${student.name.replace(/"/g, '""')}"`;
                const index = `"${student.index.replace(/"/g, '""')}"`;
                csvRows.push([name, index, `"${student.joinedAt}"`, student.checks].join(','));
            });

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_')}_attendance_full.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("[AttendanceHistory:Download] Error downloading attendance:", error);
            showAlert("Failed to download attendance.", "error");
        }
    };

    // RESTARTING PLAN: Update imports first, then function.
    // actually, I'll just use the existing `getDocs` mechanism to fetch the session by ID if I don't want to touch imports, BUT `where('__name__', ...)` works.
    // However, fetching extra data is key.

    // Let's try to update imports AND the function in one go if they are close? No, they are far apart.
    // I will use `replace_file_content` for imports first.


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative w-full max-w-4xl bg-white rounded-2xl p-8 border border-gray-200 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900  flex items-center gap-2">
                        <History className="w-6 h-6 text-blue-600" />
                        Attendance History
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100  rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {loadingHistory ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex gap-4 p-4 border border-gray-100  rounded-xl">
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-5 w-1/3" />
                                        <Skeleton className="h-3 w-1/4" />
                                    </div>
                                    <Skeleton className="h-10 w-32" />
                                </div>
                            ))}
                        </div>
                    ) : historyData.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 ">
                            No attendance records found.
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50  sticky top-0">
                                <tr>
                                    <th className="p-4 text-sm font-semibold text-gray-600 ">Class Title</th>
                                    <th className="p-4 text-sm font-semibold text-gray-600 ">Unique Attendees</th>
                                    <th className="p-4 text-sm font-semibold text-gray-600 ">Last Activity</th>
                                    <th className="p-4 text-sm font-semibold text-gray-600  text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 ">
                                {historyData.map((item) => (
                                    <tr key={item.sessionId} className="hover:bg-gray-50 ">
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900 ">{item.title}</div>
                                            <div className="text-xs text-gray-500 font-mono mt-0.5">{item.sessionId}</div>
                                        </td>
                                        <td className="p-4 text-gray-700 ">
                                            {item.count}
                                        </td>
                                        <td className="p-4 text-gray-500  text-sm">
                                            {item.lastJoined?.toDate ? item.lastJoined.toDate().toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleDownloadAttendance(item.sessionId, item.title)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50  text-blue-600  rounded-lg hover:bg-blue-100  transition-colors text-sm font-medium"
                                            >
                                                <Download className="w-4 h-4" />
                                                Download CSV
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
