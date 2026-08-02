// NAMTLS Form Purchase Verification API — v4 (auto-fill removed, purchase record only)
// Server-side price validation + replay protection added.
import { setDoc, doc, increment, getDoc } from 'firebase/firestore';
import { getDb, missingFirebaseEnv } from './_firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Use POST' });
  }

  const { transaction_id, position, candidateData } = req.body || {};

  if (!transaction_id || !position || !candidateData) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    if (missingFirebaseEnv.length) {
      return res.status(500).json({ success: false, message: 'Server Firebase env missing: ' + missingFirebaseEnv.join(', ') });
    }
    const db = getDb();

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ success: false, message: 'Flutterwave secret key not set in environment variables' });
    }

    // 1. Verify with Flutterwave
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

    const paidAmount = data.data.amount;

    // 2. Server-side price validation — admin-set price from Firestore, never from the client
    const settingsSnap = await getDoc(doc(db, 'settings', 'formPurchase'));
    let adminPrice = 0;
    if (settingsSnap.exists()) {
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

    // 3. Replay protection — transaction_id IS the receipt doc ID (unique)
    const receiptRef = doc(db, 'formPurchases', String(transaction_id));
    const existingReceipt = await getDoc(receiptRef);
    if (existingReceipt.exists()) {
      return res.status(409).json({ success: false, message: 'This transaction has already been processed' });
    }

    // 4. Credit withdrawal balance
    await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
      balance: increment(Number(paidAmount)),
      totalReceived: increment(Number(paidAmount)),
      lastPaymentAt: new Date().toISOString()
    }, { merge: true });

    // 5. Save purchase record
    await setDoc(receiptRef, {
      position,
      amount: Number(paidAmount),
      fullName: candidateData.fullName,
      department: candidateData.department,
      level: candidateData.level,
      email: candidateData.email || 'Not provided',
      status: 'paid',
      transaction_id: String(transaction_id),
      paidAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: `N${Number(paidAmount).toLocaleString()} credited! ${candidateData.fullName}'s ${position} form received.`
    });

  } catch (error) {
    console.error('Form payment error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}