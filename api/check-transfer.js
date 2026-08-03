// /api/check-transfer.js — REAL-TIME withdrawal status checker
// Asks Flutterwave directly whether a transfer passed, then finalizes the
// Firestore withdrawal record + balance EXACTLY ONCE (idempotent).
// Records live in the top-level `withdrawals/{reference}` collection.
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Use POST' });
  }

  const { reference, transferId } = req.body || {};
  if (!reference && !transferId) {
    return res.status(400).json({ success: false, message: 'Send reference or transferId' });
  }

  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET;
  if (!secretKey) {
    return res.status(500).json({ success: false, message: 'Flutterwave secret key not set (FLUTTERWAVE_SECRET_KEY / FLW_SECRET_KEY / FLUTTERWAVE_SECRET)' });
  }

  try {
    const db = getDb();

    // ---- 1. Load (or recover) the withdrawal record -----------------------
    let recordRef = reference ? db.collection('withdrawals').doc(reference) : null;
    let record = null;
    let flwTransferId = transferId || null;

    if (recordRef) {
      const snap = await recordRef.get();
      if (snap.exists) {
        record = snap.data();
        flwTransferId = flwTransferId || record.flutterwaveId;
      }
    }

    // No record but we have a transferId -> recover by searching saved records
    if (!record && flwTransferId) {
      const qs = await db.collection('withdrawals').where('flutterwaveId', '==', String(flwTransferId)).get();
      if (!qs.empty) {
        const firstDoc = qs.docs[0]; // Safely extract the document snapshot first
        recordRef = firstDoc.ref;
        record = firstDoc.data();
      }
    }

    if (!flwTransferId) {
      return res.status(400).json({ success: false, message: 'No Flutterwave transfer ID available yet. Try again in a minute.' });
    }

    if (record && (record.status === 'successful' || record.status === 'failed')) {
      return res.status(200).json({
        success: true,
        verified: record.status === 'successful',
        status: record.status,
        reference: record.reference,
        message: record.status === 'successful'
          ? `CONFIRMED: N${Number(record.amount).toLocaleString()} was sent (${record.reference}).`
          : `Transfer ${record.reference} failed. You can retry.`
      });
    }

    // ---- 2. Ask Flutterwave for the REAL status ---------------------------
    const resp = await fetch(`https://api.flutterwave.com/v3/transfers/${flwTransferId}`, {
      headers: { 'Authorization': `Bearer ${secretKey}` }
    });
    const data = await resp.json();
    const status = String(data.data?.status || data.status || 'unknown').toLowerCase();
    const flwAmount = Number(data.data?.amount || 0);
    const ref = record?.reference || reference || data.data?.reference || ('NAMTLS-WD-' + flwTransferId);

    if (status === 'successful') {
      // ---- 3. Finalize EXACTLY ONCE (atomic) ------------------------------
      await db.runTransaction(async (tx) => {
        const targetRef = recordRef || db.collection('withdrawals').doc(ref);
        const cur = await tx.get(targetRef);
        if (cur.exists && cur.data().status === 'successful') return; // already finalized
        const amount = record?.amount || flwAmount || 0;
        
        tx.set(targetRef, {
          reference: ref,
          flutterwaveId: String(flwTransferId),
          amount,
          status: 'successful',
          verifiedAt: new Date().toISOString()
        }, { merge: true });
        
        const balRef = db.doc('finances/withdrawalBalance');
        tx.set(balRef, {
          balance: FieldValue.increment(-amount),
          totalWithdrawn: FieldValue.increment(amount),
          lastWithdrawalAt: new Date().toISOString(),
          lastWithdrawalRef: ref,
          pendingWithdrawal: null
        }, { merge: true });
      });

      return res.status(200).json({
        success: true, verified: true, status: 'successful', reference: ref,
        message: `CONFIRMED: Flutterwave says transfer ${flwTransferId} is successful. Balance updated.`
      });
    }

    if (status === 'failed') {
      if (recordRef) {
        await recordRef.set({ status: 'failed', failedAt: new Date().toISOString() }, { merge: true });
        await db.doc('finances/withdrawalBalance').set({ pendingWithdrawal: null }, { merge: true });
      }
      const reason = data.data?.complete_message || data.data?.note || data.message || 'No reason given';
      return res.status(200).json({ success: true, verified: false, status: 'failed', reference: ref, message: `Transfer FAILED: ${reason}. Flutterwave refunds it. You can retry.` });
    }

    return res.status(200).json({
      success: true, verified: false, status, reference: ref,
      message: `Transfer is still "${status}" on Flutterwave. It will auto-confirm.`
    });
  } catch (e) {
    console.error('check-transfer error:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
}
