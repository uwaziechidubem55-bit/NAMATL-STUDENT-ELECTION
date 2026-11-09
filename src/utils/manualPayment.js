// ============================================================================
// NAMATLS manual bank transfer — browser helpers (student side).
// Mirrors the server rules in api/_manualpayment.js so the student sees the
// same checks before submitting, instead of waiting for a rejection.
// The server ALWAYS re-runs these checks — nothing here is trusted.
// ============================================================================

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n) => String(n).padStart(2, '0');

function padDate(y, mo, d) {
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (!year || !month || !day) return '';
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCMonth() !== month - 1) return '';
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** '09/11/2026' (day first), '2026-11-09', '9 Nov 2026' -> '2026-11-09' */
export function parsePaymentDate(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  let m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return padDate(m[1], m[2], m[3]);

  m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = (Number(year) > 70 ? '19' : '20') + year;
    return padDate(year, m[2], m[1]);
  }

  m = raw.toLowerCase().match(/^(\d{1,2})\s*[-\s]\s*([a-z]{3,9})\.?\s*[-\s,]\s*(\d{4})$/);
  if (m) {
    const idx = MONTHS.indexOf(m[2].slice(0, 3));
    if (idx >= 0) return padDate(m[3], String(idx + 1), m[1]);
  }

  m = raw.toLowerCase().match(/^([a-z]{3,9})\.?\s*(\d{1,2}),?\s*(\d{4})$/);
  if (m) {
    const idx = MONTHS.indexOf(m[1].slice(0, 3));
    if (idx >= 0) return padDate(m[3], String(idx + 1), m[2]);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return '';
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const digitsOnly = (v) => String(v || '').replace(/\D/g, '');

/**
 * Client-side pre-flight report. Same shape as the server's checks so the
 * student sees ✓ / ⚠ / ✕ rows immediately as they fill the form.
 */
export function preflightChecks(proof, context = {}) {
  const checks = [];
  const add = (label, status, detail) => checks.push({ label, status, detail });
  const last4 = (v) => String(v || '').slice(-4);

  const expectedAccount = digitsOnly(context.expectedAccount);
  const paidTo = digitsOnly(proof.paidToAccount) || expectedAccount;

  if (expectedAccount) {
    if (paidTo === expectedAccount) add('Receiving account matches', 'pass', `••••${last4(paidTo)}`);
    else add('Receiving account matches', 'fail', `Proof shows ••••${last4(paidTo)} but ours ends ••••${last4(expectedAccount)}`);
  }

  const expectedAmount = Number(context.expectedAmount) || 0;
  const paid = Number(proof.amount) || 0;
  if (expectedAmount > 0) {
    if (!paid) add('Amount is correct', 'warn', `₦${expectedAmount.toLocaleString()} required`);
    else if (paid + 1 >= expectedAmount) add('Amount is correct', 'pass', `₦${paid.toLocaleString()}`);
    else add('Amount is correct', 'fail', `Short by ₦${(expectedAmount - paid).toLocaleString()}`);
  }

  const date = parsePaymentDate(proof.paymentDate);
  if (!proof.paymentDate) add('Payment date', 'warn', 'Enter the date on your alert');
  else if (!date) add('Payment date', 'fail', 'Cannot read that date — use 09/11/2026');
  else if (date > todayIso()) add('Payment date', 'fail', 'Date is in the future');
  else add('Payment date', 'pass', date);

  const receiverOk = String(proof.receiverName || '').trim().length >= 3;
  if (receiverOk) add('Receiver name', 'pass', String(proof.receiverName).trim());
  else if (context.expectedAccountName) add('Receiver name', 'warn', `Should read "${context.expectedAccountName}"`);
  else add('Receiver name', 'warn', 'Enter the name on the alert');

  const sender = digitsOnly(proof.senderAccount);
  if (!sender) add('Your account number', 'warn', 'Hidden on some alerts — tick the box below if so');
  else if (sender.length === 10) add('Your account number', 'pass', `••••${last4(sender)}`);
  else add('Your account number', 'warn', `${sender.length} digits — should be 10`);

  if (proof.receiptUrl) add('Proof of payment', 'pass', 'Screenshot attached');
  else add('Proof of payment', 'warn', 'Attach the bank alert screenshot');

  return checks;
}

// ============================================================================
// NETWORK
// ============================================================================

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** Bank details + official prices. No secrets. */
export async function fetchManualSettings() {
  return postJson('/api/manual-payment/settings', {});
}

/**
 * Upload a screenshot of the bank alert to Cloudinary through our signed
 * endpoint. Returns the https URL that the admin will review.
 */
export async function uploadProofImage(file) {
  if (!file) throw new Error('No image selected.');
  if (!/^image\//i.test(file.type)) throw new Error('Upload a picture of the bank alert (JPG, PNG or WEBP).');
  if (file.size > 6 * 1024 * 1024) throw new Error('That image is over 6 MB. Use a smaller screenshot.');

  const sigRes = await fetch('/api/manual-payment/proof-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ size: file.size }),
  });
  const sig = await sigRes.json().catch(() => ({}));
  if (!sigRes.ok) throw new Error(sig.message || 'Could not start the upload.');
  if (!sig.cloudName || !sig.signature) throw new Error(sig.message || 'Proof uploads are not configured.');

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('folder', sig.folder);
  form.append('allowed_formats', sig.allowedFormats);
  form.append('signature', sig.signature);

  const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const upData = await up.json().catch(() => ({}));
  if (!up.ok) throw new Error(upData.error?.message || 'The screenshot upload failed. Try again.');
  return upData.secure_url;
}

/** Submit proof of payment — creates a PENDING record. */
export async function submitManualPayment(payload) {
  return postJson('/api/manual-payment/submit', payload);
}

/** Reference + exact amount -> status of that submission. */
export async function checkManualPaymentStatus(reference, amount) {
  return postJson('/api/manual-payment/status', { reference, amount });
}

/** Small localStorage helper so a student does not lose their reference. */
const STORE_KEY = 'namatlManualPayments';
export function rememberManualPayment(entry) {
  try {
    const list = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    const next = [{ ...entry, savedAt: new Date().toISOString() }, ...list.filter(x => x.reference !== entry.reference)].slice(0, 5);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch (e) { /* storage full / private mode — non-fatal */ }
}
export function loadRememberedManualPayments() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}
