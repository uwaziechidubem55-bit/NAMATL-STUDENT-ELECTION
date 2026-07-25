// /api/flutterwave-webhook.js
import { setDoc, doc, increment, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase';

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

      if (Number(amount) < 25000) {
        console.log(`Webhook: Skipping payment under ₦25,000 (₦${amount})`);
        return res.status(200).json({ status: 'skipped - below threshold' });
      }

      // DEDUP CHECK: Skip if already processed
      const activationsSnap = await getDoc(doc(db, 'finances', 'activations'));
      if (activationsSnap.exists()) {
        const activations = activationsSnap.data();
        for (const year in activations) {
          if (activations[year].transaction_id === transaction_id) {
            console.log(`Webhook: Transaction ${transaction_id} already processed. Skipping.`);
            return res.status(200).json({ status: 'skipped - already processed' });
          }
        }
      }

      console.log(`Webhook: Crediting ₦${amount} from transaction ${transaction_id}`);

      await setDoc(doc(db, 'finances', 'withdrawalBalance'), {
        balance: increment(amount),
        totalReceived: increment(amount),
        lastPaymentAt: new Date().toISOString()
      }, { merge: true });

      const academicYear = tx_ref?.split('-')[2] || 'unknown';
      await setDoc(doc(db, 'finances', 'activations'), {
        [academicYear]: {
          paid: true,
          amount,
          paidAt: new Date().toISOString(),
          tx_ref,
          transaction_id
        }
      }, { merge: true });

      console.log(`Webhook: ${academicYear} activated successfully`);
    }

    return res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}