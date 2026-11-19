// ============================================================================
// NAMATLS MANUAL BANK TRANSFER ENGINE
// ----------------------------------------------------------------------------
// A student who cannot (or does not want to) use the Flutterwave checkout pays
// the form price into the association's published bank account, then submits
// proof: date paid, amount, the account they paid FROM, the receiver name and a
// screenshot of the bank alert.
//
// ONE PRICE, NO EXTRA SWITCH — bank transfer rides on the existing Form Purchase:
//   * The price is the price of the position in settings/formPurchase, the same
//     number the Flutterwave checkout is built from. There is no separate
//     "manual price" to set.
//   * Once the bank name, account number and account name are saved, bank
//     transfer shows by itself whenever Form Purchase is live, and hides by
//     itself when Form Purchase is not live.
//
// This file does the server-side jobs (nothing here trusts the browser):
//   1. getManualSettings()      — is bank transfer available right now?
//   2. auditManualProof()       — runs every "is this transfer fake?" check and
//                                 returns a human-readable report.
//   3. createManualSubmission() — validates and stores a PENDING claim. Refuses
//                                 the same transfer / the same screenshot twice.
//   4. approveManualPayment()   — the ONLY place a claim becomes money. Credits
//                                 through the SAME atomic ledger as Flutterwave
//                                 (creditPaymentOnce), after the admin confirms
//                                 the amount seen in the bank app.
//
// The leading underscore means Vercel does NOT count this as a serverless
// function (Hobby plan limit: 12 functions).
// ============================================================================
import { createHash, randomInt } from 'crypto';
import { getAdminDb } from './_admin.js';
import { creditPaymentOnce, getActivationPricing } from './_firebase.js';
import { writeAudit } from './_audit.js';

export const MANUAL_TX_PREFIX = 'MANUAL-';
const AMOUNT_TOLERANCE = 1;            // ₦1 rounding grace
const MAX_PROOF_AGE_DAYS = 7;          // older than this = suspicious
const MAX_PER_POSITION = 5;            // same rule the purchase page shows ("Max 5 per position")
const MAX_AMOUNT_MULTIPLE = 10;        // a claim above 10x the fee is a typing mistake
const PROOF_GRACE_MS = 30 * 60 * 1000; // proof still accepted 30 min after the scheduled closing time
const APPROVING_STALE_MS = 60 * 1000;  // an approval older than this did not finish and can be resumed
const PORTAL_UTC_OFFSET_MIN = 60;      // Nigeria (WAT, UTC+1). The admin types dates in Nigerian time.
const ACTIVE_STATUSES = ['pending', 'approving', 'approved'];
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I — easy to read out
const REFERENCE_RE = /^MT-\d{8}-[A-Z0-9]{4,12}$/;

export const BANK_DETAILS_FALLBACK = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  extraNote: '',
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad2 = (n) => String(n).padStart(2, '0');
const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');
const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;
const isSafeDocId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 200 && !id.includes('/') && id !== '.' && id !== '..';

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
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
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
  return `${year}-${pad2(month)}-${pad2(day)}`;
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

