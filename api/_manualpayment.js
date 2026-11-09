// ============================================================================
// NAMATLS MANUAL BANK TRANSFER ENGINE
// ----------------------------------------------------------------------------
// A student who cannot (or does not want to) use the Flutterwave checkout pays
// the SAME amount into the association's published bank account, then submits
// proof: date paid, amount, the account they paid FROM, the account they paid
// INTO, the receiver name and a screenshot of the bank alert.
//
// This file does three jobs, all server-side (nothing here trusts the browser):
//   1. auditManualProof()      — runs every possible "is this transfer fake?"
//                                check and returns a human-readable report.
//   2. price checks            — re-reads the REAL price from Firestore so a
//                                student can never pay less than the real fee
//                                and have it approved by accident.
//   3. approveManualPayment()  — credits money through the SAME atomic ledger
//                                as Flutterwave (creditPaymentOnce), so the
//                                balance can NEVER be double-credited, and
//                                marks the form purchase / activation paid.
//
// The leading underscore means Vercel does NOT count this as a serverless
// function (Hobby plan limit: 12 functions).
// ============================================================================
import { getAdminDb } from './_admin.js';
import { creditPaymentOnce, getActivationPricing } from './_firebase.js';
import { writeAudit } from './_audit.js';

export const MANUAL_TX_PREFIX = 'MANUAL-';
const AMOUNT_TOLERANCE = 1;      // ₦1 rounding grace
const MAX_PROOF_AGE_DAYS = 7;    // older than this = suspicious
const DUPLICATE_WINDOW_HOURS = 48;

export const BANK_DETAILS_FALLBACK = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  extraNote: '',
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// ---------------------------------------------------------------------------
// PARSERS + NORMALISERS
// ---------------------------------------------------------------------------

/**
 * Accepts:
 *   '2026-11-09'            (HTML date input)
 *   '09/11/2026'  '9/11/26' (Nigerian style, DAY first)
 *   '2026/11/09'           (ISO with slashes)
 *   '09-11-2026'
 *   '9 Nov 2026' / '09 November 2026'
 * Returns 'YYYY-MM-DD' or '' — never throws.
 */
export function normalizePaymentDate(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  // 1) yyyy-mm-dd (already ISO)
  let m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return padDate(m[1], m[2], m[3]);

  // 2) dd/mm/yyyy — Nigerian banks always print day first
  m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = (Number(year) > 70 ? '19' : '20') + year;
    return padDate(year, m[2], m[1]);
  }

  // 3) 9 Nov 2026 / 09 November, 2026
  m = raw.toLowerCase().match(/^(\d{1,2})\s*[-\s]\s*([a-z]{3,9})\.?\s*[-\s,]\s*(\d{4})$/);
  if (m) {
    const monthIdx = MONTHS.indexOf(m[2].slice(0, 3));
    if (monthIdx >= 0) return padDate(m[3], String(monthIdx + 1), m[1]);
  }

  // 4) Nov 9, 2026
  m = raw.toLowerCase().match(/^([a-z]{3,9})\.?\s*(\d{1,2}),?\s*(\d{4})$/);
  if (m) {
    const monthIdx = MONTHS.indexOf(m[1].slice(0, 3));
    if (monthIdx >= 0) return padDate(m[3], String(monthIdx + 1), m[2]);
  }

  // 5) Last resort: let the engine try (only trust it if it produced a date)
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return '';
}

function padDate(y, mo, d) {
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (!year || !month || !day) return '';
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCMonth() !== month - 1) return ''; // rejects 31 Feb
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Digits only, leading zeros kept. */
export function normalizeAccountNumber(input) {
  return String(input || '').replace(/\D/g, '');
}

