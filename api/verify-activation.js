// NAMTLS Manual Verify + Credit API
import { setDoc, doc, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default async function handler(req, res) {
  if (req.method!== 'POST') {
    return res.status(405).json({ success: false, message: 'Use POST' });
  }

  const { transaction_id, academicYear } = req.body;

  if (!transaction_id ||!academicYear) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  try {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ success: false, message: 'FLUTTERWAVE_SECRET_KEY not set in Vercel env vars' });
    }

    // 1. VERIFY FROM FLUTTERWAVE
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.status!== 'success' || data.data?.status!== 'successful') {
      return res.status(400).json({
        success: false,
        message: data.message || 'Transaction not successful'
      });
    }

    const amount = data.data.amount;
    const tx_ref = data.data.tx_ref;

    // 2. SECURITY CHECKS
    if (Number(amount) < 25000) {
      return res.status(400).json({ success: false, message: 'Amount less than 25000' });
    }

    // 3. PREVENT DOUBLE CREDIT
    const activationRef = doc(db, 'finances', 'activations');
    const activationSnap = await getDoc(activationRef);
    if (activationSnap.exists() && activationSnap.data()[academicYear]?.paid) {
      return res.status(400).json({ success: false, message: `Year ${academicYear} already activated` });
    }

    // 4. CREDIT BALANCE + ACTIVATE YEAR
    await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
      balance: increment(amount),
      totalReceived: increment(amount),
      lastPaymentAt: new Date().toISOString()
    }, { merge: true });

    await setDoc(activationRef, {
      [academicYear]: {
        paid: true,
        amount,
        paidAt: new Date().toISOString(),
        tx_ref,
        transaction_id
      }
    }, { merge: true });

    return res.status(200).json({
      success: true,
      message: `Payment verified! N${amount} credited. ${academicYear} activated.`
    });

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}