// ============================================================================
// Manual bank transfer — tests for the REAL api/*.js code against an in-memory
// database (tests/helpers/fake-firestore.mjs). Nothing here touches the real
// Firestore, Cloudinary or Flutterwave.
//
// Run:  node --import ./tests/helpers/register.mjs --test tests/
// ============================================================================
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getFakeFirestore } from './helpers/fake-firestore.mjs';

process.env.FIREBASE_SERVICE_ACCOUNT = '{}';
process.env.SERVER_SESSION_SECRET = 'test-session-secret';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'correct-horse-battery';
process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
process.env.CLOUDINARY_API_KEY = '123456';
process.env.CLOUDINARY_API_SECRET = 'cloud-secret';

const mp = await import('../api/_manualpayment.js');
const { signToken } = await import('../api/_session.js');
const studentHandler = (await import('../api/student.js')).default;
const adminHandler = (await import('../api/admin.js')).default;
const uploadHandler = (await import('../api/upload.js')).default;

const db = getFakeFirestore();
const TODAY = mp.portalToday();
const BANK = { bankName: 'Opay', accountName: 'NAMATL FUPRE ELECTORAL COMMISSION', accountNumber: '0123456789' };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const images = new Map(); // url -> { status, type, bytes }
const proofUrl = (name) => `https://res.cloudinary.com/testcloud/image/upload/v1731000000/namatl/payment-proofs/${name}.jpg`;

globalThis.fetch = async (url) => {
  const entry = images.get(String(url)) || { status: 200, type: 'image/jpeg', bytes: Buffer.from('image-bytes-of:' + url) };
  if (entry.throws) throw new Error('network down');
  return {
    ok: entry.status >= 200 && entry.status < 300,
    status: entry.status,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? entry.type : k.toLowerCase() === 'content-length' ? String(entry.bytes.length) : null) },
    arrayBuffer: async () => entry.bytes.buffer.slice(entry.bytes.byteOffset, entry.bytes.byteOffset + entry.bytes.length),
  };
};

let seq = 0;
function payload(over = {}) {
  seq += 1;
  return {
    position: 'President',
    fullName: 'Ada Obi',
    department: 'Maritime Transport',
    level: '300',
    email: 'ada@example.com',
    amount: 5000,
    paymentDate: TODAY,
    senderBank: 'Kuda',
    senderAccount: String(8000000000 + seq),
    senderHidden: false,
    receiverName: BANK.accountName,
    transferReference: 'SESSION' + String(100000 + seq),
    receiptUrl: proofUrl('shot-' + seq),
    ...over,
  };
}

function seedLive({ bank = BANK, formPurchase = {} } = {}) {
  db.seed('settings/formPurchase', {
    isActive: true,
    openingDate: '',
    closingDate: '',
    positions: [{ position: 'President', amount: 5000 }, { position: 'Treasurer', amount: 3000 }],
    ...formPurchase,
  });
  if (bank) db.seed('settings/manualPayment', bank);
}

function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = () => res;
  return res;
}

async function call(handler, { query = {}, body = {}, headers = {}, method = 'POST', ip = '10.0.0.1' } = {}) {
  const res = makeRes();
  await handler({ method, query, body, headers: { 'x-real-ip': ip, ...headers } }, res);
  return res;
}

const adminToken = () => {
  const now = Math.floor(Date.now() / 1000);
  return signToken({ role: 'admin', iat: now, exp: now + 3600 }, process.env.SERVER_SESSION_SECRET);
};
const admin = (action, body = {}) => call(adminHandler, { body: { action, ...body }, headers: { authorization: 'Bearer ' + adminToken() } });
const student = (action, body = {}, ip) => call(studentHandler, { query: { action }, body, ip });

const submit = async (over = {}) => {
  const result = await mp.createManualSubmission({ db, payload: payload(over) });
  assert.equal(result.error, undefined, 'expected the submission to be accepted, got: ' + result.error);
  return result.record;
};
const approve = (id, over = {}) => mp.approveManualPayment({ id, confirmedAmount: 5000, bankConfirmed: true, ...over });
const balance = () => Number(db.read('finances/withdrawalBalance')?.balance || 0);

beforeEach(() => {
  db.reset();
  images.clear();
  seedLive();
});

// ---------------------------------------------------------------------------
// 1. One price, no extra switch
// ---------------------------------------------------------------------------
test('saved bank details + live Form Purchase = bank transfer is on, with no switch of its own', async () => {
  const s = await mp.getManualSettings(db);
  assert.equal(s.configured, true);
  assert.equal(s.enabled, true);
});

test('an old "switched off" flag or old manual price from the first version is ignored', async () => {
  db.seed('settings/manualPayment', { ...BANK, isEnabled: false, manualFormAmount: 99999 });
  const s = await mp.getManualSettings(db);
  assert.equal(s.enabled, true);
  assert.equal('manualFormAmount' in s, false);
  const record = await submit();
  assert.equal(record.expectedAmount, 5000, 'the price is the Form Purchase price of the position');
});

