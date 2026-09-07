/**
 * One-off admin backfill: recompute walletBalance for every user from their
 * succeeded transactions, and create profile docs for accounts that never got
 * one (legacy static-site signups).
 *
 * The balance logic mirrors app/api/wallet/reconcile/route.ts exactly, so a
 * later page-load reconcile can never disagree with this script:
 *   top_up / wallet_topup  -> +
 *   refund                 -> +
 *   session_payment        -> -
 *   typeless + wallet_topup sessionId, amount > 0 -> +  (old webhook shape)
 * Clamped at 0. Amounts are pesewas.
 *
 * Usage (run inside the podium-app container or wherever firebase-admin + the
 * FIREBASE_ADMIN_* env vars are available):
 *   APPLY=1 node scripts/reconcile-all-wallets.js   # apply
 *   node scripts/reconcile-all-wallets.js           # dry-run (no writes)
 */
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const APPLY = process.env.APPLY === '1';

let adminApp = getApps()[0];
if (!adminApp) {
  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore(adminApp);
const auth = getAuth(adminApp);

/** Mirrors the reconcile route's per-transaction wallet movement. */
function movementDelta(t) {
  const amt = Number(t.amount) || 0;
  if (t.type === 'top_up' || t.type === 'wallet_topup') return amt;
  if (t.type === 'refund') return amt;
  if (t.type === 'session_payment') return -amt;
  if (!t.type && t.sessionId === 'wallet_topup' && amt > 0) return amt;
  return 0;
}

(async () => {
  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const snap = await db.collection('transactions')
    .where('status', '==', 'succeeded')
    .get();
  console.log('succeeded transactions:', snap.size);

  const perUser = new Map();
  let movements = 0;
  snap.forEach((d) => {
    const t = d.data();
    const delta = movementDelta(t);
    if (delta === 0) return;
    const uid = t.userId;
    if (!uid || typeof uid !== 'string' || !uid.trim()) return;
    movements += 1;
    perUser.set(uid, (perUser.get(uid) || 0) + delta);
  });
  console.log('wallet-movement transactions:', movements, '| users with movements:', perUser.size);

  const created = [];
  const updated = [];
  const unchanged = [];
  const skippedZero = [];
  const errored = [];
  const now = Timestamp.now();

  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) {
      if (APPLY) await batch.commit();
      ops = 0;
      batch = db.batch();
    }
  };

  for (const [uid, raw] of perUser) {
    const correct = raw < 0 ? 0 : raw;
    const ref = db.collection('profiles').doc(uid);
    try {
      const prof = await ref.get();
      const exists = prof.exists;
      const current = exists ? Number(prof.data()?.walletBalance) || 0 : null;

      if (exists && current === correct) {
        unchanged.push(uid);
        continue;
      }
      if (!exists && correct === 0) {
        // No wallet credit ever landed — don't manufacture empty profiles.
        skippedZero.push(uid);
        continue;
      }

      const fields = {
        walletBalance: correct,
        walletCurrency: 'GHS',
        walletUpdatedAt: now,
        updatedAt: now,
      };

      if (exists) {
        batch.update(ref, fields);
        updated.push({ uid, from: current, to: correct });
      } else {
        let email = null;
        let fullName = 'User';
        try {
          const u = await auth.getUser(uid);
          email = u.email || null;
          fullName = u.displayName || (email ? email.split('@')[0] : 'User');
        } catch {}
        batch.set(ref, { id: uid, email, fullName, role: 'student', ...fields, createdAt: now });
        created.push({ uid, to: correct, email });
      }
      ops += 1;
      if (ops >= 400) await flush();
    } catch (e) {
      errored.push({ uid, error: e.message });
    }
  }
  await flush();

  console.log('=== RESULTS ===');
  console.log(`created profiles:   ${created.length}`);
  created.forEach((c) => console.log('  +', c.uid, 'balance', c.to, 'email', c.email ?? '(none)'));
  console.log(`updated balances:   ${updated.length}`);
  updated.forEach((u) => console.log('  ~', u.uid, u.from, '->', u.to));
  console.log(`unchanged:          ${unchanged.length}`);
  unchanged.forEach((uid) => console.log('  =', uid, '(profile exists, balance already correct)'));
  console.log(`skipped (0-balance, no profile): ${skippedZero.length}`);
  console.log(`errors:             ${errored.length}`);
  errored.forEach((e) => console.log('  !', e.uid, e.error));
  console.log(`done. ${APPLY ? 'changes applied' : 'dry-run only — rerun with APPLY=1 to write'}`);
})().catch((e) => {
  console.error('SCRIPT FAILED:', e.message);
  process.exit(1);
});