'use client';
import { auth } from '@/lib/firebase/config';

export async function initializeTopUp(amountPesewas: number, callbackUrl?: string): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    const res = await fetch('/api/wallet/topup/initialize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountPesewas, callbackUrl: callbackUrl || `${window.location.origin}/dashboard?topup=success` }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to initialize top-up');
    return data.authorizationUrl;
}

export function toPesewas(ghs: number): number {
    return Math.round(ghs * 100);
}
export function fromPesewas(pesewas: number): string {
    return (pesewas / 100).toFixed(2);
}
