/**
 * Attendance Verification Scheduler
 * 
 * This script runs in the background and checks all active class sessions.
 * It triggers scheduled verifications when the time is right.
 * 
 * Usage: node jobs/attendanceVerificationScheduler.ts
 */

import { adminDb } from '../lib/firebase/admin.js';
import { Timestamp } from 'firebase-admin/firestore';

// In Node 18+, fetch is global. If using older Node, ensure a polyfill or node-fetch is available.
// @ts-ignore - node-fetch might not have types installed
const fetchApi = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;

const TICK_INTERVAL_MS = 30000; // Check every 30 seconds

async function runScheduler() {
    console.log(`[Attendance Scheduler] Tick started at ${new Date().toISOString()}`);

    try {
        const now = Timestamp.now();
        const activeSessionsSnap = await adminDb.collection('sessions')
            .where('attendanceStatus', '==', 'active')
            .get();

        if (activeSessionsSnap.empty) {
            console.log('[Attendance Scheduler] No active sessions found.');
            return;
        }

        for (const sessionDoc of activeSessionsSnap.docs) {
            const sessionData = sessionDoc.data();
            const sessionId = sessionDoc.id;
            const startedAt = sessionData.attendanceStartedAt?.toMillis();
            const scheduledVerifications = sessionData.scheduledVerifications || [];

            if (!startedAt) continue;

            const minsElapsed = Math.floor((Date.now() - startedAt) / 60000);

            // Get already triggered verifications for this session
            const verificationsSnap = await sessionDoc.ref.collection('verifications').get();
            const alreadyTriggeredNumbers = verificationsSnap.docs.map(doc => doc.data().verificationNumber);

            // Find due verifications (scheduled time passed and not yet triggered)
            // We assume scheduledVerifications index + 1 is the verificationNumber
            for (let i = 0; i < scheduledVerifications.length; i++) {
                const scheduledMin = scheduledVerifications[i];
                const verifNum = i + 1;

                if (minsElapsed >= scheduledMin && !alreadyTriggeredNumbers.includes(verifNum)) {
                    console.log(`[Attendance Scheduler] Session ${sessionId}: Triggering scheduled check #${verifNum} (scheduled for ${scheduledMin}m, elapsed ${minsElapsed}m)`);

                    try {
                        const response = await fetchApi(`${process.env.APP_URL || 'http://localhost:3000'}/api/attendance/verification/trigger`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId,
                                triggeredBy: 'automatic'
                            })
                        });

                        if (!response.ok) {
                            const err = await response.text();
                            console.error(`[Attendance Scheduler] Failed to trigger: ${err}`);
                        }
                    } catch (err) {
                        console.error(`[Attendance Scheduler] Error calling trigger API:`, err);
                    }
                }
            }
        }
    } catch (error) {
        console.error('[Attendance Scheduler] Fatal error during tick:', error);
    }
}

// Start the loop
console.log('[Attendance Scheduler] Starting periodic background task...');
setInterval(runScheduler, TICK_INTERVAL_MS);
runScheduler();