/** One line of plain text: control characters removed, spaces collapsed, length capped. */
export function cleanText(input, max = 120) {
  if (input === null || input === undefined || typeof input === 'object') return '';
  return String(input)
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202f\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * The bank reference / session ID reduced to letters and digits, so
 * "0001-2345 6789" and "000123456789" are the same reference.
 * Anything shorter than 6 characters is too weak to identify a transfer.
 */
export function bankReferenceKey(input) {
  if (input === null || input === undefined || typeof input === 'object') return '';
  const key = String(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return key.length >= 6 ? key : '';
}

/** sender account + amount + date — identifies a transfer when no bank reference was given. */
function moneyKeyOf(proof) {
  const sender = normalizeAccountNumber(proof.senderAccount);
  const amount = Number(proof.amount) || 0;
  const date = normalizePaymentDate(proof.paymentDate);
  return sender.length === 10 && amount > 0 && date ? `${sender}|${amount}|${date}` : '';
}

// ---------------------------------------------------------------------------
// THE PORTAL CLOCK
// Vercel servers run on UTC, but the admin types opening/closing dates and the
// students read their alerts in Nigerian time. Everything date-related below is
// worked out in Nigerian time so the server agrees with what people see.
// ---------------------------------------------------------------------------

/** Today's date in Nigeria as 'YYYY-MM-DD'. */
export function portalToday(nowMs = Date.now()) {
  const shifted = new Date(nowMs + PORTAL_UTC_OFFSET_MIN * 60000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

function portalTimestamp(dateStr, timeStr, fallbackTime) {
  const date = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const rawTime = String(timeStr || '').trim();
  const time = /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime) ? rawTime.slice(0, 5) : fallbackTime;
  const sign = PORTAL_UTC_OFFSET_MIN >= 0 ? '+' : '-';
  const abs = Math.abs(PORTAL_UTC_OFFSET_MIN);
  return Date.parse(`${date}T${time}:00${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`);
}

/**
 * Is Form Purchase live right now? Mirrors the rule the student page
 * (src/pages/PurchaseForm.jsx) already applies: not before the opening
 * date/time, not after the closing date/time, and switched ON.
 */
export function getFormPurchaseState(data, nowMs = Date.now()) {
  if (!data) {
    return { live: false, graceOpen: false, code: 'not-set', reason: 'Form purchase has not been set up yet.' };
  }
  const opens = portalTimestamp(data.openingDate, data.openingTime, '00:00');
  const closes = portalTimestamp(data.closingDate, data.closingTime, '23:59');
  const active = !!data.isActive;

  if (Number.isFinite(opens) && nowMs < opens) {
    return { live: false, graceOpen: false, code: 'not-open', reason: 'Form purchase has not opened yet.' };
  }
  if (Number.isFinite(closes) && nowMs > closes) {
    // Someone who paid just before the deadline still gets a short while to send the proof.
    return { live: false, graceOpen: active && nowMs - closes <= PROOF_GRACE_MS, code: 'closed', reason: 'Form purchase is closed.' };
  }
  if (!active) {
    return { live: false, graceOpen: false, code: 'inactive', reason: 'Form purchase is switched off.' };
  }
  return { live: true, graceOpen: false, code: 'live', reason: '' };
}

// ---------------------------------------------------------------------------
// SETTINGS (bank account in settings/manualPayment, price in settings/formPurchase)
// ---------------------------------------------------------------------------
export async function getManualSettings(db) {
  const database = db || getAdminDb();
  const [settingsSnap, formSnap] = await Promise.all([
    database.doc('settings/manualPayment').get(),
    database.doc('settings/formPurchase').get(),
  ]);

  const s = settingsSnap.exists ? settingsSnap.data() : {};
  const bank = {
    bankName: String(s.bankName || '').trim(),
    accountName: String(s.accountName || '').trim(),
    accountNumber: normalizeAccountNumber(s.accountNumber),
    extraNote: String(s.extraNote || ''),
  };

  // Saved = ready. There is no separate "switch on" step and no separate price.
  const configured = !!(bank.bankName && bank.accountName && bank.accountNumber.length === 10);
  const paused = !!s.isPaused;
  const formPurchase = getFormPurchaseState(formSnap.exists ? formSnap.data() : null);

  return {
    bank,
    configured,                // bank name + 10-digit account number + account name are saved
    paused,                    // the admin's optional "hide it for now" switch
    formPurchase,              // { live, graceOpen, code, reason }
    enabled: configured && !paused && formPurchase.live, // what the student page asks for
    instructions: String(s.instructions || ''),
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

/** How many candidates are already registered for a position (0 if it cannot be counted). */
async function countCandidatesFor(database, position) {
  try {
    const query = database.collection('candidates').where('position', '==', position);
    if (typeof query.count === 'function') {
      const agg = await query.count().get();
      return Number(agg.data().count) || 0;
    }
    const snap = await query.get();
    return snap.size || 0;
  } catch (e) {
    return 0; // a counting problem must never block a student who has paid
  }
}

// ---------------------------------------------------------------------------
// THE PROOF IMAGE
// Only a screenshot uploaded through this portal (into OUR Cloudinary account)
// is accepted. A link to any other website is refused, so nobody can make the
// admin open a strange link, and nobody can swap the picture after submitting.
// ---------------------------------------------------------------------------

/** Trim, drop any ?query / #hash, cap the length. Returns '' if it is not a URL. */
export function normalizeProofUrl(input) {
  if (typeof input !== 'string') return '';
  const raw = input.trim();
  if (!raw || raw.length > 500) return '';
  try {
    const u = new URL(raw);
    if (u.username || u.password) return ''; // a real upload link never carries a login
    return `${u.origin}${u.pathname}`;
  } catch (e) {
    return '';
  }
}

export function isPortalProofUrl(url, cloudName = process.env.CLOUDINARY_CLOUD_NAME) {
  const cloud = String(cloudName || '').trim().toLowerCase();
  if (!cloud) return false;
  let u;
  try {
    u = new URL(String(url || ''));
  } catch (e) {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  const path = u.pathname.toLowerCase();
  if (host === 'res.cloudinary.com') return path.startsWith(`/${cloud}/image/upload/`);
  if (host === `${cloud}-res.cloudinary.com`) return path.startsWith('/image/upload/'); // private CDN naming
  return false;
}

/**
 * Downloads the uploaded screenshot once and takes its SHA-256 fingerprint, so
 * the very same image file can never be used for a second payment.
 * Never throws. If the image cannot be read the submission is still accepted,
 * but flagged, so a network hiccup never blocks a real student.
 */
export async function fingerprintProof(url, { timeoutMs = 4000, maxBytes = 12 * 1024 * 1024 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!res.ok) return { ok: false, reason: res.status === 404 ? 'missing' : 'unreachable' };

    const type = String(res.headers.get('content-type') || '').toLowerCase();
    if (type && !type.startsWith('image/')) return { ok: false, reason: 'not-image' };

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > maxBytes) return { ok: false, reason: 'too-large' };

    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length) return { ok: false, reason: 'empty' };
    if (bytes.length > maxBytes) return { ok: false, reason: 'too-large' };

    return { ok: true, hash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  } catch (e) {
    return { ok: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// THE CHECKER — every "is this transfer fake?" test in one place.
// Each check is { key, label, status: pass|warn|fail, detail }.
// It runs when the student submits AND again every time an admin opens the
// record or approves it, always against the LIVE price and bank account.
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
    } else if (paid + AMOUNT_TOLERANCE < expected) {
      add('amount', 'Amount is correct', 'fail', `Paid ${naira(paid)} but ${naira(expected)} is required (short by ${naira(expected - paid)}).`);
    } else if (paid >= expected * 2) {
      add('amount', 'Amount is correct', 'warn', `${naira(paid)} is far more than the ${naira(expected)} fee. Confirm the exact figure in your bank app.`);
    } else {
      const extra = paid - expected;
      add('amount', 'Amount is correct', 'pass', extra > 0
        ? `${naira(paid)} covers the ${naira(expected)} fee (${naira(extra)} extra).`
        : `${naira(paid)} — exact fee.`);
    }
  }

  // ---- 4. Payment date must be real, not in the future, not ancient ----
  const date = normalizePaymentDate(proof.paymentDate);
  if (!date) {
    add('date', 'Payment date is valid', 'fail', 'The payment date could not be read. Use the date printed on your bank alert.');
  } else {
    const todayIso = context.today || portalToday();
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
  const refKey = bankReferenceKey(ref);
  if (!ref) {
    add('transfer_reference', 'Bank reference / session ID', 'warn', 'No bank reference supplied — the screenshot is the only trail.');
  } else if (!refKey) {
    add('transfer_reference', 'Bank reference / session ID', 'warn', `"${ref}" is very short for a bank reference.`);
  } else {
    add('transfer_reference', 'Bank reference / session ID', 'pass', ref);
  }

  // ---- 8b. The transfer must be identifiable (so it cannot be claimed twice) ----
  if (!refKey && sender.length !== 10) {
    add('identifiable', 'Transfer can be identified', 'fail', 'Neither a bank reference nor a 10-digit sender account was given, so this transfer cannot be told apart from another one.');
  }

  // ---- 9. Proof of payment image ----
  const receiptUrl = String(proof.receiptUrl || '').trim();
  if (!receiptUrl) {
    add('receipt', 'Screenshot of the alert attached', 'fail', 'No proof of payment image was attached.');
  } else if (!/^https:\/\//i.test(receiptUrl)) {
    add('receipt', 'Screenshot of the alert attached', 'fail', 'The proof image link is not a secure https link.');
  } else if (context.cloudName && !isPortalProofUrl(receiptUrl, context.cloudName)) {
    add('receipt', 'Screenshot of the alert attached', 'fail', 'This image was NOT uploaded through the portal. Do not open the link — reject it.');
  } else {
    add('receipt', 'Screenshot of the alert attached', 'pass', 'Uploaded through the portal.');
  }

  // ---- 9b. The exact image file is on record ----
  if (receiptUrl) {
    if (proof.proofHash) {
      add('proof_fingerprint', 'Screenshot fingerprint recorded', 'pass', 'The exact image file is on record, so it cannot be reused for another payment.');
    } else {
      add('proof_fingerprint', 'Screenshot fingerprint recorded', 'warn', 'The image could not be fingerprinted automatically — compare it by eye with other submissions.');
    }
  }

  // ---- 10. Duplicate detection (same money claimed twice) ----
  const dup = context.duplicateOf;
  if (dup) {
    const why = [
      dup.sameRef && 'same bank reference',
      dup.sameImage && 'same screenshot',
      dup.sameMoney && 'same sender account, amount and date',
    ].filter(Boolean).join(', ');
    add('duplicate', 'Not already submitted', 'fail', `This looks like a duplicate of ${dup.reference || 'an existing submission'} (${dup.status || 'pending'})${why ? ' — ' + why : ''}.`);
  } else {
    add('duplicate', 'Not already submitted', 'pass', 'No other submission uses this bank reference, this screenshot or this sender/amount/date.');
  }

  // ---- 10b. A look-alike that is NOT a duplicate (two real transfers are possible) ----
  if (context.similarTo) {
    add('similar', 'No look-alike payment', 'warn', `${context.similarTo.reference || 'Another submission'} has the same sender account, amount and date but a different bank reference. Confirm in your bank app that TWO separate credits arrived.`);
  }

  // ---- Verdict ----
  const failures = checks.filter(c => c.status === 'fail');
  const warnings = checks.filter(c => c.status === 'warn');
  let verdict = 'clean';
  if (failures.length) verdict = 'blocked';      // cannot be approved blindly
  else if (warnings.length) verdict = 'review';  // admin must look carefully
  else verdict = 'clean';                        // everything lines up

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
//   * the same bank reference, OR
//   * the same screenshot (same image file / same uploaded link), OR
//   * the same sender account + amount + date when the bank references cannot
//     tell them apart (one or both were left empty).
// Same sender + amount + date with two DIFFERENT bank references can be two real
// transfers, so that is reported as a "look-alike" warning, not a duplicate.
// A REJECTED claim does not block a re-submission (the student may have fixed a
// typo), so only pending / approving / approved records count.
// ---------------------------------------------------------------------------
export async function findRelatedSubmissions(db, proof, { excludeId = '', statuses = ACTIVE_STATUSES } = {}) {
  const database = db || getAdminDb();
  const col = database.collection('manualPayments');

  const refKey = bankReferenceKey(proof.transferReference);
  const money = moneyKeyOf(proof);
  const hash = String(proof.proofHash || '');
  const url = String(proof.receiptUrl || '');

  const lookups = [];
  if (refKey) lookups.push(col.where('dupRefKey', '==', refKey).limit(20).get());
  if (money) lookups.push(col.where('dupMoneyKey', '==', money).limit(20).get());
  if (hash) lookups.push(col.where('proofHash', '==', hash).limit(20).get());
  if (url) lookups.push(col.where('receiptUrl', '==', url).limit(20).get());
  // Submissions made before these keys existed carry none of them, so the
  // original status scan is kept as well.
  lookups.push(col.where('status', 'in', statuses).limit(300).get());

  const snaps = await Promise.all(lookups);
  const others = new Map();
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      if (doc.id !== excludeId) others.set(doc.id, doc.data());
    }
  }

  let duplicate = null;
  let similar = null;
  for (const [id, d] of others) {
    if (!statuses.includes(d.status)) continue;
    const otherRef = bankReferenceKey(d.transferReference);
    const sameRef = !!refKey && otherRef === refKey;
    const sameImage = (!!hash && d.proofHash === hash) || (!!url && d.receiptUrl === url);
    const sameMoney = !!money && moneyKeyOf(d) === money;

    if (sameRef || sameImage || (sameMoney && !(refKey && otherRef))) {
      const hit = { id, reference: d.reference, status: d.status, sameRef, sameMoney, sameImage };
      // An already-approved match matters most: it means the money was counted.
      if (!duplicate || (d.status === 'approved' && duplicate.status !== 'approved')) duplicate = hit;
    } else if (sameMoney && !similar) {
      similar = { id, reference: d.reference, status: d.status };
    }
  }
  return { duplicate, similar };
}

/** Kept for callers that only want the duplicate (or null). */
export async function findDuplicateSubmission(db, proof, excludeId = '') {
  const { duplicate } = await findRelatedSubmissions(db, proof, { excludeId });
  return duplicate;
}

// ---------------------------------------------------------------------------
// REVIEW — one submission, re-checked against the LIVE price, the LIVE bank
// account and every other submission. Used when an admin opens a record and
// again at the moment of approval, so the report is never stale.
// ---------------------------------------------------------------------------
export async function reviewManualSubmission(db, id, loadedSnap = null) {
  const database = db || getAdminDb();
  if (!isSafeDocId(String(id))) return { notFound: true };
  const snap = loadedSnap || await database.collection('manualPayments').doc(String(id)).get();
  if (!snap.exists) return { notFound: true };

  const sub = snap.data();
  const purpose = sub.purpose === 'activation' ? 'activation' : 'form';
  const [settings, expected, related] = await Promise.all([
    getManualSettings(database),
    resolveExpectedAmount(database, purpose, sub.position),
    findRelatedSubmissions(database, sub, { excludeId: snap.id }),
  ]);

  const audit = auditManualProof({
    amount: sub.amount,
    paymentDate: sub.paymentDate,
    senderAccount: sub.senderAccount,
    senderBank: sub.senderBank,
    receiverName: sub.receiverName,
    paidToAccount: sub.paidToAccount,
    transferReference: sub.transferReference,
    receiptUrl: sub.receiptUrl,
    senderHidden: sub.senderHidden,
    proofHash: sub.proofHash,
  }, {
    expectedAmount: expected.error ? Number(sub.expectedAmount) || 0 : expected.amount,
    expectedAccount: normalizeAccountNumber(settings.bank.accountNumber),
    expectedAccountName: settings.bank.accountName,
    duplicateOf: related.duplicate,
    similarTo: related.similar,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });

  return { id: snap.id, sub, purpose, settings, expected, related, audit };
}

// The keys that make a transfer unique. Whoever approves first owns them, so the
// same transfer / the same screenshot can never be turned into money twice.
function approvalLocksFor(sub) {
  const keys = [];
  const refKey = bankReferenceKey(sub.transferReference);
  if (refKey) {
    keys.push(['ref', refKey]);
  } else {
    const money = moneyKeyOf(sub);
    if (money) keys.push(['money', money]);
  }
  if (sub.proofHash) keys.push(['img', String(sub.proofHash)]);
  else if (sub.receiptUrl) keys.push(['url', String(sub.receiptUrl)]);
  return keys.map(([kind, value]) => ({ kind, id: `${kind}_${sha256(value).slice(0, 40)}` }));
}

// ---------------------------------------------------------------------------
// APPROVE — the only place a manual payment becomes real money.
// Everything happens in Firestore transactions, so a double-click, a retry or
// two admins on two phones can NEVER credit twice.
//
// Safety steps, in order:
//   1. The admin must tick "I saw this money in my bank app" and TYPE the amount
//      seen there. It must match the student's amount and cover the live price.
//      That typed amount is what gets credited.
//   2. The checker is re-run. A submission that failed checks needs an explicit
//      override.
//   3. The transfer's keys (bank reference / screenshot) are locked to this
//      submission inside the same transaction that claims it, so the same
//      transfer cannot be approved under a second submission.
//   4. The shared ledger (creditPaymentOnce) credits exactly once.
// ---------------------------------------------------------------------------
export async function approveManualPayment({
  id,
  reviewer = 'admin',
  note = '',
  confirmedAmount,
  bankConfirmed = false,
  overrideFailedChecks = false,
}) {
  const db = getAdminDb();
  const docId = String(id || '');
  if (!isSafeDocId(docId)) return { success: false, message: 'This submission no longer exists.' };

  const ref = db.collection('manualPayments').doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, message: 'This submission no longer exists.' };

  const sub = snap.data();
  if (sub.status === 'approved') {
    return { success: true, alreadyApproved: true, message: `Already approved (${sub.reference}). No money was added twice.` };
  }
  if (sub.status !== 'pending' && sub.status !== 'approving') {
    return { success: false, message: `This submission is ${sub.status} and cannot be approved.` };
  }

  // ---- 1. The admin has to have looked at the bank app ----
  if (bankConfirmed !== true) {
    return { success: false, message: 'Tick the box to confirm you opened your bank app and saw this money arrive.' };
  }
  const claimed = Number(sub.amount) || 0;
  const confirmed = Number(confirmedAmount);
  if (confirmedAmount === '' || confirmedAmount === null || confirmedAmount === undefined || !Number.isFinite(confirmed) || confirmed <= 0) {
    return { success: false, message: 'Type the amount you saw in your bank app before approving.' };
  }
  if (Math.abs(confirmed - claimed) > AMOUNT_TOLERANCE) {
    return {
      success: false,
      message: `You typed ${naira(confirmed)} but the student says they paid ${naira(claimed)}. If your bank app shows a different amount, reject this and ask the student to submit again with the right amount.`,
    };
  }

  // ---- 2. Re-run every check against the LIVE price and the LIVE account ----
  // (the price book may have changed since submission; the admin's number wins)
  const review = await reviewManualSubmission(db, docId, snap);
  const { purpose, expected, audit, related } = review;
  if (expected.error) {
    return { success: false, message: `Cannot approve: ${expected.error}` };
  }
  if (confirmed + AMOUNT_TOLERANCE < expected.amount) {
    return {
      success: false,
      message: `Cannot approve: student paid ${naira(confirmed)} but ${naira(expected.amount)} is required. Reject and ask them to top up the balance.`,
    };
  }
  if (related.duplicate && (related.duplicate.status === 'approved' || related.duplicate.status === 'approving')) {
    return {
      success: false,
      message: `Cannot approve: this same transfer was already approved under ${related.duplicate.reference}. Money is never added twice — reject this one.`,
    };
  }
  if (audit.verdict === 'blocked' && overrideFailedChecks !== true) {
    return {
      success: false,
      needsOverride: true,
      failures: audit.failures,
      message: `This submission failed ${audit.failures.length} check(s): ${audit.failures.join(', ')}. Tick the override box only if you have verified this payment yourself.`,
    };
  }

  const transactionId = String(sub.transactionId || (MANUAL_TX_PREFIX + sub.reference));
  const locks = approvalLocksFor(sub);
  const lockRefs = locks.map(lock => db.doc(`manualPaymentLocks/${lock.id}`));
  const cleanNote = cleanText(note, 500);

  // ---- 3. Claim the submission AND its transfer keys (atomic) ----
  const claimedTx = await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (!cur.exists) return { ok: false, message: 'This submission no longer exists.' };
    const data = cur.data();

    if (data.status === 'approving') {
      // An earlier approval started. If it is recent it may still be running;
      // if it is old it was interrupted and is safe to resume (the ledger below
      // credits a transaction id once, no matter how many times it is called).
      const startedAt = Date.parse(data.approvingAt || data.approvedAt || '') || 0;
      if (Date.now() - startedAt < APPROVING_STALE_MS) {
        return { ok: false, message: 'This payment is being approved right now. Wait a minute, then try again.' };
      }
    } else if (data.status !== 'pending') {
      return { ok: false, message: `This submission is already ${data.status}.` };
    }

    const lockSnaps = [];
    for (const lockRef of lockRefs) lockSnaps.push(await tx.get(lockRef));
    for (const lockSnap of lockSnaps) {
      if (lockSnap.exists && lockSnap.data().submissionId !== docId) {
        return {
          ok: false,
          message: `Cannot approve: this same transfer was already approved under ${lockSnap.data().reference || 'another submission'}. Money is never added twice — reject this one.`,
        };
      }
    }

    const nowIso = new Date().toISOString();
    tx.set(ref, {
      status: 'approving',
      approvingAt: nowIso,
      reviewedBy: reviewer,
      reviewNote: cleanNote,
      confirmedAmount: confirmed,
      lockIds: locks.map(lock => lock.id),
    }, { merge: true });
    lockRefs.forEach((lockRef, i) => tx.set(lockRef, {
      kind: locks[i].kind,
      submissionId: docId,
      reference: String(sub.reference || ''),
      lockedAt: nowIso,
    }));
    return { ok: true };
  });

  if (!claimedTx.ok) return { success: false, message: claimedTx.message };

  // ---- 4. Credit the shared ledger (idempotent by transactionId) ----
  const activationYear = purpose === 'activation' ? String(sub.academicYear || '') : null;
  let credit;
  try {
    credit = await creditPaymentOnce({
      transactionId,
      txRef: String(sub.reference),
      amount: confirmed,
      kind: purpose,
      academicYear: activationYear || undefined,
      meta: {
        method: 'manual_bank_transfer',
        manualPaymentId: docId,
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
  const creditedAmount = credit.credited ? confirmed : Number(credit.receipt?.amount ?? confirmed);
  const overridden = audit.verdict === 'blocked' ? audit.failures : [];

  await ref.set({
    status: 'approved',
    approvedAt: new Date().toISOString(),
    reviewedBy: reviewer,
    reviewNote: [cleanNote, reasonNote].filter(Boolean).join(' '),
    creditedAmount,
    confirmedAmount: confirmed,
    bankConfirmedByAdmin: true,
    overriddenChecks: overridden,
    // Kept so a later re-check can prove this exact claim was paid.
    ledgerTransactionId: transactionId,
  }, { merge: true });

  await writeAudit({
    db,
    actor: reviewer,
    action: 'MANUAL_PAYMENT_APPROVED',
    details: {
      reference: sub.reference,
      amount: creditedAmount,
      purpose,
      position: sub.position || '',
      transactionId,
      bankConfirmedByAdmin: true,
      overriddenChecks: overridden,
    },
  });

  const message = credit.credited
    ? `${naira(creditedAmount)} approved and added to the balance.${sub.fullName ? ` ${sub.fullName} can now proceed.` : ''}`
    : `Approved. ${reasonNote}`;

  return { success: true, credited: credit.credited, reason: credit.reason, message };
}

// ---------------------------------------------------------------------------
// REJECT
// ---------------------------------------------------------------------------
export async function rejectManualPayment({ id, reviewer = 'admin', note = '' }) {
  const db = getAdminDb();
  const docId = String(id || '');
  if (!isSafeDocId(docId)) return { success: false, message: 'This submission no longer exists.' };

  const ref = db.collection('manualPayments').doc(docId);
  const reason = cleanText(note, 500) || 'Rejected by the Electoral Commission.';

  const outcome = await db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    if (!cur.exists) return { success: false, message: 'This submission no longer exists.' };
    const sub = cur.data();

    if (sub.status === 'approved') {
      return { success: false, message: 'This payment is already approved — money has been added. It cannot be rejected.' };
    }
    if (sub.status === 'rejected') {
      return { success: true, already: true, message: 'Already rejected.' };
    }
    if (sub.status === 'approving') {
      const startedAt = Date.parse(sub.approvingAt || sub.approvedAt || '') || 0;
      if (Date.now() - startedAt < APPROVING_STALE_MS) {
        return { success: false, message: 'This payment is being approved right now. Wait a minute, then try again.' };
      }
    }

    // If the ledger already holds this payment the money IS in the balance,
    // so the record must be finished as approved, never flipped to rejected.
    const transactionId = String(sub.transactionId || (MANUAL_TX_PREFIX + sub.reference));
    if (isSafeDocId(transactionId)) {
      const receipt = await tx.get(db.doc(`paymentReceipts/${transactionId}`));
      if (receipt.exists) {
        return {
          success: false,
          message: 'This payment has ALREADY been added to the balance, so it cannot be rejected. Approve it again to finish it — no money is added twice.',
        };
      }
    }

    // Release the transfer keys so a corrected re-submission can go through.
    const lockIds = Array.isArray(sub.lockIds) ? sub.lockIds.filter(isSafeDocId) : [];
    const lockRefs = lockIds.map(lockId => db.doc(`manualPaymentLocks/${lockId}`));
    const lockSnaps = [];
    for (const lockRef of lockRefs) lockSnaps.push(await tx.get(lockRef));

    tx.set(ref, {
      status: 'rejected',
      reviewedBy: reviewer,
      reviewNote: reason,
      rejectedAt: new Date().toISOString(),
    }, { merge: true });
    lockSnaps.forEach((lockSnap, i) => {
      if (lockSnap.exists && lockSnap.data().submissionId === docId) tx.delete(lockRefs[i]);
    });

    return { success: true, sub };
  });

  if (!outcome.success || outcome.already) {
    return { success: outcome.success, message: outcome.message };
  }

  const sub = outcome.sub;
  await writeAudit({
    db,
    actor: reviewer,
    action: 'MANUAL_PAYMENT_REJECTED',
    details: { reference: sub.reference, amount: Number(sub.amount) || 0, purpose: sub.purpose, note: reason },
  });

  return { success: true, message: `Rejected. ${sub.fullName || 'The student'} will see the reason on their status page.` };
}

// ---------------------------------------------------------------------------
// PUBLIC SUBMISSION — creates a pending record. NEVER credits anything.
// ---------------------------------------------------------------------------
function newReference(nowMs = Date.now()) {
  let tail = '';
  for (let i = 0; i < 8; i++) tail += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `MT-${portalToday(nowMs).replace(/-/g, '')}-${tail}`;
}

export async function createManualSubmission({ db, payload, student = null }) {
  const database = db || getAdminDb();
  const p = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const settings = await getManualSettings(database);

  // ---- Availability: bank details saved + not paused + Form Purchase live ----
  if (!settings.configured || settings.paused) {
    return { error: 'Bank transfer is not available right now. Please use the card/USSD checkout instead.' };
  }
  if (!settings.formPurchase.live && !settings.formPurchase.graceOpen) {
    return { error: `${settings.formPurchase.reason} Bank transfer proof cannot be submitted right now.` };
  }

  // Only nomination forms are sold publicly. Activation stays admin-only
  // (it runs from the Admin Dashboard through processActivationPayment), and
  // approveManualPayment() still supports 'activation' for a future admin flow.
  const purpose = 'form';

  const fullName = cleanText(p.fullName, 120);
  const department = cleanText(p.department, 120);
  const level = cleanText(p.level, 40);
  const position = cleanText(p.position, 120);
  let email = cleanText(p.email, 160);

  if (!fullName || !department || !level) {
    return { error: 'Full name, department and level are required.' };
  }
  if (!position) {
    return { error: 'Choose the position you are contesting for.' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = '';

  // ---- The price is the Form Purchase price of the position — nothing else ----
  const expected = await resolveExpectedAmount(database, purpose, position);
  if (expected.error) return { error: expected.error };

  const taken = await countCandidatesFor(database, expected.position);
  if (taken >= MAX_PER_POSITION) {
    return { error: `${expected.position} already has the maximum of ${MAX_PER_POSITION} candidates. Choose another position.` };
  }

  const rawAmount = typeof p.amount === 'string' ? p.amount.replace(/[,\s₦]/g, '') : p.amount;
  const amount = Math.round(Number(rawAmount) * 100) / 100;
  if (rawAmount === '' || rawAmount === null || rawAmount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter the amount you transferred.' };
  }
  if (amount > expected.amount * MAX_AMOUNT_MULTIPLE) {
    return { error: `${naira(amount)} is far more than the ${naira(expected.amount)} form price. Enter the exact amount shown on your bank alert.` };
  }

  const paymentDate = normalizePaymentDate(cleanText(p.paymentDate, 40));
  if (!paymentDate) {
    return { error: 'Enter the payment date printed on your bank alert (e.g. 09/11/2026).' };
  }
  if (paymentDate > portalToday()) {
    return { error: `${paymentDate} is in the future. Enter the date printed on your bank alert.` };
  }

  const senderHidden = !!p.senderHidden;
  const senderAccount = senderHidden ? '' : normalizeAccountNumber(cleanText(p.senderAccount, 40)).slice(0, 20);
  const senderBank = cleanText(p.senderBank, 80);
  const transferReference = cleanText(p.transferReference, 64);
  const refKey = bankReferenceKey(transferReference);

  // Every transfer must be identifiable, otherwise the same payment could be
  // submitted twice without being noticed.
  if (!refKey && senderAccount.length !== 10) {
    return {
      error: senderHidden
        ? 'Your bank hid the account you paid from, so enter the bank reference / session ID printed on your receipt. We need it to identify your transfer.'
        : 'Enter the 10-digit account you paid from, or the bank reference / session ID printed on your receipt. We need one of them to identify your transfer.',
    };
  }

  const paidToAccount = normalizeAccountNumber(cleanText(p.paidToAccount, 40)).slice(0, 20) || normalizeAccountNumber(settings.bank.accountNumber);
  const receiverName = cleanText(p.receiverName, 160) || settings.bank.accountName;

  // ---- Proof of payment: must be the screenshot uploaded through this portal ----
  if (!p.receiptUrl) {
    return { error: 'Attach the screenshot of your bank alert (proof of payment).' };
  }
  if (!String(process.env.CLOUDINARY_CLOUD_NAME || '').trim()) {
    return { error: 'Proof uploads are not configured yet. Contact the Electoral Commission.' };
  }
  const receiptUrl = normalizeProofUrl(p.receiptUrl);
  if (!receiptUrl || !isPortalProofUrl(receiptUrl)) {
    return { error: 'The proof image did not upload correctly. Attach the screenshot again using the upload button.' };
  }
  const fingerprint = await fingerprintProof(receiptUrl);
  if (!fingerprint.ok && fingerprint.reason === 'not-image') {
    return { error: 'The proof must be a picture (JPG, PNG or WEBP) of your bank alert.' };
  }
  const proofHash = fingerprint.ok ? fingerprint.hash : '';

  // ---- Duplicate guard BEFORE writing anything ----
  const related = await findRelatedSubmissions(database, {
    transferReference,
    senderAccount,
    amount,
    paymentDate,
    receiptUrl,
    proofHash,
  });
  if (related.duplicate) {
    const onlyImage = related.duplicate.sameImage && !related.duplicate.sameRef && !related.duplicate.sameMoney;
    return {
      duplicate: true,
      error: onlyImage
        ? 'This screenshot has already been used for another payment. Every payment needs its own bank alert.'
        : 'This transfer has already been submitted. You cannot submit the same payment twice — check the status of the earlier one with the reference you were given.',
    };
  }

  const audit = auditManualProof({
    amount,
    paymentDate,
    senderAccount,
    senderBank,
    receiverName,
    paidToAccount,
    transferReference,
    receiptUrl,
    senderHidden,
    proofHash,
  }, {
    expectedAmount: expected.amount,
    expectedAccount: normalizeAccountNumber(settings.bank.accountNumber),
    expectedAccountName: settings.bank.accountName,
    duplicateOf: null,
    similarTo: related.similar,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });

  const now = new Date();
  const record = {
    purpose,
    position: expected.position || position,
    expectedAmount: expected.amount,
    amount,
    fullName,
    department,
    level,
    email,
    matric: cleanText(p.matric || student?.matric || '', 40),
    paymentDate,
    senderBank,
    senderAccount,
    senderHidden,
    receiverName,
    paidToAccount,
    paidToBank: settings.bank.bankName,
    transferReference,
    receiptUrl,
    status: 'pending',
    createdAt: now.toISOString(),
    checks: audit.checks,
    verdict: audit.verdict,
    score: audit.score,
    // Keys used to spot the same transfer / the same screenshot again.
    dupRefKey: refKey,
    dupMoneyKey: moneyKeyOf({ senderAccount, amount, paymentDate }),
    proofHash,
    proofBytes: fingerprint.ok ? fingerprint.bytes : 0,
    proofCheck: fingerprint.ok ? 'ok' : fingerprint.reason,
  };

  // The reference is random (not guessable) and is also the document id, so two
  // submissions can never end up with the same reference.
  const col = database.collection('manualPayments');
  let reference = '';
  let docRef = null;
  for (let attempt = 0; ; attempt++) {
    reference = newReference(now.getTime());
    docRef = col.doc(reference);
    try {
      await docRef.create({ ...record, reference, transactionId: MANUAL_TX_PREFIX + reference });
      break;
    } catch (e) {
      const alreadyExists = e && (e.code === 6 || /already exists/i.test(String(e.message || '')));
      if (!alreadyExists || attempt >= 4) throw e;
    }
  }

  await writeAudit({
    db: database,
    actor: fullName,
    action: 'MANUAL_PAYMENT_SUBMITTED',
    details: { reference, amount, position: record.position, verdict: audit.verdict },
  });

  return { record: { id: docRef.id, ...record, reference, transactionId: MANUAL_TX_PREFIX + reference } };
}

// ---------------------------------------------------------------------------
// PUBLIC STATUS LOOKUP — reference alone is not enough (it would allow
// guessing other people's submissions). Reference + the exact amount paid.
// A wrong reference and a wrong amount give the SAME answer, so the reply
// never reveals which half was right.
// ---------------------------------------------------------------------------

/** What a student is allowed to see about a submission (no screenshot link, no account digits). */
export function publicSubmissionView(d) {
  return {
    reference: d.reference,
    status: d.status,
    position: d.position || '',
    amount: d.amount,
    fullName: d.fullName,
    paymentDate: d.paymentDate,
    submittedAt: d.createdAt,
    reviewedAt: d.status === 'approved' ? (d.approvedAt || '') : d.status === 'rejected' ? (d.rejectedAt || '') : '',
    reviewNote: d.status === 'rejected' ? (d.reviewNote || '') : '',
  };
}

export async function lookupManualStatus({ reference, amount }) {
  const db = getAdminDb();
  const ref = typeof reference === 'string' ? reference.trim().toUpperCase() : '';
  const rawAmount = typeof amount === 'string' ? amount.replace(/[,\s₦]/g, '') : amount;
  const amt = Number(rawAmount);
  if (!ref || rawAmount === '' || rawAmount === null || rawAmount === undefined || !Number.isFinite(amt) || amt <= 0) {
    return { error: 'Enter your reference number and the exact amount you paid.' };
  }

  const miss = { notFound: true, error: 'No submission found for that reference and amount. Check both and try again.' };
  if (!REFERENCE_RE.test(ref)) return miss;

  let data = null;
  const direct = await db.collection('manualPayments').doc(ref).get();
  if (direct.exists) {
    data = direct.data();
  } else {
    // Submissions made before the reference became the document id.
    const snap = await db.collection('manualPayments').where('reference', '==', ref).limit(1).get();
    if (!snap.empty) data = snap.docs[0].data();
  }

  if (!data || Number(data.amount) !== amt) return miss;
  return { submission: publicSubmissionView(data) };
}
