/**
 * Backfill walletBalance for existing profiles
 * Run: npx tsx scripts/backfillWallet.ts
 */
import { adminDb } from '../lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

async function main() {
    const snap = await adminDb.collection('profiles').get();
    let updated = 0;
    const batchSize = 400;
    let batch = adminDb.batch();
    let count = 0;
    for (const doc of snap.docs) {
        const d:any = doc.data();
        if (d.walletBalance === undefined) {
            batch.update(doc.ref, { walletBalance: 0, walletCurrency: 'GHS', walletUpdatedAt: Timestamp.now() });
            count++; updated++;
            if (count >= batchSize) { await batch.commit(); batch = adminDb.batch(); count = 0; }
        }
    }
    if (count>0) await batch.commit();
    console.log(`Backfilled ${updated} profiles`);

    // Ensure wallet settings doc exists
    const wRef = adminDb.collection('system_settings').doc('wallet');
    const wSnap = await wRef.get();
    if (!wSnap.exists) {
        await wRef.set({ id:'wallet', isWalletPayToUse: true, defaultSessionFee: 2000, minTopUpAmount: 500, currency:'GHS', updatedAt: Timestamp.now() });
        console.log('Created wallet settings');
    } else {
        console.log('Wallet settings exists', wSnap.data());
    }
}
main().catch(e=>{ console.error(e); process.exit(1); });
