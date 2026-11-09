// NAMATLS Student API — login / register / verify-key in ONE function.
// Also hosts the PUBLIC manual bank-transfer endpoints (settings / submit /
// status). They live here instead of a new file because a new file would be a
// 13th serverless function and Vercel Hobby caps us at 12.
import { getAdminDb } from './_admin.js';
import { writeAudit } from './_audit.js';
import { getManualSettings, createManualSubmission, lookupManualStatus } from './_manualpayment.js';

const normalizeMatric = (matric) => matric.trim().toUpperCase().replace(/\s+/g, '');
const toDocId = (matric) => normalizeMatric(matric).replace(/\//g, '_');

function generateUniqueKey() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${timestamp}${random}-NAMATLEC`;
}

async function login(req, res) {
  const { matric } = req.body || {};
  if (!matric) return res.status(400).json({ success: false, message: 'matric is required' });

  const snap = await getAdminDb().doc(`students/${toDocId(matric)}`).get();
  if (!snap.exists) {
    return res.status(404).json({ success: false, message: 'Matric Number not registered. Please sign up first.' });
  }
  const s = snap.data();
  await writeAudit({ db: getAdminDb(), actor: s.matric || matric, action: 'STUDENT_LOGIN', details: { level: s.level } });
  return res.status(200).json({
    success: true,
    student: { name: s.name, matric: s.matric, level: s.level, hasVoted: !!s.hasVoted },
  });
}

async function register(req, res) {
  const { name, matric, level } = req.body || {};
  if (!name || !matric || !level) {
    return res.status(400).json({ success: false, message: 'name, matric and level are required' });
  }

  const normalized = normalizeMatric(matric);
  const docId = toDocId(matric);
  const studentRef = getAdminDb().doc(`students/${docId}`);

  const existing = await studentRef.get();
  if (existing.exists) {
    return res.status(409).json({ success: false, message: 'Matric Number already registered. Please Login.' });
  }

  const uniqueKey = generateUniqueKey();
  await studentRef.set({
    name: name.trim(),
    matric: normalized,
    level: level.trim(),
    uniqueKey,
    hasVoted: false,
    createdAt: new Date().toISOString(),
  });

  await writeAudit({ db: getAdminDb(), actor: normalized, action: 'STUDENT_REGISTER', details: { level: level.trim() } });

  return res.status(200).json({ success: true, uniqueKey });
}

// ---- Super Admin live monitoring: who is on which page (no login needed) ----
// Called by PresenceContext on every page change + every 45s per visitor.
// Online = seen in the last 2 minutes (counted in admin.js superStats).
async function presence(req, res) {
  const { anonId, page, role } = req.body || {};
  const safeId = String(anonId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  if (!safeId || !page) {
    return res.status(400).json({ success: false, message: 'anonId and page are required' });
  }
  const now = new Date().toISOString();
  const ref = getAdminDb().doc(`presence/${safeId}`);
  const existing = await ref.get();
  await ref.set({
    page: String(page).slice(0, 60),
    role: String(role || 'visitor').slice(0, 20),
    lastSeen: now,
    firstSeen: existing.exists && existing.data().firstSeen ? existing.data().firstSeen : now,
  }, { merge: true });
  return res.status(200).json({ success: true });
}

async function verifyKey(req, res) {
  const { matric, uniqueKey } = req.body || {};
  if (!matric || !uniqueKey) {
    return res.status(400).json({ success: false, message: 'matric and uniqueKey are required' });
  }

  const snap = await getAdminDb().doc(`students/${toDocId(matric)}`).get();
  if (!snap.exists) {
    return res.status(404).json({ success: false, message: 'Matric Number not registered. Please sign up first.' });
  }
  if (snap.data().uniqueKey !== uniqueKey.trim()) {
    return res.status(401).json({ success: false, message: 'Incorrect Unique Code. Access Denied' });
  }
  return res.status(200).json({ success: true });
}

// ---- Public manual bank transfer: what the student page needs ----
// Deliberately narrow: the bank account, whether it is open, the official
// price list and the Super-Admin activation fee. No secrets, no other settings.
async function manualSettings(req, res) {
  const db = getAdminDb();
  const s = await getManualSettings(db);
  if (!s.enabled) {
    return res.status(200).json({
      success: true,
      enabled: false,
      bank: s.bank,
      positions: s.positions,
      manualFormAmount: s.manualFormAmount,
      activationTotal: s.activationTotal,
      instructions: s.instructions,
    });
  }
  return res.status(200).json({
    success: true,
    enabled: true,
    bank: s.bank,
    positions: s.positions,
    manualFormAmount: s.manualFormAmount,
    activationTotal: s.activationTotal,
    instructions: s.instructions,
    // A short, stable note so the UI can warn if the account is half-filled.
    configured: !!(s.bank.bankName && s.bank.accountName && s.bank.accountNumber),
  });
}

// ---- Public manual bank transfer: submit proof of payment ----
// Creates a PENDING record only. No money is added here — that is the admin's
// approval (see approveManualPayment in _manualpayment.js).
async function manualSubmit(req, res) {
  const db = getAdminDb();
  const result = await createManualSubmission({ db, payload: req.body || {} });
  if (result.error) {
    return res.status(result.duplicateOf ? 409 : 400).json({ success: false, message: result.error, duplicateOf: result.duplicateOf || null });
  }
  return res.status(200).json({
    success: true,
    message: 'Submitted for review. Keep your reference safe — you can check the status any time.',
    submission: result.record,
  });
}

// ---- Public manual bank transfer: check status ----
async function manualStatus(req, res) {
  const { reference, amount } = req.body || {};
  const result = await lookupManualStatus({ reference, amount });
  if (result.error) return res.status(404).json({ success: false, message: result.error });
  return res.status(200).json({ success: true, submission: result.submission });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const { action } = req.query; // set by vercel.json rewrites
  switch (action) {
    case 'login': return login(req, res);
    case 'register': return register(req, res);
    case 'verifyKey': return verifyKey(req, res);
    case 'presence': return presence(req, res);
    case 'manualSettings': return manualSettings(req, res);
    case 'manualSubmit': return manualSubmit(req, res);
    case 'manualStatus': return manualStatus(req, res);
    default:
      return res.status(400).json({ success: false, message: 'Unknown action: ' + action });
  }
}