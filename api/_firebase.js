// NAMTLS server-side Firebase init (ADMIN SDK only).
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const missingFirebaseEnv = process.env.FIREBASE_SERVICE_ACCOUNT
  ? []
  : ['FIREBASE_SERVICE_ACCOUNT'];

let firestore;

export function getDb() {
  if (firestore) return firestore;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not set in Vercel env vars');
  }
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  firestore = getFirestore();
  return firestore;
}

// =====================================================================
// SHARED FINANCE LEDGER — single source of truth for money IN.
// ---------------------------------------------------------------------
// BOTH /api/verify-payment AND /api/flutterwave-webhook credit money
// through creditPaymentOnce(). The "already credited?" check and the
// credit itself run inside ONE Firestore transaction, so exactly one
// path can ever win per transaction_id — no double balance increases,
// no matter which event arrives first (or at the same millisecond).
// =====================================================================

const ACTIVATION_MIN_AMOUNT = 25000;
const ACTIVATION_REF_RE = /^ACT-(\d{4})-(\d{4})-/;

// =====================================================================
// ACTIVATION PRICE BOOK — the fee is no longer hard-coded.
// The Super Admin Dashboard writes: settings/activationPricing =
//   { maintenance, siteUpdate, databaseUpgrading, freeYears: [...] }
// Until that document exists we keep the OLD behaviour (₦25,000) so
// nothing changes until you deliberately set a price from the control room.
// =====================================================================
export async function getActivationPricing(db) {
  const database = db || getDb();
  const fallback = { maintenance: 0, siteUpdate: 0, databaseUpgrading: 0, total: ACTIVATION_MIN_AMOUNT, freeYears: ['2026/2027'], usingFallback: true };
  try {
    const snap = await database.doc('settings/activationPricing').get();
    if (!snap.exists) return fallback;
    const d = snap.data();
    const nums = [d.maintenance, d.siteUpdate, d.databaseUpgrading].map(Number);
    if (nums.some(n => !Number.isFinite(n))) return fallback;
    return {
      maintenance: nums[0],
      siteUpdate: nums[1],
      databaseUpgrading: nums[2],
      total: nums[0] + nums[1] + nums[2],
      freeYears: Array.isArray(d.freeYears) ? d.freeYears : [],
      usingFallback: false,
    };
  } catch (e) {
    return fallback;
  }
}

/** Extract "YYYY/YYYY" from an ACT- tx_ref, or null if it doesn't match. */
export function parseActivationYear(txRef) {
  const m = String(txRef || '').match(ACTIVATION_REF_RE);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * Atomically credit a payment EXACTLY ONCE.
 *
 * @param {object} opts
 * @param {string} opts.transactionId  - Flutterwave transaction id (ledger key)
 * @param {string} [opts.txRef]        - Flutterwave tx_ref (must be ACT- for activations)
 * @param {number} opts.amount         - amount paid (must be >= 25000 for activations)
 * @param {'activation'|'form'} opts.kind - what this payment is for
 * @param {string} [opts.academicYear] - required for kind='activation'
 * @param {object} [opts.meta]         - extra fields stored on the receipt
 * @returns {Promise<{credited: boolean, reason: string, receipt?: object}>}
 *   reason: 'credited' | 'already-credited' | 'year-already-activated'
 *           | 'below-minimum' | 'invalid-tx-ref' | 'year-mismatch'
 *           | 'missing-transaction-id'
 */
export async function creditPaymentOnce({ transactionId, txRef, amount, kind, academicYear, meta = {} }) {
  const db = getDb();
  const tid = String(transactionId || '').trim();
  if (!tid) return { credited: false, reason: 'missing-transaction-id' };

  const paid = Number(amount) || 0;
  const ref = String(txRef || '');
  const year = kind === 'activation'
    ? (academicYear || parseActivationYear(ref))
    : null;

  // ---- Kind-specific rules (enforced for BOTH callers so they can't drift) ----
  if (kind === 'activation') {
    if (!ref.startsWith('ACT-') || !year) {
      return { credited: false, reason: 'invalid-tx-ref' };
    }
    if (academicYear && parseActivationYear(ref) !== academicYear) {
      return { credited: false, reason: 'year-mismatch' };
    }
    // Minimum now comes from the Super Admin price book (settings/activationPricing).
    // Falls back to the old fixed ₦25,000 until a price book is saved.
    const pricing = await getActivationPricing(db);
    const minimum = pricing.usingFallback ? ACTIVATION_MIN_AMOUNT : pricing.total;
    if (paid < minimum) {
      return { credited: false, reason: 'below-minimum' };
    }
  }

  const receiptRef = db.doc(`paymentReceipts/${tid}`);
  const balanceRef = db.doc('finances/withdrawalBalance');

  let outcome;
  await db.runTransaction(async (tx) => {
    // 1) Is this transaction already in the ledger? (same check for both paths)
    const receiptSnap = await tx.get(receiptRef);
    if (receiptSnap.exists) {
      outcome = { credited: false, reason: 'already-credited', receipt: receiptSnap.data() };
      return;
    }

    // 2) Activation: reject a SECOND payment for an already-paid year.
    if (kind === 'activation') {
      const activationsSnap = await tx.get(db.doc('finances/activations'));
      if (activationsSnap.exists && activationsSnap.data()[year]?.paid) {
        outcome = { credited: false, reason: 'year-already-activated' };
        return;
      }
    }

    // 3) Claim + credit in the same atomic step.
    tx.set(receiptRef, {
      transactionId: tid,
      txRef: ref,
      amount: paid,
      kind,
      ...(year ? { academicYear: year } : {}),
      ...meta,
      creditedAt: new Date().toISOString(),
    });

    tx.set(balanceRef, {
      balance: FieldValue.increment(paid),
      totalReceived: FieldValue.increment(paid),
      lastPaymentAt: new Date().toISOString(),
    }, { merge: true });

    // 4) Kind-specific bookkeeping — same transaction, can't half-apply.
    if (kind === 'activation') {
      tx.set(db.doc('finances/activations'), {
        [year]: {
          paid: true,
          amount: paid,
          paidAt: new Date().toISOString(),
          txRef: ref,
          transactionId: tid,
        },
      }, { merge: true });
    }
    if (kind === 'form') {
      tx.set(db.doc(`formPurchases/${tid}`), {
        ...meta,
        amount: paid,
        status: 'paid',
        transactionId: tid,
        txRef: ref,
        paidAt: new Date().toISOString(),
      });
    }

    outcome = { credited: true, reason: 'credited' };
  });

  return outcome;
}