/** Lowercase, strip punctuation/spaces/limited-suffixes so "Opay" == "OPAY BANK". */
export function normalizeName(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\b(bank|plc|ltd|limited|nigeria|ng)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Loose name comparison. Bank alerts print names in many orders
 * ("UWAZIE DANIEL CHIDUBEM" vs "Daniel Chidubem Uwazie"), so a plain equality
 * test would reject real payments. We compare the significant tokens instead.
 */
export function compareNames(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return { match: false, reason: 'missing' };
  if (na === nb) return { match: true, reason: 'exact' };
  if (na.includes(nb) || nb.includes(na)) return { match: true, reason: 'contained' };

  const tokensA = na.split(' ').filter(t => t.length > 1);
  const tokensB = nb.split(' ').filter(t => t.length > 1);
  if (!tokensA.length || !tokensB.length) return { match: false, reason: 'missing' };

  const setB = new Set(tokensB);
  const shared = tokensA.filter(t => setB.has(t));
  const coverage = shared.length / Math.max(tokensA.length, tokensB.length);

  if (coverage >= 0.5) return { match: true, reason: 'tokens', coverage };
  return { match: false, reason: 'tokens', coverage };
}

// ---------------------------------------------------------------------------
// SETTINGS (bank account + price, both admin-controlled in Firestore)
// ---------------------------------------------------------------------------
export async function getManualSettings(db) {
  const database = db || getAdminDb();
  const [settingsSnap, formSnap, activationPricing] = await Promise.all([
    database.doc('settings/manualPayment').get(),
    database.doc('settings/formPurchase').get(),
    getActivationPricing(database),
  ]);

  const s = settingsSnap.exists ? settingsSnap.data() : {};
  const bank = {
    bankName: String(s.bankName || ''),
    accountName: String(s.accountName || ''),
    accountNumber: String(s.accountNumber || ''),
    extraNote: String(s.extraNote || ''),
  };

  // Configured once from the Admin Dashboard, so the student page never needs
  // read access to settings/* (Firestore rules stay locked).
  const rawPrice = Number(s.manualFormAmount);
  const manualFormAmount = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;

  const positions = formSnap.exists && Array.isArray(formSnap.data().positions)
    ? formSnap.data().positions.map(p => ({ position: String(p.position || ''), amount: Number(p.amount) || 0 }))
    : [];

  return {
    bank,
    enabled: !!s.isEnabled,
    instructions: String(s.instructions || ''),
    manualFormAmount,
    positions,
    activationTotal: activationPricing.usingFallback ? 25000 : activationPricing.total,
  };
}

/** Real price the student must pay for a purpose. Server-owned, never client. */
export async function resolveExpectedAmount(db, purpose, position) {
  const database = db || getAdminDb();
  if (purpose === 'activation') {
    const pricing = await getActivationPricing(database);
    return { amount: pricing.usingFallback ? 25000 : pricing.total, label: 'Academic year activation', position: '' };
  }
  const pos = String(position || '').trim();
  if (!pos) return { error: 'Please choose the position you are contesting for.' };

  const snap = await database.doc('settings/formPurchase').get();
  const positions = snap.exists && Array.isArray(snap.data().positions) ? snap.data().positions : [];
  const match = positions.find(p => String(p.position).trim().toLowerCase() === pos.toLowerCase());
  if (!match) {
    return { error: `Position "${pos}" is not available for purchase. Refresh the page and pick again.` };
  }
  const amount = Number(match.amount) || 0;
  if (amount <= 0) return { error: 'The price for this position has not been set yet. Contact the Electoral Commission.' };
  return { amount, label: `${match.position} nomination form`, position: String(match.position) };
}

// ---------------------------------------------------------------------------
// THE CHECKER — every "is this transfer fake?" test in one place.
// Each check is { key, label, status: pass|warn|fail, detail }.
// `score` = proof submitted with the claim (so the student gets fast feedback);
// `approved`-time checks re-run against the live price and the ledger.
// ---------------------------------------------------------------------------
export function auditManualProof(proof, context = {}) {
  const checks = [];
  const add = (key, label, status, detail) => checks.push({ key, label, status, detail });

  // ---- 1. Account they paid INTO must be OUR account ----
  if (context.expectedAccount) {
    const paidTo = normalizeAccountNumber(proof.paidToAccount) || normalizeAccountNumber(proof.accountNumber);
    if (!paidTo) {
      add('receiving_account', 'Receiving account matches ours', 'fail', 'No receiving account number was supplied.');
    } else if (paidTo === context.expectedAccount) {
      add('receiving_account', 'Receiving account matches ours', 'pass', `Ends ${last4(paidTo)} — matches the published account.`);
    } else {
      add('receiving_account', 'Receiving account matches ours', 'fail', `Proof shows ••••${last4(paidTo)} but our account ends ••••${last4(context.expectedAccount)}. This is NOT our account.`);
    }
  }

  // ---- 2. Receiver NAME on the alert must be the association ----
  if (context.expectedAccountName) {
    const cmp = compareNames(proof.receiverName || proof.accountName, context.expectedAccountName);
    if (cmp.reason === 'missing') {
      add('receiver_name', 'Receiver name is ours', 'fail', 'The receiver name is blank.');
    } else if (cmp.match) {
      add('receiver_name', 'Receiver name is ours', 'pass', `"${proof.receiverName || proof.accountName}" matches the account name.`);
    } else {
      add('receiver_name', 'Receiver name is ours', 'fail', `"${proof.receiverName || proof.accountName}" does not match "${context.expectedAccountName}".`);
    }
  }

  // ---- 3. Amount must cover the real fee ----
  if (Number(context.expectedAmount) > 0) {
    const paid = Number(proof.amount) || 0;
    const expected = Number(context.expectedAmount);
    if (paid <= 0) {
      add('amount', 'Amount is correct', 'fail', 'No amount entered.');
    } else if (paid + AMOUNT_TOLERANCE >= expected) {
      const extra = paid - expected;
      add('amount', 'Amount is correct', 'pass', extra > 0
        ? `₦${paid.toLocaleString()} covers the ₦${expected.toLocaleString()} fee (₦${extra.toLocaleString()} extra).`
        : `₦${paid.toLocaleString()} — exact fee.`);
    } else {
      add('amount', 'Amount is correct', 'fail', `Paid ₦${paid.toLocaleString()} but ₦${expected.toLocaleString()} is required (short by ₦${(expected - paid).toLocaleString()}).`);
    }
  }

  // ---- 4. Payment date must be real, not in the future, not ancient ----
  const date = normalizePaymentDate(proof.paymentDate);
  if (!date) {
    add('date', 'Payment date is valid', 'fail', 'The payment date could not be read. Use the date printed on your bank alert.');
  } else {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const ageDays = Math.floor((Date.parse(todayIso) - Date.parse(date)) / 86400000);
    if (date > todayIso) {
      add('date', 'Payment date is valid', 'fail', `${date} is in the FUTURE — not possible for a real transfer.`);
    } else if (ageDays > MAX_PROOF_AGE_DAYS) {
      add('date', 'Payment date is valid', 'warn', `${date} is ${ageDays} days ago. Old alert — confirm it was not already used.`);
    } else {
      add('date', 'Payment date is valid', 'pass', `${date} (${ageDays === 0 ? 'today' : ageDays + ' day(s) ago'}).`);
    }
  }

  // ---- 5. Sender account: masked alerts or 10 digits ----
  const sender = normalizeAccountNumber(proof.senderAccount);
  if (sender.length === 10) {
    add('sender_account', 'Your paying account is readable', 'pass', `Account ••••${last4(sender)} recorded.`);
  } else if (proof.senderHidden) {
    // Opay/Kuda alerts often print "****1234" — acceptable, the admin verifies
    // it against the screenshot instead of the typed digits.
    add('sender_account', 'Your paying account is readable', 'pass', 'Bank masked the sender digits — verify on the screenshot.');
  } else if (!sender) {
    add('sender_account', 'Your paying account is readable', 'warn', 'No account you paid from was given.');
  } else {
    add('sender_account', 'Your paying account is readable', 'warn', `${sender.length} digits found — a Nigerian account number has 10. Double-check it.`);
  }

  // ---- 6. Sender account must not be our own receiving account ----
  if (context.expectedAccount && sender && sender === context.expectedAccount) {
    add('self_transfer', 'Not a self-transfer to our account', 'fail', 'The sender account is the same as the receiving account. This is not a real transfer.');
  }

  // ---- 7. Bank name present ----
  const bankName = String(proof.senderBank || '').trim();
  if (!bankName) {
    add('bank', 'Your bank name is provided', 'warn', 'Bank name missing.');
  } else {
    // The bridge account is a wallet bank (Opay/Moniepoint etc.) — paying from
    // the SAME bank is fine, so this is only informational, never a failure.
    add('bank', 'Your bank name is provided', 'pass', bankName);
  }

  // ---- 8. Transfer reference / session ID ----
  const ref = String(proof.transferReference || '').trim();
  if (!ref) {
    add('transfer_reference', 'Bank reference / session ID', 'warn', 'No bank reference supplied — the screenshot is the only trail.');
  } else if (ref.length < 6) {
    add('transfer_reference', 'Bank reference / session ID', 'warn', `"${ref}" is very short for a bank reference.`);
  } else {
    add('transfer_reference', 'Bank reference / session ID', 'pass', ref);
  }

  // ---- 9. Proof of payment image ----
  const receiptUrl = String(proof.receiptUrl || '').trim();
  if (!receiptUrl) {
    add('receipt', 'Screenshot of the alert attached', 'fail', 'No proof of payment image was attached.');
  } else if (!/^https:\/\//i.test(receiptUrl)) {
    add('receipt', 'Screenshot of the alert attached', 'fail', 'The proof image link is not a secure https link.');
  } else {
    add('receipt', 'Screenshot of the alert attached', 'pass', receiptUrl);
  }

  // ---- 10. Duplicate detection (same money claimed twice) ----
  const dup = context.duplicateOf;
  if (dup) {
    add('duplicate', 'Not already submitted', 'fail', `This looks like a duplicate of ${dup.reference || 'an existing submission'} (${dup.status || 'pending'}).`);
  } else {
    add('duplicate', 'Not already submitted', 'pass', 'No previous submission matches this bank reference.');
  }

  // ---- Verdict ----
  const failures = checks.filter(c => c.status === 'fail');
  const warnings = checks.filter(c => c.status === 'warn');
  let verdict = 'clean';
  if (failures.length) verdict = 'blocked';       // cannot be approved blindly
  else if (warnings.length) verdict = 'review';   // admin must look carefully
  else verdict = 'clean';                         // everything lines up

  return {
    checks,
    verdict,
    failures: failures.map(c => c.label),
    warnings: warnings.map(c => c.label),
    normalizedDate: date,
    score: Math.round((checks.filter(c => c.status === 'pass').length / Math.max(checks.length, 1)) * 100),
  };
}

function last4(value) {
  return String(value || '').slice(-4);
}

// ---------------------------------------------------------------------------
// DUPLICATE LOOKUP
// Two submissions are duplicates when they claim the same money:
//   same bank reference, OR same sender account + same amount + same date.
// A REJECTED claim does not block a re-submission (student may have fixed a
// typo), so only pending/approved records count.
// ---------------------------------------------------------------------------
export async function findDuplicateSubmission(db, { transferReference, senderAccount, amount, paymentDate }, excludeId = '') {
  const database = db || getAdminDb();
  const snap = await database.collection('manualPayments')
    .where('status', 'in', ['pending', 'approved'])
    .limit(300)
    .get();

  const ref = String(transferReference || '').trim().toLowerCase();
  const sender = normalizeAccountNumber(senderAccount);
  const amt = Number(amount) || 0;
  const date = normalizePaymentDate(paymentDate);

  for (const doc of snap.docs) {
    if (doc.id === excludeId) continue;
    const d = doc.data();
    const sameRef = ref && String(d.transferReference || '').trim().toLowerCase() === ref;
    const sameMoney = sender && amt && date
      && normalizeAccountNumber(d.senderAccount) === sender
      && Number(d.amount) === amt
      && normalizePaymentDate(d.paymentDate) === date;
    if (sameRef || sameMoney) {
      return { id: doc.id, reference: d.reference, status: d.status, sameRef, sameMoney };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// APPROVE — the only place a manual payment becomes real money.
// Everything happens in Firestore transactions, so a double-click, a retry or
// two admins on two phones can NEVER credit twice.
// ---------------------------------------------------------------------------
export async function approveManualPayment({ id, reviewer = 'admin', note = '' }) {
  const db = getAdminDb();
  const ref = db.collection('manualPayments').doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return { success: false, message: 'This submission no longer exists.' };

  const sub = snap.data();
  if (sub.status === 'approved') {
    return { success: true, alreadyApproved: true, message: `Already approved (${sub.reference}). No money was added twice.` };
  }
  if (sub.status !== 'pending') {
    return { success: false, message: `This submission is ${sub.status} and cannot be approved.` };
  }

  const purpose = sub.purpose === 'activation' ? 'activation' : 'form';
  const transactionId = String(sub.transactionId || (MANUAL_TX_PREFIX + sub.reference));
  const paid = Number(sub.amount) || 0;

  // Re-read the REAL price at approval time (the price book may have changed
  // since submission; the admin's number must win, never the student's).
  const expected = await resolveExpectedAmount(db, purpose, sub.position);
  if (expected.error) {
    return { success: false, message: `Cannot approve: ${expected.error}` };
  }
  if (paid + AMOUNT_TOLERANCE < expected.amount) {
    return {
      success: false,
      message: `Cannot approve: student paid ₦${paid.toLocaleString()} but ₦${expected.amount.toLocaleString()} is required. Reject and ask them to top up the balance.`,
    };
  }

  // ---- Claim the submission FIRST (atomic) so two admins can't both proceed ----
  const claimed = await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (!cur.exists) return { ok: false, message: 'This submission no longer exists.' };
    const data = cur.data();
    if (data.status !== 'pending') return { ok: false, message: `This submission is already ${data.status}.` };
    tx.set(ref, {
      status: 'approving',
      reviewedBy: reviewer,
      reviewNote: note || '',
      approvedAt: new Date().toISOString(),
    }, { merge: true });
    return { ok: true };
  });

  if (!claimed.ok) return { success: false, message: claimed.message };

  // ---- Credit the shared ledger (idempotent by transactionId) ----
  const activationYear = purpose === 'activation' ? String(sub.academicYear || '') : null;
  let credit;
  try {
    credit = await creditPaymentOnce({
      transactionId,
      txRef: String(sub.reference),
      amount: paid,
      kind: purpose,
      academicYear: activationYear || undefined,
      meta: {
        method: 'manual_bank_transfer',
        manualPaymentId: String(id),
        paidToAccount: String(sub.paidToAccount || ''),
        receiverName: String(sub.receiverName || ''),
        senderAccount: String(sub.senderAccount || ''),
        senderBank: String(sub.senderBank || ''),
        paymentDate: String(sub.paymentDate || ''),
        transferReference: String(sub.transferReference || ''),
        receiptUrl: String(sub.receiptUrl || ''),
        fullName: String(sub.fullName || ''),
        department: String(sub.department || ''),
        level: String(sub.level || ''),
        email: String(sub.email || ''),
        position: String(sub.position || ''),
        ...(activationYear ? { academicYear: activationYear } : {}),
      },
    });
  } catch (e) {
    // Money move failed — put the submission back so the admin can retry.
    await ref.set({ status: 'pending', reviewNote: `Approval failed: ${e.message}` }, { merge: true });
    return { success: false, message: `Approval failed: ${e.message}` };
  }

  if (!credit.credited && !['already-credited', 'year-already-activated'].includes(credit.reason)) {
    await ref.set({ status: 'pending', reviewNote: `Ledger refused: ${credit.reason}` }, { merge: true });
    return { success: false, message: `Ledger refused this payment (${credit.reason}). Nothing was added.` };
  }

  const reasonNote = credit.credited
    ? ''
    : (credit.reason === 'year-already-activated' ? 'Year was already activated — no extra money added.' : 'Ledger already had this payment — no extra money added.');

  await ref.set({
    status: 'approved',
    approvedAt: new Date().toISOString(),
    reviewedBy: reviewer,
    reviewNote: [note, reasonNote].filter(Boolean).join(' '),
    creditedAmount: paid,
    // Kept so a later re-check can prove this exact claim was paid.
    ledgerTransactionId: transactionId,
  }, { merge: true });

  await writeAudit({
    db,
    actor: reviewer,
    action: 'MANUAL_PAYMENT_APPROVED',
    details: { reference: sub.reference, amount: paid, purpose, position: sub.position || '', transactionId },
  });

  const message = credit.credited
    ? `₦${paid.toLocaleString()} approved and added to the balance.${sub.fullName ? ` ${sub.fullName} can now proceed.` : ''}`
    : `Approved. ${reasonNote}`;

  return { success: true, credited: credit.credited, reason: credit.reason, message };
}

// ---------------------------------------------------------------------------
// REJECT
// ---------------------------------------------------------------------------
export async function rejectManualPayment({ id, reviewer = 'admin', note = '' }) {
  const db = getAdminDb();
  const ref = db.collection('manualPayments').doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return { success: false, message: 'This submission no longer exists.' };

  const sub = snap.data();
  if (sub.status === 'approved') {
    return { success: false, message: 'This payment is already approved — money has been added. It cannot be rejected.' };
  }
  if (sub.status === 'rejected') {
    return { success: true, message: 'Already rejected.' };
  }

  await ref.set({
    status: 'rejected',
    reviewedBy: reviewer,
    reviewNote: note || 'Rejected by the Electoral Commission.',
    rejectedAt: new Date().toISOString(),
  }, { merge: true });

  await writeAudit({
    db,
    actor: reviewer,
    action: 'MANUAL_PAYMENT_REJECTED',
    details: { reference: sub.reference, amount: Number(sub.amount) || 0, purpose: sub.purpose, note: note || '' },
  });

  return { success: true, message: `Rejected. ${sub.fullName || 'The student'} will see the reason on their status page.` };
}

// ---------------------------------------------------------------------------
// PUBLIC SUBMISSION — creates a pending record. NEVER credits anything.
// ---------------------------------------------------------------------------
export async function createManualSubmission({ db, payload, student = null }) {
  const database = db || getAdminDb();
  const settings = await getManualSettings(database);

  if (!settings.enabled) {
    return { error: 'Bank transfer is not open right now. Please use the card/USSD checkout instead.' };
  }
  if (!settings.bank.accountNumber || !settings.bank.accountName) {
    return { error: 'The bank account has not been published yet. Contact the Electoral Commission.' };
  }

  // Only nomination forms are sold publicly. Activation stays admin-only
  // (it runs from the Admin Dashboard through processActivationPayment), and
  // approveManualPayment() still supports 'activation' for a future admin flow.
  const purpose = 'form';

  const fullName = String(payload.fullName || '').trim();
  const department = String(payload.department || '').trim();
  const level = String(payload.level || '').trim();
  const email = String(payload.email || '').trim();
  const position = String(payload.position || '').trim();

  if (!fullName || !department || !level) {
    return { error: 'Full name, department and level are required.' };
  }
  if (!position) {
    return { error: 'Choose the position you are contesting for.' };
  }

  const expected = await resolveExpectedAmount(database, purpose, position);
  if (expected.error) return { error: expected.error };

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter the amount you transferred.' };
  }

  const paymentDate = normalizePaymentDate(payload.paymentDate);
  if (!paymentDate) {
    return { error: 'Enter the payment date printed on your bank alert (e.g. 09/11/2026).' };
  }

  const senderAccount = normalizeAccountNumber(payload.senderAccount);
  const paidToAccount = normalizeAccountNumber(payload.paidToAccount) || normalizeAccountNumber(settings.bank.accountNumber);
  const receiptUrl = String(payload.receiptUrl || '').trim();
  if (!receiptUrl) {
    return { error: 'Attach the screenshot of your bank alert (proof of payment).' };
  }
  if (!/^https:\/\//i.test(receiptUrl)) {
    return { error: 'The proof image did not upload correctly. Please try again.' };
  }

  // Duplicate guard BEFORE writing anything.
  const duplicateOf = await findDuplicateSubmission(database, {
    transferReference: payload.transferReference,
    senderAccount,
    amount,
    paymentDate,
  });
  if (duplicateOf) {
    return {
      error: `This transfer was already submitted (${duplicateOf.reference}). You cannot submit the same payment twice — check the status of the earlier one.`,
      duplicateOf,
    };
  }

  const audit = auditManualProof({
    amount,
    paymentDate,
    senderAccount,
    senderBank: payload.senderBank,
    receiverName: payload.receiverName || settings.bank.accountName,
    paidToAccount,
    transferReference: payload.transferReference,
    receiptUrl,
    senderHidden: !!payload.senderHidden,
  }, {
    expectedAmount: expected.amount,
    expectedAccount: normalizeAccountNumber(settings.bank.accountNumber),
    expectedAccountName: settings.bank.accountName,
    duplicateOf,
  });

  const now = new Date();
  const reference = `MT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(id6())}`;
  const docRef = database.collection('manualPayments').doc();

  const record = {
    reference,
    purpose,
    position: expected.position || position,
    expectedAmount: expected.amount,
    amount,
    fullName,
    department,
    level,
    email,
    matric: String(payload.matric || student?.matric || ''),
    paymentDate,
    senderBank: String(payload.senderBank || '').trim(),
    senderAccount,
    senderHidden: !!payload.senderHidden,
    receiverName: String(payload.receiverName || settings.bank.accountName).trim(),
    paidToAccount,
    paidToBank: settings.bank.bankName,
    transferReference: String(payload.transferReference || '').trim(),
    receiptUrl,
    status: 'pending',
    createdAt: now.toISOString(),
    checks: audit.checks,
    verdict: audit.verdict,
    score: audit.score,
    transactionId: MANUAL_TX_PREFIX + reference,
  };

  await docRef.set(record);

  await writeAudit({
    db: database,
    actor: fullName,
    action: 'MANUAL_PAYMENT_SUBMITTED',
    details: { reference, amount, position: record.position, verdict: audit.verdict },
  });

  return { record: { id: docRef.id, ...record } };
}

// ---------------------------------------------------------------------------
// PUBLIC STATUS LOOKUP — reference alone is not enough (it would allow
// guessing other people's submissions). Reference + the exact amount paid.
// ---------------------------------------------------------------------------
export async function lookupManualStatus({ reference, amount }) {
  const db = getAdminDb();
  const ref = String(reference || '').trim().toUpperCase();
  const amt = Number(amount);
  if (!ref || !Number.isFinite(amt) || amt <= 0) {
    return { error: 'Enter your reference number and the exact amount you paid.' };
  }

  const snap = await db.collection('manualPayments').where('reference', '==', ref).limit(1).get();
  if (snap.empty) {
    return { error: 'No submission found with that reference. Check the reference and try again.' };
  }

  const doc = snap.docs[0];
  const d = doc.data();
  if (Number(d.amount) !== amt) {
    return { error: 'No submission found for that reference and amount.' };
  }

  return {
    submission: {
      reference: d.reference,
      status: d.status,
      purpose: d.purpose,
      position: d.position || '',
      amount: d.amount,
      expectedAmount: d.expectedAmount,
      fullName: d.fullName,
      paymentDate: d.paymentDate,
      submittedAt: d.createdAt,
      reviewedAt: d.approvedAt || d.rejectedAt || '',
      reviewNote: d.status === 'approved' ? '' : (d.reviewNote || ''),
      checks: Array.isArray(d.checks) ? d.checks : [],
      verdict: d.verdict || '',
    },
  };
}

function id6() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