test('bank transfer is off until all three bank details are saved', async () => {
  for (const partial of [null, { bankName: 'Opay' }, { ...BANK, accountNumber: '12345' }, { ...BANK, accountName: '' }]) {
    db.reset();
    seedLive({ bank: partial });
    const s = await mp.getManualSettings(db);
    assert.equal(s.enabled, false);
    const r = await mp.createManualSubmission({ db, payload: payload() });
    assert.match(r.error, /not available right now/);
  }
});

test('bank transfer follows Form Purchase: off when Form Purchase is off, back on when it is live again', async () => {
  seedLive({ formPurchase: { isActive: false } });
  let s = await mp.getManualSettings(db);
  assert.equal(s.configured, true);
  assert.equal(s.enabled, false);
  const refused = await mp.createManualSubmission({ db, payload: payload() });
  assert.match(refused.error, /switched off/);

  seedLive({ formPurchase: { isActive: true } });
  s = await mp.getManualSettings(db);
  assert.equal(s.enabled, true);
  await submit();
});

test('the optional pause hides it even while Form Purchase is live', async () => {
  db.seed('settings/manualPayment', { ...BANK, isPaused: true });
  const s = await mp.getManualSettings(db);
  assert.equal(s.enabled, false);
  const r = await mp.createManualSubmission({ db, payload: payload() });
  assert.match(r.error, /not available right now/);
});

test('Form Purchase opening/closing times are read in Nigerian time, like the student page does', () => {
  const data = { isActive: true, openingDate: '2026-11-10', openingTime: '08:00', closingDate: '2026-11-20', closingTime: '18:00' };
  const at = (iso) => mp.getFormPurchaseState(data, Date.parse(iso));
  assert.equal(at('2026-11-10T06:59:00Z').code, 'not-open');   // 07:59 in Nigeria
  assert.equal(at('2026-11-10T07:00:00Z').live, true);          // 08:00 in Nigeria
  assert.equal(at('2026-11-20T17:00:00Z').live, true);          // 18:00 in Nigeria (not yet "after")
  assert.equal(at('2026-11-20T17:00:01Z').code, 'closed');
  assert.equal(at('2026-11-20T17:20:00Z').graceOpen, true);     // paid just before the deadline
  assert.equal(at('2026-11-20T17:31:00Z').graceOpen, false);
  assert.equal(mp.getFormPurchaseState({ ...data, isActive: false }, Date.parse('2026-11-15T12:00:00Z')).code, 'inactive');
  assert.equal(mp.getFormPurchaseState({ isActive: true }, Date.now()).live, true, 'no dates set = no time limit');
  assert.equal(mp.getFormPurchaseState(null).live, false);
});

test('"today" for the payment-date check is the Nigerian date, not the server (UTC) date', () => {
  // 23:30 UTC on the 14th is already 00:30 on the 15th in Nigeria.
  assert.equal(mp.portalToday(Date.parse('2026-11-14T23:30:00Z')), '2026-11-15');
  const report = mp.auditManualProof({ amount: 5000, paymentDate: '15/11/2026', senderAccount: '8011111111', receiptUrl: proofUrl('x'), transferReference: 'ABCDEF123' }, { today: '2026-11-15', expectedAmount: 5000 });
  assert.equal(report.checks.find(c => c.key === 'date').status, 'pass');
});

