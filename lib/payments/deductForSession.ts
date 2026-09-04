'use client';
import { auth } from '@/lib/firebase/config';

export async function deductForSession(sessionId: string, checkOnly = false) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    const res = await fetch('/api/wallet/deduct', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, checkOnly }),
    });
    const data = await res.json();
    if (!res.ok) {
        const err: any = new Error(data.error || 'Deduct failed');
        err.data = data;
        err.status = res.status;
        throw err;
    }
    return data;
}

export async function checkCanAfford(sessionId: string) {
    return deductForSession(sessionId, true);
}
