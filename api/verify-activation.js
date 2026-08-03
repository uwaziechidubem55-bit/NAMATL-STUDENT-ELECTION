// NAMTLS Manual Verify + Credit API
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, missingFirebaseEnv } from './_firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Use POST' });
  }

  const { transaction_id, academicYear } = req.body || {};

  if (!transaction_id || !academicYear) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  try {
    if (missingFirebaseEnv.length) {
      return res.status(500).json({ success: false, message: 'Server Firebase env missing: ' + missingFirebaseEnv.join(', ') });
    }
    const db = getDb();

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET;
    if (!secretKey) {
      return res.status(500).json({ success: false, message: 'Flutterwave secret key not set (FLUTTERWAVE_SECRET_KEY / FLW_SECRET_KEY / FLUTTERWAVE_SECRET)' });
    }

    // ---- 1. Replay Protection: Check if this specific receipt was already claimed ----
    const receiptRef = db.doc('activationReceipts/' + String(transaction_id));
    const receiptSnap = await receiptRef.get();
    if (receiptSnap.exists) {
      return res.status(409).json({ success: false, message: 'This transaction receipt has already been processed and claimed.' });
    }

    // ---- 2. Verify with Flutterwave ----
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.status !== 'success' || data.data?.status !== 'successful') {
      return res.status(400).json({
        success: false,
        message: data.message || 'Transaction not successful'
      });
    }

    const amount = data.data.amount;
    const tx_ref = data.data.tx_ref;

    if (Number(amount) < 25000) {
      return res.status(400).json({ success: false, message: 'Amount less than 25000' });
    }

    // ---- 3. Year check: See if this specific year is already active ----
    const activationRef = db.doc('finances/activations');
    const activationSnap = await activationRef.get();
    if (activationSnap.exists && activationSnap.data()[academicYear]?.paid) {
      return res.status(400).json({ success: false, message: `Year ${academicYear} already activated` });
    }

    // ---- 4. Credit withdrawal balance ledger safely ----
    await db.doc('finances/withdrawalBalance').set({
      balance: FieldValue.increment(Number(amount)),
      totalReceived: FieldValue.increment(Number(amount)),
      lastPaymentAt: new Date().toISOString()
    }, { merge: true });

    // ---- 5. Lock the receipt permanently so it can never be processed again ----
    await receiptRef.set({
      transaction_id: String(transaction_id),
      academicYear,
      amount: Number(amount),
      claimedAt: new Date().toISOString()
    });

    // ---- 6. Activate the target academic year ----
    await activationRef.set({
      [academicYear]: {
        paid: true,
        amount: Number(amount),
        paidAt: new Date().toISOString(),
        tx_ref,
        transaction_id: String(transaction_id)
      }
    }, { merge: true });

    return res.status(200).json({
      success: true,
      message: `Payment verified! N${Number(amount).toLocaleString()} credited. ${academicYear} activated securely.`
    });

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