// ---------------------------------------------------------------------------
// 2. Submitting proof
// ---------------------------------------------------------------------------
test('a good submission is stored as PENDING and adds no money', async () => {
  const record = await submit();
  assert.match(record.reference, /^MT-\d{8}-[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(record.id, record.reference, 'the reference is the document id');
  assert.equal(record.status, 'pending');
  assert.equal(record.verdict, 'clean');
  assert.equal(record.transactionId, 'MANUAL-' + record.reference);
  assert.equal(record.proofCheck, 'ok');
  assert.equal(record.proofHash.length, 64);
  assert.equal(balance(), 0);
  assert.equal(db.list('formPurchases').length, 0);
  assert.equal(db.list('paymentReceipts').length, 0);
});

test('the student only gets back a short, safe summary', async () => {
  const res = await student('manualSubmit', payload());
  assert.equal(res.statusCode, 200);
  const sub = res.body.submission;
  assert.deepEqual(Object.keys(sub).sort(), ['amount', 'fullName', 'paymentDate', 'position', 'reference', 'reviewNote', 'reviewedAt', 'status', 'submittedAt']);
  assert.equal(JSON.stringify(res.body).includes('cloudinary'), false, 'no screenshot link leaves the server');
});

test('an underpayment is recorded but flagged, and can never be approved', async () => {
  const record = await submit({ amount: 3000 });
  assert.equal(record.verdict, 'blocked');
  const r = await approve(record.id, { confirmedAmount: 3000, overrideFailedChecks: true });
  assert.equal(r.success, false);
  assert.match(r.message, /₦5,000 is required/);
  assert.equal(balance(), 0);
});

test('an amount that is obviously a typing mistake is refused', async () => {
  const r = await mp.createManualSubmission({ db, payload: payload({ amount: 500000 }) });
  assert.match(r.error, /far more than/);
  for (const bad of ['', 'abc', 0, -5, null]) {
    const x = await mp.createManualSubmission({ db, payload: payload({ amount: bad }) });
    assert.match(x.error, /Enter the amount/);
  }
});

test('a future payment date is refused', async () => {
  const tomorrow = mp.portalToday(Date.now() + 2 * 86400000);
  const r = await mp.createManualSubmission({ db, payload: payload({ paymentDate: tomorrow }) });
  assert.match(r.error, /in the future/);
});

test('a position that does not exist, or is already full, is refused', async () => {
  let r = await mp.createManualSubmission({ db, payload: payload({ position: 'Emperor' }) });
  assert.match(r.error, /not available for purchase/);
  for (let i = 0; i < 5; i++) db.seed(`candidates/c${i}`, { name: 'C' + i, position: 'Treasurer' });
  r = await mp.createManualSubmission({ db, payload: payload({ position: 'Treasurer', amount: 3000 }) });
  assert.match(r.error, /maximum of 5 candidates/);
});

test('every transfer must be identifiable: bank reference or the 10-digit paying account', async () => {
  let r = await mp.createManualSubmission({ db, payload: payload({ senderHidden: true, senderAccount: '', transferReference: '' }) });
  assert.match(r.error, /bank reference \/ session ID/);
  r = await mp.createManualSubmission({ db, payload: payload({ senderAccount: '12345', transferReference: 'AB1' }) });
  assert.match(r.error, /10-digit account/);
  await submit({ senderHidden: true, senderAccount: '', transferReference: '000013 2611-0912' });
  await submit({ transferReference: '' });
});

test('junk and oversized input is cleaned before it is stored', async () => {
  const record = await submit({
    fullName: '  Ada\u0000\n   Obi  ' + 'x'.repeat(500),
    department: { toString: () => 'hack' },
    level: '300',
    email: 'not-an-email',
    senderBank: 'K'.repeat(300),
  }).catch(e => e);
  // department was an object -> treated as empty -> refused
  assert.ok(record instanceof Error);

  const ok = await submit({ fullName: '  Ada\u0000\n   Obi  ' + 'x'.repeat(500), email: 'not-an-email', senderBank: 'K'.repeat(300) });
  assert.equal(ok.fullName.length, 120);
  assert.equal(ok.fullName.startsWith('Ada Obi'), true);
  assert.equal(ok.email, '');
  assert.equal(ok.senderBank.length, 80);
});

// ---------------------------------------------------------------------------
// 3. The proof image
// ---------------------------------------------------------------------------
test('only a screenshot uploaded through the portal is accepted', async () => {
  const bad = [
    'https://evil.example.com/alert.jpg',
    'http://res.cloudinary.com/testcloud/image/upload/v1/namatl/payment-proofs/a.jpg',
    'https://res.cloudinary.com/someoneelse/image/upload/v1/namatl/payment-proofs/a.jpg',
    'https://res.cloudinary.com.evil.com/testcloud/image/upload/v1/a.jpg',
    'https://user:pass@res.cloudinary.com/testcloud/image/upload/v1/a.jpg',
    'https://res.cloudinary.com/testcloud/raw/upload/v1/a.jpg',
    'javascript:alert(1)',
    'not a url',
    { href: 'x' },
  ];
  for (const receiptUrl of bad) {
    const r = await mp.createManualSubmission({ db, payload: payload({ receiptUrl }) });
    assert.match(r.error, /did not upload correctly|Attach the screenshot/, String(receiptUrl));
  }
  const noProof = await mp.createManualSubmission({ db, payload: payload({ receiptUrl: '' }) });
  assert.match(noProof.error, /Attach the screenshot/);
  assert.equal(db.list('manualPayments').length, 0);
});

test('a ?query or #hash on the proof link is dropped before it is stored', async () => {
  const record = await submit({ receiptUrl: proofUrl('clean') + '?x=1#frag' });
  assert.equal(record.receiptUrl, proofUrl('clean'));
});

test('a file that is not a picture is refused', async () => {
  images.set(proofUrl('pdf'), { status: 200, type: 'application/pdf', bytes: Buffer.from('%PDF') });
  const r = await mp.createManualSubmission({ db, payload: payload({ receiptUrl: proofUrl('pdf') }) });
  assert.match(r.error, /must be a picture/);
});

test('if the screenshot cannot be read right now the student is NOT blocked — it is flagged for the admin', async () => {
  images.set(proofUrl('slow'), { throws: true });
  const record = await submit({ receiptUrl: proofUrl('slow') });
  assert.equal(record.proofHash, '');
  assert.equal(record.proofCheck, 'unreachable');
  assert.equal(record.verdict, 'review');
  assert.equal(record.checks.find(c => c.key === 'proof_fingerprint').status, 'warn');
});

// ---------------------------------------------------------------------------
// 4. The same money can not be claimed twice
// ---------------------------------------------------------------------------
test('the same bank reference can not be submitted twice (however it is typed)', async () => {
  await submit({ transferReference: '0000 1326-1109 123456' });
  const r = await mp.createManualSubmission({ db, payload: payload({ transferReference: '000013261109123456' }) });
  assert.equal(r.duplicate, true);
  assert.match(r.error, /already been submitted/);
  assert.equal(r.error.includes('MT-'), false, "another student's reference is never revealed");
});

test('the same screenshot can not be used for a second payment', async () => {
  const same = Buffer.from('one-real-bank-alert');
  images.set(proofUrl('first'), { status: 200, type: 'image/png', bytes: same });
  images.set(proofUrl('second'), { status: 200, type: 'image/png', bytes: same });
  await submit({ receiptUrl: proofUrl('first') });
  const r = await mp.createManualSubmission({ db, payload: payload({ receiptUrl: proofUrl('second') }) });
  assert.equal(r.duplicate, true);
  assert.match(r.error, /screenshot has already been used/);
  // and re-using the very same uploaded link is caught too
  const again = await mp.createManualSubmission({ db, payload: payload({ receiptUrl: proofUrl('first') }) });
  assert.equal(again.duplicate, true);
});

test('same sender + amount + date with no bank reference is a duplicate', async () => {
  await submit({ senderAccount: '8099999999', transferReference: '' });
  const r = await mp.createManualSubmission({ db, payload: payload({ senderAccount: '8099999999', transferReference: '' }) });
  assert.equal(r.duplicate, true);
});

test('same sender + amount + date with two DIFFERENT bank references is allowed but flagged for the admin', async () => {
  await submit({ senderAccount: '8099999999', transferReference: 'FIRSTTRANSFER1' });
  const second = await submit({ senderAccount: '8099999999', transferReference: 'SECONDTRANSFER2' });
  assert.equal(second.verdict, 'review');
  assert.equal(second.checks.find(c => c.key === 'similar').status, 'warn');
});

test('a rejected submission frees the transfer, so the student can submit it again', async () => {
  const first = await submit({ transferReference: 'TYPOFIX123456' });
  const rej = await mp.rejectManualPayment({ id: first.id, note: 'Wrong name, submit again' });
  assert.equal(rej.success, true);
  const again = await submit({ transferReference: 'TYPOFIX123456', receiptUrl: first.receiptUrl });
  assert.equal(again.status, 'pending');
});

test('the public endpoint answers 409 for a duplicate', async () => {
  const p = payload();
  assert.equal((await student('manualSubmit', p)).statusCode, 200);
  const res = await student('manualSubmit', { ...p, receiptUrl: proofUrl('other') });
  assert.equal(res.statusCode, 409);
  assert.equal('duplicateOf' in res.body, false);
});

// ---------------------------------------------------------------------------
// 5. Status lookup
// ---------------------------------------------------------------------------
test('status needs the reference AND the exact amount; a wrong half gives the same answer', async () => {
  const record = await submit();
  const ok = await student('manualStatus', { reference: record.reference.toLowerCase(), amount: '5,000' });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.submission.status, 'pending');

  const wrongAmount = await student('manualStatus', { reference: record.reference, amount: 4999 });
  const wrongRef = await student('manualStatus', { reference: 'MT-20260101-ZZZZZZZZ', amount: 5000 });
  const garbage = await student('manualStatus', { reference: '../../settings/main', amount: 5000 });
  assert.equal(wrongAmount.statusCode, 404);
  assert.equal(wrongAmount.body.message, wrongRef.body.message);
  assert.equal(garbage.body.message, wrongRef.body.message);
});

test('a submission made before this update (random document id) is still found by its reference', async () => {
  db.seed('manualPayments/oldAutoId123', { reference: 'MT-20261109-X8KQ2P', amount: 5000, status: 'pending', fullName: 'Old Student', position: 'President', createdAt: '2026-11-09T10:00:00.000Z' });
  const res = await student('manualStatus', { reference: 'MT-20261109-X8KQ2P', amount: 5000 });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.submission.fullName, 'Old Student');
});

