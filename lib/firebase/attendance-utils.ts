import { db } from './config';
import {
    collection,
    doc,
    setDoc,
    updateDoc,
    getDoc,
    getDocs,
    query,
    where,
    Timestamp,
    increment,
    serverTimestamp,
    CollectionReference,
    arrayUnion
} from 'firebase/firestore';
import { AttendanceRecord, VerificationEvent, VerificationResponse } from './types';

// Collection names
const SESSIONS_COLLECTION = 'sessions';
const ATTENDANCE_SUBCOLLECTION = 'attendance';
const VERIFICATIONS_SUBCOLLECTION = 'verifications';
const RESPONSES_SUBCOLLECTION = 'responses';

/**
 * Marks a student as joined in a session and creates their attendance record
 */
export const joinAttendanceSession = async (
    sessionId: string,
    studentId: string,
    studentName: string,
    studentIndexNumber?: string
) => {
    const recordRef = doc(db, SESSIONS_COLLECTION, sessionId, ATTENDANCE_SUBCOLLECTION, studentId);

    const record: Omit<AttendanceRecord, 'id'> = {
        studentName,
        studentIndexNumber: studentIndexNumber || undefined,
        joinedAt: Timestamp.now(),
        leftAt: null,
        totalVerificationsSent: 0,
        totalVerificationsCompleted: 0,
        verificationPercentage: 0,
        isPresent: true
    };

    await setDoc(recordRef, record, { merge: true });
    return studentId;
};

/**
 * Triggers a new verification event for a session
 */
export const triggerVerification = async (
    sessionId: string,
    triggeredBy: 'automatic' | 'manual',
    timeLimitSeconds: number = 60
) => {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) throw new Error('Session not found');

    const verificationsRef = collection(db, SESSIONS_COLLECTION, sessionId, VERIFICATIONS_SUBCOLLECTION);
    const verifCount = (await getDocs(verificationsRef)).size + 1;

    const verificationId = doc(verificationsRef).id;
    const now = Timestamp.now();
    const expiresAt = new Timestamp(now.seconds + timeLimitSeconds, now.nanoseconds);

    const verification: VerificationEvent = {
        id: verificationId,
        verificationNumber: verifCount,
        triggeredBy,
        triggeredAt: now,
        expiresAt,
        timeLimitSeconds
    };

    await setDoc(doc(verificationsRef, verificationId), verification);

    // Increment totalVerificationsSent for all students in this session
    // In a real app with many students, this should be a batch or background job
    const attendanceRef = collection(db, SESSIONS_COLLECTION, sessionId, ATTENDANCE_SUBCOLLECTION);
    const studentsSnap = await getDocs(query(attendanceRef, where('isPresent', '==', true)));

    const updates = studentsSnap.docs.map(studentDoc => {
        const studentId = studentDoc.id;
        const logRef = doc(db, 'attendance_logs', `${sessionId}_${studentId}`);
        // We update both subcollection and flat log
        updateDoc(logRef, { totalVerificationsSent: increment(1) }).catch(() => {});
        return updateDoc(studentDoc.ref, {
            totalVerificationsSent: increment(1)
        });
    });

    await Promise.all(updates);

    return verification;
};

/**
 * Records a student's response to a verification
 */
export const respondToVerification = async (
    sessionId: string,
    verificationId: string,
    studentId: string
) => {
    const verifRef = doc(db, SESSIONS_COLLECTION, sessionId, VERIFICATIONS_SUBCOLLECTION, verificationId);
    const verifSnap = await getDoc(verifRef);

    if (!verifSnap.exists()) throw new Error('Verification not found');

    const verifData = verifSnap.data() as VerificationEvent;
    const now = Timestamp.now();

    if (now.seconds > verifData.expiresAt.seconds) {
        throw new Error('Verification expired');
    }

    const responseRef = doc(db, SESSIONS_COLLECTION, sessionId, VERIFICATIONS_SUBCOLLECTION, verificationId, RESPONSES_SUBCOLLECTION, studentId);
    const response: Omit<VerificationResponse, 'id'> = {
        attendanceRecordId: studentId,
        respondedAt: now,
        responseTimeSeconds: now.seconds - verifData.triggeredAt.seconds
    };

    await setDoc(responseRef, response);

    // Update student stats
    const recordRef = doc(db, SESSIONS_COLLECTION, sessionId, ATTENDANCE_SUBCOLLECTION, studentId);
    const recordSnap = await getDoc(recordRef);

    if (recordSnap.exists()) {
        const data = recordSnap.data();
        const completed = (data.totalVerificationsCompleted || 0) + 1;
        const sent = data.totalVerificationsSent || 1;
        const percentage = Math.round((completed / sent) * 100);

        await updateDoc(recordRef, {
            totalVerificationsCompleted: completed,
            verificationPercentage: percentage
        });

        // Sync to flat log
        const logRef = doc(db, 'attendance_logs', `${sessionId}_${studentId}`);
        await updateDoc(logRef, {
            totalVerificationsCompleted: completed,
            verificationPercentage: percentage
        }).catch(() => {});
    }

    return true;
};
