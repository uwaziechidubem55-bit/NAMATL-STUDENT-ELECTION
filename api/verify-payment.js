// NAMATLS Payment verification — activation + form purchase in ONE function.
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, missingFirebaseEnv } from './_firebase.js';

const getSecretKey = () =>
  process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET;

async function verifyActivation(req, res) {
  const { transaction_id, academicYear } = req.body || {};
  if (!transaction_id || !academicYear) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }
  const db = getDb();

  // Replay protection
  const receiptRef = db.doc('activationReceipts/' + String(transaction_id));
  const receiptSnap = await receiptRef.get();
  if (receiptSnap.exists) {
    return res.status(409).json({ success: false, message: 'This transaction receipt has already been processed and claimed.' });
  }

  const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
    headers: { Authorization: `Bearer ${getSecretKey()}`, 'Content-Type': 'application/json' },
  });
  const data = await response.json();

  if (data.status !== 'success' || data.data?.status !== 'successful') {
    return res.status(400).json({ success: false, message: data.message || 'Transaction not successful' });
  }
  const amount = data.data.amount;
  const tx_ref = data.data.tx_ref;
  if (Number(amount) < 25000) {
    return res.status(400).json({ success: false, message: 'Amount less than 25000' });
  }

  const activationRef = db.doc('finances/activations');
  const activationSnap = await activationRef.get();
  if (activationSnap.exists && activationSnap.data()[academicYear]?.paid) {
    return res.status(400).json({ success: false, message: `Year ${academicYear} already activated` });
  }

  await db.doc('finances/withdrawalBalance').set({
    balance: FieldValue.increment(Number(amount)),
    totalReceived: FieldValue.increment(Number(amount)),
    lastPaymentAt: new Date().toISOString(),
  }, { merge: true });

  await receiptRef.set({
    transaction_id: String(transaction_id),
    academicYear,
    amount: Number(amount),
    claimedAt: new Date().toISOString(),
  });

  await activationRef.set({
    [academicYear]: { paid: true, amount: Number(amount), paidAt: new Date().toISOString(), tx_ref, transaction_id: String(transaction_id) },
  }, { merge: true });

  return res.status(200).json({
    success: true,
    message: `Payment verified! N${Number(amount).toLocaleString()} credited. ${academicYear} activated securely.`,
  });
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

  // Server-side price validation
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

  // Replay protection
  const receiptRef = db.doc('formPurchases/' + String(transaction_id));
  const existingReceipt = await receiptRef.get();
  if (existingReceipt.exists) {
    return res.status(409).json({ success: false, message: 'This transaction has already been processed' });
  }

  await db.doc('finances/withdrawalBalance').set({
    balance: FieldValue.increment(Number(paidAmount)),
    totalReceived: FieldValue.increment(Number(paidAmount)),
    lastPaymentAt: new Date().toISOString(),
  }, { merge: true });

  await receiptRef.set({
    position,
    amount: Number(paidAmount),
    fullName: candidateData.fullName,
    department: candidateData.department,
    level: candidateData.level,
    email: candidateData.email || 'Not provided',
    status: 'paid',
    transaction_id: String(transaction_id),
    paidAt: new Date().toISOString(),
  });

  return res.status(200).json({
    success: true,
    message: `N${Number(paidAmount).toLocaleString()} credited! ${candidateData.fullName}'s ${position} form received.`,
  });
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
      case 'activation': return verifyActivation(req, res);
      case 'form': return verifyFormPayment(req, res);
      default:
        return res.status(400).json({ success: false, message: 'Unknown action: ' + action });
    }
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}