test('the reason is only shown for a rejection (never internal notes)', async () => {
  const record = await submit();
  await db.doc(`manualPayments/${record.id}`).set({ reviewNote: 'Approval failed: internal detail' }, { merge: true });
  let res = await student('manualStatus', { reference: record.reference, amount: 5000 });
  assert.equal(res.body.submission.reviewNote, '');
  await mp.rejectManualPayment({ id: record.id, note: 'Screenshot is blurry' });
  res = await student('manualStatus', { reference: record.reference, amount: 5000 });
  assert.equal(res.body.submission.status, 'rejected');
  assert.equal(res.body.submission.reviewNote, 'Screenshot is blurry');
});

// ---------------------------------------------------------------------------
// 6. Limits on the public endpoints
// ---------------------------------------------------------------------------
test('too many submissions from one network are paused; other networks are not affected', async () => {
  for (let i = 0; i < 10; i++) {
    const res = await student('manualSubmit', payload(), '41.1.1.1');
    assert.equal(res.statusCode, 200, 'submission ' + (i + 1));
  }
  const blocked = await student('manualSubmit', payload(), '41.1.1.1');
  assert.equal(blocked.statusCode, 429);
  assert.match(blocked.body.message, /Too many bank-transfer submissions/);
  const other = await student('manualSubmit', payload(), '41.2.2.2');
  assert.equal(other.statusCode, 200);
});

