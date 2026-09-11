import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Community classes are created as `status: 'active'`, and only leave that state when a
 * lecturer actually runs the class (start -> end) or archives it. A class that is created
 * and then forgotten therefore stays "open" forever, which inflates the community card
 * counters and the workspace list with classes that will never happen.
 *
 * This sweep retires those: a community class is closed when it
 *   - still has status 'active' (never ended, never archived, not paused),
 *   - never went live (no startedAt, not isActive),
 *   - was created more than `olderThanHours` ago, and
 *   - is not scheduled for some time still in the future (a lecturer may legitimately
 *     plan a class weeks ahead — that one is left alone).
 *
 * Closing means `status: 'ended'` with an `autoClosedAt` audit trail. No refund is issued:
 * a class that never started cannot have been entered, so nobody was charged.
 */

export const DEFAULT_STALE_HOURS = 24;
export const MAX_STALE_HOURS = 24 * 30;

export interface AutoClosedClass {
    id: string;
    title: string;
    groupId: string;
    createdAt: string | null;
}

export interface StaleClassSweep {
    dryRun: boolean;
    olderThanHours: number;
    candidates: number;
    closed: number;
    keptBecauseScheduled: number;
    truncated: boolean;
    classes: AutoClosedClass[];
}

/** Scans open sessions in one query (`status == 'active'` is bounded by open classes only). */
export async function closeStaleCommunityClasses(options: { olderThanHours?: number; dryRun?: boolean } = {}): Promise<StaleClassSweep> {
    const requested = Number(options.olderThanHours);
    const olderThanHours = Number.isFinite(requested) && requested > 0
        ? Math.min(Math.round(requested), MAX_STALE_HOURS)
        : DEFAULT_STALE_HOURS;
    const dryRun = options.dryRun === true;

    const now = Date.now();
    const cutoff = now - olderThanHours * 60 * 60 * 1000;

    const PAGE = 1000;
    const openSnap = await adminDb.collection('sessions')
        .where('status', '==', 'active')
        .limit(PAGE)
        .get();

    const stale: { ref: FirebaseFirestore.DocumentReference; summary: AutoClosedClass }[] = [];
    let keptBecauseScheduled = 0;

    openSnap.forEach(doc => {
        const s = doc.data() || {};

        // Community classes only — personal classes are the lecturer's own business.
        const groupId = typeof s.groupId === 'string' ? s.groupId : null;
        if (!groupId) return;
        if (s.isDeleted === true || s.isActive === true) return;
        // Already ran at some point (started, paused, resumed) — not our business.
        if (s.startedAt) return;

        const createdAt = s.createdAt?.toMillis?.() ?? null;
        if (createdAt === null || createdAt >= cutoff) return;

        // Scheduled for later — the lecturer still means to run it.
        const scheduledFor = s.scheduledStartTime?.toMillis?.() ?? null;
        if (scheduledFor !== null && scheduledFor > now) {
            keptBecauseScheduled += 1;
            return;
        }

        stale.push({
            ref: doc.ref,
            summary: {
                id: doc.id,
                title: String(s.title || 'Untitled class'),
                groupId,
                createdAt: new Date(createdAt).toISOString(),
            },
        });
    });

    if (!dryRun && stale.length > 0) {
        const BATCH = 400;
        for (let i = 0; i < stale.length; i += BATCH) {
            const batch = adminDb.batch();
            for (const item of stale.slice(i, i + BATCH)) {
                batch.update(item.ref, {
                    status: 'ended',
                    isActive: false,
                    endedAt: Timestamp.fromMillis(now),
                    autoClosedAt: Timestamp.fromMillis(now),
                    autoClosedReason: 'never-started',
                });
            }
            await batch.commit();
        }
    }

    return {
        dryRun,
        olderThanHours,
        candidates: stale.length,
        closed: dryRun ? 0 : stale.length,
        keptBecauseScheduled,
        truncated: openSnap.size >= PAGE,
        classes: stale.map(s => s.summary),
    };
}
