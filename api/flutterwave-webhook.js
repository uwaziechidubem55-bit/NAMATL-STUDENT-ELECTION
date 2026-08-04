// /api/flutterwave-webhook.js v4
// 1) charge.completed -> activation payments (>=25k). FORM- payments are skipped
//    because verify-form-payment already credits them (fixes double-credit).
//    Activation credits now go through the SHARED finance ledger
//    (creditPaymentOnce in _firebase.js) — the same ledger the verify endpoint
//    uses, so webhook vs callback can NEVER double-credit, in either order.
// 2) transfer.completed -> withdrawal transfers: finalizes the record + balance
//    EXACTLY ONCE, the moment Flutterwave confirms the money moved.
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, missingFirebaseEnv, creditPaymentOnce, parseActivationYear } from './_firebase.js';

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

  const payload = req.body || {};

  try {
    if (missingFirebaseEnv.length) {
      return res.status(500).json({ success: false, message: 'Server Firebase env missing: ' + missingFirebaseEnv.join(', ') });
    }
    const db = getDb();

    // ================= CHARGE COMPLETED (activation payments) =================
    if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
      const amount = payload.data.amount;
      const tx_ref = payload.data.tx_ref || '';
      const transaction_id = payload.data.id;

      // FORM purchases are credited by /api/verify-form-payment — skip here
      if (String(tx_ref).startsWith('FORM-')) {
        console.log(`Webhook: Skipping form payment ${tx_ref} (credited by verify-form-payment)`);
        return res.status(200).json({ status: 'skipped - form payment' });
      }

      if (Number(amount) < 25000) {
        console.log(`Webhook: Skipping payment under N25,000 (N${amount})`);
        return res.status(200).json({ status: 'skipped - below threshold' });
      }

      // Atomic claim + credit via the SHARED ledger (same one verify-payment uses).
      // "already-credited" / "year-already-activated" here are EXPECTED and safe.
      const result = await creditPaymentOnce({
        transactionId: transaction_id,
        txRef: tx_ref,
        amount,
        kind: 'activation',
      });

      if (result.credited) {
        console.log(`Webhook: Credited N${amount} from transaction ${transaction_id} (${parseActivationYear(tx_ref) || 'unknown'} activated)`);
      } else {
        console.log(`Webhook: Not credited - ${result.reason} (transaction ${transaction_id})`);
      }
      // Always 200: the event was received and handled. A non-credited result
      // is not an error — it means another path already took care of it.
      return res.status(200).json({ status: result.credited ? 'credited' : result.reason });
    }

    // ================= TRANSFER COMPLETED (withdrawals) =================
    if (payload.event === 'transfer.completed') {
      const status = String(payload.data?.status || '').toLowerCase();
      const reference = payload.data?.reference || '';
      const transferId = payload.data?.id || '';
      const amount = Number(payload.data?.amount || 0);

      console.log(`Webhook: transfer.completed ${reference} -> ${status}`);

      if (!reference) {
        return res.status(200).json({ status: 'skipped - no reference' });
      }

      const recordRef = db.collection('withdrawals').doc(reference);

      if (status === 'successful') {
        await db.runTransaction(async (tx) => {
          const cur = await tx.get(recordRef);
          if (cur.exists && cur.data().status === 'successful') return; // already done
          tx.set(recordRef, {
            reference,
            flutterwaveId: transferId ? String(transferId) : (cur.exists ? cur.data().flutterwaveId : ''),
            amount: amount || (cur.exists ? Number(cur.data().amount || 0) : 0),
            status: 'successful',
            verifiedAt: new Date().toISOString()
          }, { merge: true });
          const balRef = db.doc('finances/withdrawalBalance');
          tx.set(balRef, {
            balance: FieldValue.increment(-(amount || (cur.exists ? Number(cur.data().amount || 0) : 0))),
            totalWithdrawn: FieldValue.increment(amount || (cur.exists ? Number(cur.data().amount || 0) : 0)),
            lastWithdrawalAt: new Date().toISOString(),
            lastWithdrawalRef: reference,
            pendingWithdrawal: null
          }, { merge: true });
        });
        console.log(`Webhook: Withdrawal ${reference} CONFIRMED and balance updated`);
      }

      if (status === 'failed') {
        await recordRef.set({ status: 'failed', failedAt: new Date().toISOString() }, { merge: true });
        await db.doc('finances/withdrawalBalance').set({ pendingWithdrawal: null }, { merge: true });
        console.log(`Webhook: Withdrawal ${reference} FAILED - cleared pending lock`);
      }
    }

    return res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}