test('guessing references is stopped after repeated misses, but correct lookups never count', async () => {
  const record = await submit();
  for (let i = 0; i < 40; i++) {
    const ok = await student('manualStatus', { reference: record.reference, amount: 5000 }, '41.3.3.3');
    assert.equal(ok.statusCode, 200);
  }
  for (let i = 0; i < 12; i++) {
    const miss = await student('manualStatus', { reference: 'MT-20260101-AAAAAAA' + (i % 8 + 2), amount: 5000 }, '41.3.3.3');
    assert.equal(miss.statusCode, 404);
  }
  const blocked = await student('manualStatus', { reference: record.reference, amount: 5000 }, '41.3.3.3');
  assert.equal(blocked.statusCode, 429);
  const elsewhere = await student('manualStatus', { reference: record.reference, amount: 5000 }, '41.4.4.4');
  assert.equal(elsewhere.statusCode, 200);
});

test('the limiter never stores the visitor IP in plain text', async () => {
  await student('manualSubmit', payload(), '41.9.9.9');
  const buckets = db.list('rateLimits');
  assert.ok(buckets.length > 0);
  assert.equal(JSON.stringify(buckets).includes('41.9.9.9'), false);
});

test('if the limiter itself breaks, students are let through (fails open)', async () => {
  db.failNextTransactions = 1;
  const res = await student('manualSubmit', payload(), '41.5.5.5');
  assert.equal(res.statusCode, 200);
});

test('screenshot upload permission: signed for the proofs folder, capped per network, candidate photos untouched', async () => {
  const first = await call(uploadHandler, { query: { purpose: 'proof' }, body: { size: 1000 }, ip: '41.6.6.6' });
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.folder, 'namatl/payment-proofs');
  const expected = createHash('sha1').update(`allowed_formats=jpg,jpeg,png,webp&folder=namatl/payment-proofs&timestamp=${first.body.timestamp}cloud-secret`).digest('hex');
  assert.equal(first.body.signature, expected, 'the upload signature is exactly what it was before');

  for (let i = 0; i < 19; i++) await call(uploadHandler, { query: { purpose: 'proof' }, body: {}, ip: '41.6.6.6' });
  const blocked = await call(uploadHandler, { query: { purpose: 'proof' }, body: {}, ip: '41.6.6.6' });
  assert.equal(blocked.statusCode, 429);

  const tooBig = await call(uploadHandler, { query: { purpose: 'proof' }, body: { size: 7 * 1024 * 1024 }, ip: '41.7.7.7' });
  assert.equal(tooBig.statusCode, 400);

  const noAuth = await call(uploadHandler, { query: { purpose: 'candidate' }, body: {} });
  assert.equal(noAuth.statusCode, 401);
  const candidate = await call(uploadHandler, { query: { purpose: 'candidate' }, body: {}, headers: { authorization: 'Bearer ' + adminToken() } });
  assert.equal(candidate.statusCode, 200);
  assert.equal(candidate.body.folder, 'namatl/candidates');
});

test('what the student page is told: account only while bank transfer is on', async () => {
  let res = await student('manualSettings');
  assert.deepEqual(res.body, { success: true, enabled: true, configured: true, bank: { ...BANK, extraNote: '' }, instructions: '' });

  seedLive({ formPurchase: { isActive: false } });
  res = await student('manualSettings');
  assert.deepEqual(res.body, { success: true, enabled: false, configured: true });

  db.reset();
  seedLive({ bank: null });
  res = await student('manualSettings');
  assert.deepEqual(res.body, { success: true, enabled: false, configured: false });
});

// ---------------------------------------------------------------------------
// 7. Approving — the only place money is created
// ---------------------------------------------------------------------------
test('approval needs the "I saw it in my bank app" tick AND the amount typed by the admin', async () => {
  const record = await submit();
  let r = await mp.approveManualPayment({ id: record.id });
  assert.match(r.message, /Tick the box/);
  r = await mp.approveManualPayment({ id: record.id, bankConfirmed: true });
  assert.match(r.message, /Type the amount/);
  r = await mp.approveManualPayment({ id: record.id, bankConfirmed: true, confirmedAmount: '' });
  assert.match(r.message, /Type the amount/);
  r = await mp.approveManualPayment({ id: record.id, bankConfirmed: 'yes', confirmedAmount: 5000 });
  assert.match(r.message, /Tick the box/);
  assert.equal(balance(), 0);
  assert.equal(db.read(`manualPayments/${record.id}`).status, 'pending');
});

test('if the admin saw a different amount than the student typed, approval is refused', async () => {
  const record = await submit({ amount: 9000 }); // student over-typed
  const r = await approve(record.id, { confirmedAmount: 5000 });
  assert.equal(r.success, false);
  assert.match(r.message, /You typed ₦5,000 but the student says they paid ₦9,000/);
  assert.equal(balance(), 0);
});

