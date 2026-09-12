import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const MIN_REFUND_MINUTES = 30;

function tsMillis(value: any): number | null {
    if (!value) return null;
    if (typeof value.toMillis === 'function') {
        try { return value.toMillis(); } catch { /* fallthrough */ }
    }
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * GET /api/admin/session-audit?sessionId=<id>
 *
 * Admin-only snapshot for auditing one class:
 *  - session fields (title, status, startedAt/endedAt, duration, refund state),
 *  - the creator (host/lecturer) with resolved profile names,
 *  - every participant with how long they stayed,
 *  - every succeeded payment for the class and whether that student's
 *    paid duration was under the 30-minute refund threshold,
 *  - whether a refund has already been issued.
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
        const caller = await adminDb.collection('profiles').doc(decoded.uid).get();
        if (!caller.exists || caller.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
        }

        const sessionId = req.nextUrl.searchParams.get('sessionId');
        if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

        const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get();
        if (!sessionSnap.exists) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        const s: any = sessionSnap.data() || {};

        // --- Resolve creator profile (hostId / lecturerId) ---
        const creatorId = s.hostId || s.lecturerId || null;
        let creator = { id: creatorId, name: s.lecturerName || 'Unknown', email: null as string | null };
        if (creatorId) {
            const creatorSnap = await adminDb.collection('profiles').doc(creatorId).get();
            if (creatorSnap.exists) {
                const cp: any = creatorSnap.data() || {};
                creator = { id: creatorId, name: cp.fullName || s.lecturerName || 'Unknown', email: cp.email || null };
            }
        }

        // --- Duration of the class itself ---
        const startedMillis = tsMillis(s.startedAt) ?? tsMillis(s.createdAt);
        const endedMillis = tsMillis(s.endedAt) ?? (s.isActive === true ? Date.now() : null);
        const durationMinutes = startedMillis && endedMillis
            ? Math.max(0, Math.round((endedMillis - startedMillis) / 60000))
            : null;
        const metThreshold = durationMinutes !== null && durationMinutes >= MIN_REFUND_MINUTES;

        // --- Participants from both attendance sources (subcollection + legacy top-level logs) ---
        const [subSnap, legacySnap] = await Promise.all([
            adminDb.collection('sessions').doc(sessionId).collection('attendance').get(),
            adminDb.collection('attendance_logs').where('sessionId', '==', sessionId).get(),
        ]);

        type Participant = {
            id: string;
            name: string;
            email: string | null;
            joinedAt: string | null;
            leftAt: string | null;
            stayMinutes: number | null;
            verificationPercentage: number;
        };
        const participants = new Map<string, Participant>();
        subSnap.forEach((d) => {
            const p: any = d.data() || {};
            const joined = tsMillis(p.joinedAt);
            const left = tsMillis(p.leftAt) ?? endedMillis ?? Date.now();
            participants.set(d.id, {
                id: d.id,
                name: p.studentName || 'Unknown',
                email: p.studentEmail || p.userEmail || null,
                joinedAt: joined ? new Date(joined).toISOString() : null,
                leftAt: p.leftAt ? new Date(left).toISOString() : null,
                stayMinutes: joined ? Math.max(0, Math.round((left - joined) / 60000)) : null,
                verificationPercentage: Number(p.verificationPercentage) || 0,
            });
        });
        legacySnap.forEach((d) => {
            const p: any = d.data() || {};
            if (participants.has(d.id)) return;
            const joined = tsMillis(p.joinedAt);
            const left = tsMillis(p.leftAt) ?? endedMillis ?? Date.now();
            participants.set(d.id, {
                id: p.userId || d.id,
                name: p.userName || p.studentName || 'Unknown',
                email: p.userEmail || p.studentEmail || null,
                joinedAt: joined ? new Date(joined).toISOString() : null,
                leftAt: p.leftAt ? new Date(left).toISOString() : null,
                stayMinutes: joined ? Math.max(0, Math.round((left - joined) / 60000)) : null,
                verificationPercentage: Number(p.verificationPercentage) || 0,
            });
        });

        // --- Payments + refund analysis (mirrors app/api/wallet/refund-session.ts) ---
        const paymentsSnap = await adminDb.collection('transactions')
            .where('sessionId', '==', sessionId)
            .where('type', '==', 'session_payment')
            .where('status', '==', 'succeeded')
            .get();

        type RefundRow = {
            userId: string;
            name: string;
            email: string | null;
            amount: number;
            paidAt: string | null;
            stayMinutes: number | null;
            refundEligible: boolean;
            alreadyRefunded: boolean;
            refundableAmount: number;
        };
        const refundRows: RefundRow[] = [];
        const payments: any[] = [];
        paymentsSnap.forEach((d) => {
            payments.push({ id: d.id, ...d.data() });
        });

        for (const t of payments) {
            const amt = Number(t.amount) || 0;
            const userId = t.userId;
            if (!userId || userId === 'unknown') continue;

            const existingRefund = await adminDb.collection('transactions')
                .where('relatedTransactionId', '==', t.id)
                .where('type', '==', 'refund')
                .limit(1)
                .get();

            let joinMillis = tsMillis(t.createdAt);
            if (joinMillis === null && startedMillis !== null) joinMillis = startedMillis;
            const endForUser = endedMillis ?? Date.now();
            const stayMinutes = joinMillis !== null
                ? Math.max(0, Math.round((endForUser - joinMillis) / 60000))
                : null;

            const alreadyRefunded = !existingRefund.empty;
            const eligible = amt > 0 && stayMinutes !== null && stayMinutes < MIN_REFUND_MINUTES && !alreadyRefunded;
            let name = 'Unknown';
            let email: string | null = null;
            try {
                const prof = await adminDb.collection('profiles').doc(userId).get();
                if (prof.exists) {
                    name = prof.data()?.fullName || name;
                    email = prof.data()?.email || null;
                }
            } catch { /* leave defaults */ }

            refundRows.push({
                userId,
                name,
                email,
                amount: amt,
                paidAt: tsMillis(t.createdAt) ? new Date(tsMillis(t.createdAt) as number).toISOString() : null,
                stayMinutes,
                refundEligible: eligible,
                alreadyRefunded,
                refundableAmount: eligible ? amt : 0,
            });
        }

        const refundableTotal = refundRows.reduce((sum, r) => sum + r.refundableAmount, 0);
        const refundedTotal = refundRows.filter(r => r.alreadyRefunded).reduce((sum, r) => sum + r.amount, 0);

        return NextResponse.json({
            session: {
                id: sessionId,
                title: s.title || 'Untitled class',
                status: s.status || (s.isActive ? 'active' : 'unknown'),
                isActive: s.isActive === true,
                isDeleted: s.isDeleted === true,
                createdAt: tsMillis(s.createdAt) ? new Date(tsMillis(s.createdAt) as number).toISOString() : null,
                startedAt: startedMillis ? new Date(startedMillis).toISOString() : null,
                endedAt: endedMillis ? new Date(endedMillis).toISOString() : null,
                durationMinutes,
                metThreshold,
                refundProcessed: s.refundProcessed === true,
                participantCount: participants.size,
                perClassFee: s.price ?? null,
            },
            creator,
            participants: Array.from(participants.values()),
            refunds: {
                thresholdMinutes: MIN_REFUND_MINUTES,
                rows: refundRows,
                refundableTotal,
                refundedTotal,
                canTrigger: refundRows.some((r) => r.refundEligible) && s.refundProcessed !== true,
            },
        });
    } catch (error: any) {
        console.error('[Admin Session Audit]', error);
        return NextResponse.json({ error: error.message || 'Failed to audit session' }, { status: 500 });
    }
}
