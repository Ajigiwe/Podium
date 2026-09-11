import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://podiumclass.online';
const FROM = 'Podium Class <noreply@podiumclass.online>';

export type ClassAlertKind = 'live' | 'scheduled';

interface AlertPayload {
    sessionId: string;
    kind: ClassAlertKind;
}

interface Recipient {
    userId: string;
    email: string | null;
}

/**
 * Emails every member of the session's community about a class AND drops an in-app
 * notification for each of them.
 *
 * - kind 'live'      -> "Class is LIVE"          (dedup field: notifiedAt)
 * - kind 'scheduled' -> "New class scheduled"    (dedup field: scheduledNotifiedAt)
 *
 * In-app notifications are the primary channel: they are written first and are only
 * attempted once per event (guarded by the same atomic claim). Email is best-effort —
 * provider failures (quota, transient errors) are logged and never throw.
 */
export async function notifyCommunityClass({ sessionId, kind }: AlertPayload): Promise<{ sent: number; inApp: number; skipped?: string; members?: number }> {
    const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get();
    if (!sessionSnap.exists) return { sent: 0, inApp: 0, skipped: 'no-session' };
    const session = sessionSnap.data() || {};

    const groupId = session.groupId as string | undefined;
    if (!groupId) return { sent: 0, inApp: 0, skipped: 'no-community' };

    // Idempotency: never alert twice for the same event.
    const dedupField = kind === 'live' ? 'notifiedAt' : 'scheduledNotifiedAt';
    const sessionRef = adminDb.collection('sessions').doc(sessionId);
    let claim = false;
    await adminDb.runTransaction(async (tx) => {
        const fresh = await tx.get(sessionRef);
        if (!fresh.exists || fresh.data()?.[dedupField]) return;
        claim = true;
        tx.update(sessionRef, { [dedupField]: FieldValue.serverTimestamp() });
    });
    if (!claim) return { sent: 0, inApp: 0, skipped: 'already-notified' };

    const groupSnap = await adminDb.collection('groups').doc(groupId).get();
    const groupName = groupSnap.exists ? groupSnap.data()?.name || 'your community' : 'your community';
    const recipients = await resolveRecipients(groupId, session);

    if (recipients.length === 0) return { sent: 0, inApp: 0, skipped: 'no-members' };

    const isLive = kind === 'live';
    const title = String(session.title || 'A class');
    const lecturer = String(session.lecturerName || 'Your lecturer');

    // 1. In-app notifications first — this channel must not depend on email success.
    const inApp = await createInAppNotifications({ recipients, sessionId, groupId, groupName, kind, title, lecturer });

    // 2. Email — best effort, failures are logged only.
    const emails = Array.from(new Set(recipients.map(r => (r.email || '').trim().toLowerCase()).filter(e => e.includes('@'))));
    if (emails.length === 0) return { sent: 0, inApp, skipped: 'no-member-emails', members: recipients.length };

    const sent = await sendEmails({ emails, isLive, title, lecturer, groupName, sessionId });
    return { sent, inApp, members: recipients.length };
}

/**
 * Everyone in the community except the lecturer/host — they do not need an alert
 * about the class they just created or started.
 * Falls back to the profile email when the membership record has none, so owners and
 * older memberships still get alerts.
 */
async function resolveRecipients(groupId: string, session: Record<string, any>): Promise<Recipient[]> {
    const membersSnap = await adminDb.collection('group_memberships').where('groupId', '==', groupId).get();
    const excluded = new Set([session.hostId, session.lecturerId].filter(Boolean).map(String));

    const recipients: Recipient[] = membersSnap.docs
        .map(d => {
            const m = d.data() || {};
            const email = typeof m.userEmail === 'string' && m.userEmail.includes('@') ? m.userEmail.trim().toLowerCase() : null;
            return { userId: String(m.userId || ''), email };
        })
        .filter(r => r.userId && !excluded.has(r.userId));

    const missing = recipients.filter(r => !r.email);
    if (missing.length > 0) {
        try {
            const snaps = await adminDb.getAll(...missing.map(r => adminDb.collection('profiles').doc(r.userId)));
            const emailById = new Map(snaps.filter(s => s.exists).map(s => [s.id, String(s.data()?.email || '').trim().toLowerCase()]));
            for (const r of missing) {
                const email = emailById.get(r.userId);
                if (email && email.includes('@')) r.email = email;
            }
        } catch (err) {
            console.error('[ClassAlert] profile email lookup failed:', err);
        }
    }

    return recipients;
}

async function createInAppNotifications({ recipients, sessionId, groupId, groupName, kind, title, lecturer }: {
    recipients: Recipient[];
    sessionId: string;
    groupId: string;
    groupName: string;
    kind: ClassAlertKind;
    title: string;
    lecturer: string;
}): Promise<number> {
    const isLive = kind === 'live';
    const body = isLive
        ? `${groupName} · ${lecturer} has started the class`
        : `${groupName} · scheduled by ${lecturer}`;
    const CHUNK = 400;
    let created = 0;

    for (let i = 0; i < recipients.length; i += CHUNK) {
        try {
            const batch = adminDb.batch();
            for (const r of recipients.slice(i, i + CHUNK)) {
                batch.set(adminDb.collection('notifications').doc(), {
                    userId: r.userId,
                    groupId,
                    groupName,
                    sessionId,
                    kind,
                    title,
                    body,
                    lecturerName: lecturer,
                    read: false,
                    createdAt: FieldValue.serverTimestamp(),
                });
            }
            await batch.commit();
            created += Math.min(CHUNK, recipients.length - i);
        } catch (err) {
            console.error('[ClassAlert] in-app notification write failed:', err);
        }
    }
    return created;
}

async function sendEmails({ emails, isLive, title, lecturer, groupName, sessionId }: {
    emails: string[];
    isLive: boolean;
    title: string;
    lecturer: string;
    groupName: string;
    sessionId: string;
}): Promise<number> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error('[ClassAlert] RESEND_API_KEY missing');
        return 0;
    }

    const joinUrl = `${APP_URL}/classroom/${sessionId}`;
    const subject = isLive
        ? `🔴 Live now: ${title} — ${groupName}`
        : `📅 New class scheduled: ${title} — ${groupName}`;
    const headerColor = isLive ? '#dc2626' : '#1845D4';
    const headerTitle = isLive ? '&#128308; Class is LIVE' : '&#128197; New class scheduled';
    const headline = isLive
        ? `<strong style="color:#111827;">${title}</strong> has just started.`
        : `<strong style="color:#111827;">${title}</strong> has been scheduled for your community.`;
    const cta = isLive ? 'Join the classroom &rarr;' : 'View the class &rarr;';

    // Resend batched sends; chunk to stay within limits
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
                    subject,
                    html: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
<tr><td style="background:${headerColor};padding:26px 32px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:20px;">${headerTitle}</h1>
<p style="margin:6px 0 0;color:#dbeafe;font-size:13px;">${groupName}</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 14px;font-size:15px;color:#374151;">${headline}</p>
<p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Lecturer: ${lecturer}</p>
<a href="${joinUrl}" style="display:inline-block;background:#1845D4;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 28px;border-radius:10px;">${cta}</a>
<p style="margin:22px 0 0;font-size:12px;color:#9ca3af;">You are receiving this because you are a member of ${groupName} on Podium.</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
                }),
            });
            if (res.ok) sent += batch.length;
            else console.error('[ClassAlert] batch failed:', res.status, await res.text().catch(() => ''));
        } catch (err) {
            console.error('[ClassAlert] batch error:', err);
        }
    }
    return sent;
}
