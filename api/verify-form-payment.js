// NAMTLS Form Purchase Verification API
import { setDoc, doc, increment, getDoc, collection, getDocs, addDoc } from 'firebase/firestore';
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
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ success: false, message: 'FLUTTERWAVE_SECRET_KEY not set' });
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
      return res.status(400).json({ success: false, message: 'Paid less than required amount' });
    }

    // 3. Check 5-candidate limit
    const candidatesSnap = await getDocs(collection(db, 'candidates'));
    const positionCount = candidatesSnap.docs.filter(d => d.data().position === position).length;

    // 4. Credit withdrawal balance
    await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
      balance: increment(Number(paidAmount)),
      totalReceived: increment(Number(paidAmount)),
      lastPaymentAt: new Date().toISOString()
    }, { merge: true });

    // 5. Save purchase record
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

    // 6. Add to candidates (if under limit)
    if (positionCount < 5) {
      await addDoc(collection(db, 'candidates'), {
        name: candidateData.fullName,
        position: position,
        dept: candidateData.department,
        level: candidateData.level,
        email: candidateData.email || '',
        votes: 0,
        photo: '',
        manifesto: 'Form purchased on ' + new Date().toLocaleDateString(),
        paidForm: true,
        paidAt: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: `N${Number(paidAmount).toLocaleString()} credited! ${candidateData.fullName} registered for ${position}.`
    });

  } catch (error) {
    console.error('Form payment error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}