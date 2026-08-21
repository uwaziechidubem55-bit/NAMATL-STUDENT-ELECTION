// NAMATLS Payment verification — activation + form purchase in ONE function.
// v5: money-in flows through the shared finance ledger (creditPaymentOnce in
// _firebase.js), so the webhook and this endpoint can NEVER double-credit.
import { getDb, missingFirebaseEnv, creditPaymentOnce } from './_firebase.js';
import { verifyToken } from './_session.js';

const getSecretKey = () =>
  process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET;

const CREDIT_MESSAGES = {
  'already-credited': 'This payment was already processed successfully.',
  'year-already-activated': 'This academic year has already been activated.',
  'below-minimum': 'Amount is below the minimum required.',
  'invalid-tx-ref': 'This transaction is not a valid activation payment (tx_ref must start with ACT-).',
  'year-mismatch': 'The transaction reference does not match the academic year being activated.',
  'missing-transaction-id': 'Missing transaction id.',
};

function requireAdmin(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!process.env.SERVER_SESSION_SECRET) {
    res.status(500).json({ success: false, message: 'Server session secret not configured.' });
    return false;
  }
  const session = verifyToken(token, process.env.SERVER_SESSION_SECRET);
  if (!session || session.role !== 'admin') {
    res.status(401).json({ success: false, message: 'Unauthorized: Admin login required' });
    return false;
  }
  return true;
}

function creditResponse(res, result, successMessage) {
  if (result.credited) {
    return res.status(200).json({ success: true, message: successMessage });
  }
  if (result.reason === 'already-credited') {
    // The webhook already credited it (or this is a retry). Treat as SUCCESS —
    // never show a scary error for a payment that DID go through.
    return res.status(200).json({ success: true, alreadyCredited: true, message: CREDIT_MESSAGES[result.reason] });
  }
  return res.status(400).json({ success: false, message: CREDIT_MESSAGES[result.reason] || 'Payment could not be processed.' });
}

async function verifyActivation(req, res) {
  const { transaction_id, academicYear } = req.body || {};
  if (!transaction_id || !academicYear) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
    headers: { Authorization: `Bearer ${getSecretKey()}`, 'Content-Type': 'application/json' },
  });
  const data = await response.json();

  if (data.status !== 'success' || data.data?.status !== 'successful') {
    return res.status(400).json({ success: false, message: data.message || 'Transaction not successful' });
  }

  // Use Flutterwave's OWN tx_ref (not the client's) for validation.
  const result = await creditPaymentOnce({
    transactionId: transaction_id,
    txRef: data.data.tx_ref,
    amount: data.data.amount,
    kind: 'activation',
    academicYear,
  });

  return creditResponse(res, result, `Payment verified! N${Number(data.data.amount).toLocaleString()} credited. ${academicYear} activated securely.`);
}

async function verifyFormPayment(req, res) {
  const { transaction_id, position, candidateData } = req.body || {};
  if (!transaction_id || !position || !candidateData) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  const db = getDb();

  const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
    headers: { Authorization: `Bearer ${getSecretKey()}`, 'Content-Type': 'application/json' },
  });
  const data = await response.json();

  if (data.status !== 'success' || data.data?.status !== 'successful') {
    return res.status(400).json({ success: false, message: data.message || 'Transaction not successful' });
  }
  const paidAmount = data.data.amount;

  // Server-side price validation (unchanged behavior)
  const settingsSnap = await db.doc('settings/formPurchase').get();
  let adminPrice = 0;
  if (settingsSnap.exists) {
    const positions = settingsSnap.data().positions || [];
    const match = positions.find(p => p.position === position);
    if (!match) {
      return res.status(400).json({ success: false, message: `Position "${position}" is not configured for purchase` });
    }
    adminPrice = Number(match.amount) || 0;
  }
  if (adminPrice <= 0) {
    return res.status(400).json({ success: false, message: 'Could not determine the official price for this position' });
  }
  if (Number(paidAmount) < adminPrice) {
    return res.status(400).json({ success: false, message: `Paid N${paidAmount} but N${adminPrice} required` });
  }

  const result = await creditPaymentOnce({
    transactionId: transaction_id,
    txRef: data.data.tx_ref,
    amount: paidAmount,
    kind: 'form',
    meta: {
      position,
      fullName: candidateData.fullName,
      department: candidateData.department,
      level: candidateData.level,
      email: candidateData.email || 'Not provided',
    },
  });

  return creditResponse(res, result, `N${Number(paidAmount).toLocaleString()} credited! ${candidateData.fullName}'s ${position} form received.`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Use POST' });
  }
  try {
    if (missingFirebaseEnv.length) {
      return res.status(500).json({ success: false, message: 'Server Firebase env missing: ' + missingFirebaseEnv.join(', ') });
    }
    if (!getSecretKey()) {
      return res.status(500).json({ success: false, message: 'Flutterwave secret key not set (FLUTTERWAVE_SECRET_KEY / FLW_SECRET_KEY / FLUTTERWAVE_SECRET)' });
    }

    const { action } = req.query; // set by vercel.json rewrites
    switch (action) {
      case 'activation':
        // Only require Admin session when activating academic year
        if (!requireAdmin(req, res)) return;
        return verifyActivation(req, res);

      case 'form':
        // Candidates can verify their own form payment
        return verifyFormPayment(req, res);

      default:
        return res.status(400).json({ success: false, message: 'Unknown action: ' + action });
    }
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}