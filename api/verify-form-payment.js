// NAMTLS Form Purchase Verification API — v3 (auto-fill removed, purchase record only)
import { setDoc, doc, increment, addDoc, collection } from 'firebase/firestore';
import { db } from '../src/firebase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Use POST' });
  }

  const { transaction_id, position, amount, candidateData } = req.body;

  if (!transaction_id || !position || !amount || !candidateData) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
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

    // 2. Verify amount matches
    if (Number(paidAmount) < Number(amount)) {
      return res.status(400).json({ success: false, message: `Paid N${paidAmount} but required N${amount}` });
    }

    // 3. Credit withdrawal balance
    await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
      balance: increment(Number(paidAmount)),
      totalReceived: increment(Number(paidAmount)),
      lastPaymentAt: new Date().toISOString()
    }, { merge: true });

    // 4. Save purchase record — this is what the Admin Purchase List reads from
    await addDoc(collection(db, 'formPurchases'), {
      position,
      amount: Number(paidAmount),
      fullName: candidateData.fullName,
      department: candidateData.department,
      level: candidateData.level,
      email: candidateData.email || 'Not provided',
      status: 'paid',
      paidAt: new Date().toISOString()
    });

    // ❌ NO AUTO-FILL — candidates are no longer created here.
    // Admin registers candidates manually from the Purchase List.

    return res.status(200).json({
      success: true,
      message: `N${Number(paidAmount).toLocaleString()} credited! ${candidateData.fullName}'s ${position} form received.`
    });

  } catch (error) {
    console.error('Form payment error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}