test('approval credits the confirmed amount once, registers the form purchase and writes the audit diary', async () => {
  const record = await submit({ amount: 5100 }); // paid a little extra
  const r = await approve(record.id, { confirmedAmount: 5100 });
  assert.equal(r.success, true);
  assert.equal(r.credited, true);
  assert.equal(balance(), 5100);

  const saved = db.read(`manualPayments/${record.id}`);
  assert.equal(saved.status, 'approved');
  assert.equal(saved.creditedAmount, 5100);
  assert.equal(saved.bankConfirmedByAdmin, true);

  const purchase = db.read(`formPurchases/MANUAL-${record.reference}`);
  assert.equal(purchase.status, 'paid');
  assert.equal(purchase.position, 'President');
  assert.equal(purchase.fullName, 'Ada Obi');
  assert.equal(purchase.method, 'manual_bank_transfer');
  assert.equal(purchase.amount, 5100);

  assert.ok(db.read(`paymentReceipts/MANUAL-${record.reference}`));
  const actions = db.list('auditLogs').map(a => a.action);
  assert.ok(actions.includes('MANUAL_PAYMENT_SUBMITTED'));
  assert.ok(actions.includes('MANUAL_PAYMENT_APPROVED'));
  assert.ok(actions.includes('PAYMENT_CREDITED'));
});

test('clicking approve again, or two admins approving together, never adds the money twice', async () => {
  const record = await submit();
  const results = await Promise.all([approve(record.id), approve(record.id), approve(record.id)]);
  assert.equal(results.filter(r => r.credited === true).length, 1);
  assert.equal(balance(), 5000);
  const later = await approve(record.id);
  assert.equal(later.alreadyApproved, true);
  assert.equal(balance(), 5000);
  assert.equal(db.list('paymentReceipts').length, 1);
});

test('if the price went up after submission, the old amount can not be approved', async () => {
  const record = await submit();
  db.seed('settings/formPurchase', { isActive: true, positions: [{ position: 'President', amount: 8000 }] });
  const r = await approve(record.id, { overrideFailedChecks: true });
  assert.equal(r.success, false);
  assert.match(r.message, /₦8,000 is required/);
  assert.equal(balance(), 0);
});

test('a submission that failed checks needs a deliberate override', async () => {
  const record = await submit({ receiverName: 'SOMEBODY ELSE ENTIRELY' });
  assert.equal(record.verdict, 'blocked');
  const refused = await approve(record.id);
  assert.equal(refused.success, false);
  assert.equal(refused.needsOverride, true);
  assert.deepEqual(refused.failures, ['Receiver name is ours']);
  assert.equal(balance(), 0);

  const ok = await approve(record.id, { overrideFailedChecks: true });
  assert.equal(ok.success, true);
  assert.deepEqual(db.read(`manualPayments/${record.id}`).overriddenChecks, ['Receiver name is ours']);
  assert.equal(balance(), 5000);
});

test('one transfer can only ever be approved once, even if two copies got into the queue', async () => {
  // Two copies of the same transfer placed straight into the database, as could
  // have happened before these checks existed.
  const base = { purpose: 'form', position: 'President', amount: 5000, expectedAmount: 5000, fullName: 'Copy', department: 'D', level: '300', paymentDate: TODAY, senderBank: 'Kuda', senderAccount: '8012345678', receiverName: BANK.accountName, paidToAccount: BANK.accountNumber, transferReference: 'SAMEMONEY12345', status: 'pending' };
  db.seed('manualPayments/copyA', { ...base, reference: 'MT-20261109-AAAAAA', receiptUrl: proofUrl('copy-a'), createdAt: '2026-11-09T10:00:00.000Z' });
  db.seed('manualPayments/copyB', { ...base, reference: 'MT-20261109-BBBBBB', receiptUrl: proofUrl('copy-b'), createdAt: '2026-11-09T10:01:00.000Z' });

  const both = await Promise.all([
    approve('copyA', { overrideFailedChecks: true }),
    approve('copyB', { overrideFailedChecks: true }),
  ]);
  assert.equal(both.filter(r => r.success).length, 1, 'exactly one copy is approved');
  assert.match(both.find(r => !r.success).message, /already approved under MT-20261109-/);
  assert.equal(balance(), 5000);

  const loser = both[0].success ? 'copyB' : 'copyA';
  const retry = await approve(loser, { overrideFailedChecks: true });
  assert.equal(retry.success, false);
  assert.equal(balance(), 5000);
});

