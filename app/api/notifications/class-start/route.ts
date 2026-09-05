import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://podiumclass.online';
const FROM = 'Podium Class <noreply@podiumclass.online>';

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));

        const { sessionId } = await request.json() as { sessionId?: string };
        if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
            return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }

        const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get();
        if (!sessionSnap.exists) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        const session = sessionSnap.data() || {};

        // Only the host/lecturer (or an admin) can fire the alert
        const callerSnap = await adminDb.collection('profiles').doc(decoded.uid).get();
        const callerRole = callerSnap.data()?.role;
        const isHost = session.hostId === decoded.uid || session.lecturerId === decoded.uid;
        if (!isHost && callerRole !== 'admin') {
            return NextResponse.json({ error: 'Only the class lecturer can send alerts' }, { status: 403 });
        }
        if (session.isActive !== true) {
            return NextResponse.json({ error: 'Class is not live' }, { status: 409 });
        }

        // Must belong to a community
        const groupId = session.groupId as string | undefined;
        if (!groupId) return NextResponse.json({ sent: 0, skipped: 'no-community' });

        // Idempotency: never alert twice for the same going-live.
        // Transaction makes the claim atomic — two simultaneous callers, exactly one wins.
        const sessionRef = adminDb.collection('sessions').doc(sessionId);
        let claim = false;
        await adminDb.runTransaction(async (tx) => {
            const fresh = await tx.get(sessionRef);
            if (!fresh.exists || fresh.data()?.notifiedAt) return;
            claim = true;
            tx.update(sessionRef, { notifiedAt: FieldValue.serverTimestamp() });
        });
        if (!claim) return NextResponse.json({ sent: 0, skipped: 'already-notified' });

        // Fetch community + members
        const groupSnap = await adminDb.collection('groups').doc(groupId).get();
        const groupName = groupSnap.exists ? groupSnap.data()?.name || 'your community' : 'your community';
        const membersSnap = await adminDb.collection('group_memberships')
            .where('groupId', '==', groupId)
            .get();

        const emails = Array.from(new Set(
            membersSnap.docs
                .map(d => (d.data().userEmail || '').trim().toLowerCase())
                .filter(e => e.includes('@'))
        ));

        if (emails.length === 0) return NextResponse.json({ sent: 0, skipped: 'no-members' });

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.error('[ClassStartNotify] RESEND_API_KEY missing');
            return NextResponse.json({ sent: 0, error: 'email-provider-missing' }, { status: 500 });
        }

        const joinUrl = `${APP_URL}/classroom/${sessionId}`;
        const title = String(session.title || 'A class');
        const lecturer = String(session.lecturerName || 'Your lecturer');

        // Resend allows batched sends; chunk to stay within limits
        const CHUNK = 50;
        let sent = 0;
        for (let i = 0; i < emails.length; i += CHUNK) {
            const batch = emails.slice(i, i + CHUNK);
            try {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: FROM,
                        to: batch,
                        subject: `🔴 Live now: ${title} — ${groupName}`,
                        html: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
<tr><td style="background:#dc2626;padding:26px 32px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:20px;">&#128308; Class is LIVE</h1>
<p style="margin:6px 0 0;color:#fecaca;font-size:13px;">${groupName}</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 14px;font-size:15px;color:#374151;"><strong style="color:#111827;">${title}</strong> has just started.</p>
<p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Lecturer: ${lecturer}</p>
<a href="${joinUrl}" style="display:inline-block;background:#1845D4;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 28px;border-radius:10px;">Join the classroom &rarr;</a>
<p style="margin:22px 0 0;font-size:12px;color:#9ca3af;">You are receiving this because you are a member of ${groupName} on Podium.</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
                    }),
                });
                if (res.ok) sent += batch.length;
                else console.error('[ClassStartNotify] batch failed:', res.status, await res.text().catch(() => ''));
            } catch (err) {
                console.error('[ClassStartNotify] batch error:', err);
            }
        }

        return NextResponse.json({ success: true, sent, members: emails.length });
    } catch (error: any) {
        console.error('[ClassStartNotify] failed:', error);
        return NextResponse.json({ error: error.message || 'Notification failed' }, { status: 500 });
    }
}
