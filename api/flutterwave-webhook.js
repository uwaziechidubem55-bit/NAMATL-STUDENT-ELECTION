// /api/flutterwave-webhook.js
import { setDoc, doc, increment } from 'firebase/firestore';
import { db } from '../src/firebase';  // FIXED PATH

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const flutterwaveSignature = req.headers['verif-hash'];
  const mySecretHash = process.env.Flutterwave_WEBHOOK_SECRET;

  if (!flutterwaveSignature || flutterwaveSignature !== mySecretHash) {
    console.log('Webhook verification failed');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const payload = req.body;

  try {
    if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
      const amount = payload.data.amount;
      const tx_ref = payload.data.tx_ref;
      const transaction_id = payload.data.id;
      const academicYear = tx_ref.split('-')[2];

      if (Number(amount) < 25000) {
        console.log(`Payment rejected: Amount N${amount} is less than 25000`);
        return res.status(400).json({ message: 'Amount less than 25000' });
      }

      console.log(`Payment received for ${academicYear}: N${amount}`);

      await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
        balance: increment(amount),
        totalReceived: increment(amount),
        lastPaymentAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'finances', 'activations'), {
        [academicYear]: {
          paid: true,
          amount,
          paidAt: new Date().toISOString(),
          tx_ref,
          transaction_id
        }
      }, { merge: true });

      console.log(`${academicYear} activated successfully`);
    }

    return res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}