test('an approval that was interrupted half-way can be finished, and still credits only once', async () => {
  const record = await submit();
  const ref = db.doc(`manualPayments/${record.id}`);

  // Interrupted BEFORE the money was added.
  await ref.set({ status: 'approving', approvingAt: new Date().toISOString() }, { merge: true });
  let r = await approve(record.id);
  assert.match(r.message, /being approved right now/);
  await ref.set({ approvingAt: new Date(Date.now() - 5 * 60000).toISOString() }, { merge: true });
  r = await approve(record.id);
  assert.equal(r.success, true);
  assert.equal(balance(), 5000);

  // Interrupted AFTER the money was added (the old code's "approving" + approvedAt).
  const second = await submit();
  await approve(second.id);
  assert.equal(balance(), 10000);
  await db.doc(`manualPayments/${second.id}`).set({ status: 'approving', approvingAt: null, approvedAt: new Date(Date.now() - 5 * 60000).toISOString() }, { merge: true });
  r = await approve(second.id);
  assert.equal(r.success, true);
  assert.equal(r.credited, false);
  assert.equal(balance(), 10000, 'finishing it adds nothing more');
  assert.equal(db.read(`manualPayments/${second.id}`).status, 'approved');
});

test('if the ledger fails, the submission goes back to pending and nothing is added', async () => {
  const record = await submit();
  db.failNextTransactions = 0;
  // first transaction = claim (succeeds), second = ledger (fails)
  const originalRun = db.runTransaction.bind(db);
  let calls = 0;
  db.runTransaction = (fn) => { calls += 1; if (calls === 2) return Promise.reject(new Error('ledger offline')); return originalRun(fn); };
  const r = await approve(record.id);
  db.runTransaction = originalRun;
  assert.equal(r.success, false);
  assert.match(r.message, /Approval failed: ledger offline/);
  assert.equal(db.read(`manualPayments/${record.id}`).status, 'pending');
  assert.equal(balance(), 0);
  const retry = await approve(record.id);
  assert.equal(retry.success, true);
  assert.equal(balance(), 5000);
});

// ---------------------------------------------------------------------------
// 8. Rejecting
// ---------------------------------------------------------------------------
test('an approved payment can not be rejected, and a payment already in the ledger can not be rejected either', async () => {
  const record = await submit();
  await approve(record.id);
  let r = await mp.rejectManualPayment({ id: record.id, note: 'changed my mind' });
  assert.equal(r.success, false);
  assert.match(r.message, /already approved/);

  const second = await submit();
  await approve(second.id);
  await db.doc(`manualPayments/${second.id}`).set({ status: 'pending' }, { merge: true }); // record lost its status, money already in
  r = await mp.rejectManualPayment({ id: second.id, note: 'reject' });
  assert.equal(r.success, false);
  assert.match(r.message, /ALREADY been added to the balance/);
  assert.equal(balance(), 10000);
});

test('rejecting never touches the balance and is safe to repeat', async () => {
  const record = await submit();
  const first = await mp.rejectManualPayment({ id: record.id, note: 'Not in our bank' });
  const second = await mp.rejectManualPayment({ id: record.id, note: 'again' });
  assert.equal(first.success, true);
  assert.equal(second.message, 'Already rejected.');
  assert.equal(balance(), 0);
  assert.equal(db.read(`manualPayments/${record.id}`).reviewNote, 'Not in our bank');
  const late = await approve(record.id);
  assert.equal(late.success, false);
  assert.match(late.message, /is rejected and cannot be approved/);
});

// ---------------------------------------------------------------------------
// 9. Admin API (api/admin.js)
// ---------------------------------------------------------------------------
test('saving the bank account needs the admin password; saving a note does not', async () => {
  db.reset();
  seedLive({ bank: null });
  const data = { ...BANK, extraNote: 'Use your full name as narration', instructions: 'Send the exact amount.\nKeep your alert.' };

  let res = await admin('saveManualPaymentSettings', { data });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.needsPassword, true);
  assert.equal(db.read('settings/manualPayment'), undefined);

  res = await admin('saveManualPaymentSettings', { data, adminPassword: 'wrong' });
  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /4 attempt\(s\) left/);

  res = await admin('saveManualPaymentSettings', { data, adminPassword: process.env.ADMIN_PASSWORD });
  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /LIVE now/);
  const saved = db.read('settings/manualPayment');
  assert.equal(saved.accountNumber, '0123456789');
  assert.equal(saved.instructions, 'Send the exact amount. Keep your alert.', 'extra instructions are now saved');
  assert.equal('manualFormAmount' in saved, false);
  assert.equal('isEnabled' in saved, false);

  // note-only change: no password asked
  res = await admin('saveManualPaymentSettings', { data: { ...data, extraNote: 'New note' } });
  assert.equal(res.statusCode, 200);
  assert.equal(db.read('settings/manualPayment').extraNote, 'New note');

  // pausing: no password asked either
  res = await admin('saveManualPaymentSettings', { data: { ...data, isPaused: true } });
  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /PAUSED/);

  // changing the account number: password again
  res = await admin('saveManualPaymentSettings', { data: { ...data, accountNumber: '9999999999' } });
  assert.equal(res.statusCode, 400);
  assert.equal(db.read('settings/manualPayment').accountNumber, '0123456789');
});

