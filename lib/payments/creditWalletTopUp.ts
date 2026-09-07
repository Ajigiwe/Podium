import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

interface WalletTopUp {
    userId: string;
    reference: string;
    amount: number; // pesewas
    paymentChannel?: string;
    verifiedVia: 'webhook' | 'api_fallback';
}

/**
 * True for any transaction doc that represents a wallet top-up, including the
 * shapes written by older code:
 *  - type 'top_up'       (verify route / initialize route metadata)
 *  - type 'wallet_topup' (older init route metadata)
 *  - no type + sessionId 'wallet_topup' (old webhook never wrote `type`)
 */
function looksLikeWalletTopUp(t: any): boolean {
    return (
        t?.type === 'top_up' ||
        t?.type === 'wallet_topup' ||
        t?.sessionId === 'wallet_topup'
    );
}

/**
 * Credits a wallet and writes its ledger entry atomically. The Paystack
 * reference is the idempotency key in `topup_credits` (the same collection the
 * webhook uses), so webhook/verify races cannot credit the same payment twice.
 * It also writes the `transaction_credits` marker so a late-arriving webhook
 * does not record a duplicate transaction row.
 *
 * Also migrates legacy transactions that were recorded but never credited (the
 * old webhook only credited `wallet_topup` metadata while the initializers sent
 * `top_up`, and older code omitted the `type` field entirely).
 */
export async function creditWalletTopUp({
    userId,
    reference,
    amount,
    paymentChannel = 'unknown',
    verifiedVia,
}: WalletTopUp) {
    if (!userId || userId === 'unknown') throw new Error('Missing userId in payment metadata');
    if (!reference) throw new Error('Missing payment reference');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid top-up amount');

    const transactions = adminDb.collection('transactions');
    const profileRef = adminDb.collection('profiles').doc(userId);
    // Shared idempotency keys with the webhook (see app/api/paystack/webhook/route.ts)
    const ledgerRef = adminDb.collection('topup_credits').doc(reference);
    const txMarkerRef = adminDb.collection('transaction_credits').doc(reference);
    let credited = false;

    await adminDb.runTransaction(async transaction => {
        const markerSnap = await transaction.get(ledgerRef);
        if (markerSnap.exists) return; // already credited

        const existingSnap = await transaction.get(
            transactions.where('paystackReference', '==', reference).limit(1)
        );
        const existing = existingSnap.empty ? null : existingSnap.docs[0];
        const profileSnap = await transaction.get(profileRef);
        if (!profileSnap.exists) throw new Error('Profile not found');

        const now = Timestamp.now();
        const currentBalance = Number(profileSnap.data()?.walletBalance) || 0;

        if (existing) {
            const existingData = existing.data() as any;
            // Migrate a transaction written by the old webhook/verify code: it
            // recorded the payment but skipped the wallet credit. Only credit
            // once — if verifiedVia is set, the credit already happened.
            if (looksLikeWalletTopUp(existingData) && !existingData.verifiedVia) {
                transaction.update(profileRef, {
                    walletBalance: currentBalance + amount,
                    walletCurrency: 'GHS',
                    walletUpdatedAt: now,
                    updatedAt: now,
                });
                transaction.update(existing.ref, {
                    type: 'top_up',
                    verifiedVia,
                    status: 'succeeded',
                });
                transaction.set(ledgerRef, {
                    userId,
                    reference,
                    amount,
                    paymentChannel,
                    verifiedVia,
                    migrated: true,
                    createdAt: now,
                });
                transaction.set(txMarkerRef, {
                    userId,
                    reference,
                    status: 'succeeded',
                    createdAt: now,
                });
                credited = true;
            }
            return;
        }

        transaction.update(profileRef, {
            walletBalance: currentBalance + amount,
            walletCurrency: 'GHS',
            walletUpdatedAt: now,
            updatedAt: now,
        });
        transaction.create(transactions.doc(), {
            userId,
            sessionId: 'wallet_topup',
            paystackReference: reference,
            amount,
            currency: 'GHS',
            paymentChannel,
            status: 'succeeded',
            type: 'top_up',
            createdAt: now,
            paidAt: now,
            verifiedVia,
        });
        transaction.set(ledgerRef, {
            userId,
            reference,
            amount,
            paymentChannel,
            verifiedVia,
            createdAt: now,
        });
        transaction.set(txMarkerRef, {
            userId,
            reference,
            status: 'succeeded',
            createdAt: now,
        });
        credited = true;
    });

    const profile = await profileRef.get();
    return {
        credited,
        balance: Number(profile.data()?.walletBalance) || 0,
    };
}