test('the message after saving tells the admin it will appear by itself when Form Purchase goes live', async () => {
  db.reset();
  seedLive({ bank: null, formPurchase: { isActive: false } });
  const res = await admin('saveManualPaymentSettings', { data: BANK, adminPassword: process.env.ADMIN_PASSWORD });
  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /will show next to Card \/ USSD by itself as soon as Form Purchase is live/);
  assert.equal(res.body.settings.enabled, false);
  // ...the admin makes Form Purchase live (the existing button does exactly this write)
  await admin('saveFormPurchaseSettings', { data: { isActive: true } });
  const pub = await student('manualSettings');
  assert.equal(pub.body.enabled, true);
  assert.equal(pub.body.bank.accountNumber, BANK.accountNumber);
});

test('five wrong passwords lock bank-account changes for 15 minutes', async () => {
  const data = { ...BANK, accountNumber: '1111111111' };
  for (let i = 0; i < 4; i++) {
    const res = await admin('saveManualPaymentSettings', { data, adminPassword: 'guess' + i });
    assert.equal(res.statusCode, 401);
  }
  const fifth = await admin('saveManualPaymentSettings', { data, adminPassword: 'guess5' });
  assert.match(fifth.body.message, /locked for 15 minutes/);
  const evenTheRightOne = await admin('saveManualPaymentSettings', { data, adminPassword: process.env.ADMIN_PASSWORD });
  assert.equal(evenTheRightOne.statusCode, 423);
  assert.equal(db.read('settings/manualPayment').accountNumber, BANK.accountNumber, 'the account did not change');
  assert.ok(db.list('auditLogs').some(a => a.action === 'MANUAL_PAYMENT_BANK_CHANGE_DENIED'));
});

test('bank details are validated: all three are needed and the number must be 10 digits', async () => {
  const pw = { adminPassword: process.env.ADMIN_PASSWORD };
  let res = await admin('saveManualPaymentSettings', { data: { bankName: 'Opay', accountNumber: '0123456789' }, ...pw });
  assert.match(res.body.message, /all three/);
  res = await admin('saveManualPaymentSettings', { data: { ...BANK, accountNumber: '12345' }, ...pw });
  assert.match(res.body.message, /exactly 10 digits/);
  res = await admin('saveManualPaymentSettings', { data: { ...BANK, accountNumber: '0123-456-789' }, ...pw });
  assert.equal(res.statusCode, 200, 'dashes and spaces in the number are fine');
  // clearing everything turns it off
  res = await admin('saveManualPaymentSettings', { data: {}, ...pw });
  assert.equal(res.statusCode, 200);
  assert.equal((await student('manualSettings')).body.enabled, false);
});

test('the review queue shows true totals on every tab, and "pending" includes unfinished approvals', async () => {
  const a = await submit();
  const b = await submit();
  const c = await submit();
  const d = await submit();
  await approve(a.id);
  await mp.rejectManualPayment({ id: b.id, note: 'no' });
  await db.doc(`manualPayments/${c.id}`).set({ status: 'approving', approvingAt: new Date(Date.now() - 600000).toISOString() }, { merge: true });

  for (const requireIndex of [false, true]) {
    db.requireCompositeIndex = requireIndex; // also prove it survives a missing Firestore index
    for (const status of ['pending', 'approved', 'rejected', 'all']) {
      const res = await admin('listManualPayments', status === 'all' ? {} : { status });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body.counts, { total: 4, pending: 2, approved: 1, rejected: 1 }, `${status} tab, index=${requireIndex}`);
      const ids = res.body.items.map(i => i.id).sort();
      if (status === 'pending') assert.deepEqual(ids, [c.id, d.id].sort());
      if (status === 'approved') assert.deepEqual(ids, [a.id]);
      if (status === 'rejected') assert.deepEqual(ids, [b.id]);
      if (status === 'all') assert.equal(ids.length, 4);
    }
  }
});

test('opening a submission re-checks it live; approving through the API asks for the confirmation', async () => {
  const record = await submit();
  let res = await admin('getManualPayment', { id: record.id });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.audit.verdict, 'clean');
  assert.equal(res.body.liveExpectedAmount, 5000);
  assert.equal(res.body.item.reference, record.reference);

  res = await admin('approveManualPayment', { id: record.id });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Tick the box/);

  res = await admin('approveManualPayment', { id: record.id, bankConfirmed: true, confirmedAmount: '5000' });
  assert.equal(res.statusCode, 200);
  assert.equal(balance(), 5000);

  res = await admin('listFormPurchases');
  assert.equal(res.body.items.length, 1, 'it appears in the existing Purchase List');
  assert.equal(res.body.items[0].position, 'President');

  res = await admin('getManualPayment', { id: 'no/such/../thing' });
  assert.equal(res.statusCode, 404);
});

test('none of the manual-payment admin actions work without an admin session', async () => {
  for (const action of ['getManualPaymentSettings', 'saveManualPaymentSettings', 'listManualPayments', 'getManualPayment', 'approveManualPayment', 'rejectManualPayment']) {
    const res = await call(adminHandler, { body: { action, id: 'x', data: BANK } });
    assert.equal(res.statusCode, 401, action);
  }
});
