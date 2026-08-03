// /api/check-transfer.js — REAL-TIME withdrawal status checker
// Asks Flutterwave directly whether a transfer passed, then finalizes the
// Firestore withdrawal record + balance EXACTLY ONCE (idempotent).
import { doc, getDoc, setDoc, increment, runTransaction, collection, query, where, getDocs } from 'firebase-admin/firestore';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Use POST' });
  }

  const { reference, transferId } = req.body || {};
  if (!reference && !transferId) {
    return res.status(400).json({ success: false, message: 'Send reference or transferId' });
  }

  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ success: false, message: 'FLUTTERWAVE_SECRET_KEY not set' });
  }

  try {
    const db = getDb();

    // ---- 1. Load (or recover) the withdrawal record -----------------------
    let recordRef = reference ? doc(db, 'finances', 'withdrawals', reference) : null;
    let record = null;
    let flwTransferId = transferId || null;

    if (recordRef) {
      const snap = await getDoc(recordRef);
      if (snap.exists()) {
        record = snap.data();
        flwTransferId = flwTransferId || record.flutterwaveId;
      }
    }

    // No record but we have a transferId -> recover by searching saved records
    if (!record && flwTransferId) {
      const q = query(collection(db, 'finances', 'withdrawals'), where('flutterwaveId', '==', String(flwTransferId)));
      const qs = await getDocs(q);
      if (!qs.empty) {
        recordRef = qs.docs[0].ref;
        record = qs.docs[0].data();
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
      await runTransaction(db, async (tx) => {
        const targetRef = recordRef || doc(db, 'finances', 'withdrawals', ref);
        const cur = await tx.get(targetRef);
        if (cur.exists() && cur.data().status === 'successful') return; // already finalized
        const amount = record?.amount || flwAmount || 0;
        tx.set(targetRef, {
          reference: ref,
          flutterwaveId: String(flwTransferId),
          amount,
          status: 'successful',
          verifiedAt: new Date().toISOString()
        }, { merge: true });
        const balRef = doc(db, 'finances', 'withdrawalBalance');
        tx.set(balRef, {
          balance: increment(-amount),
          totalWithdrawn: increment(amount),
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
        await setDoc(recordRef, { status: 'failed', failedAt: new Date().toISOString() }, { merge: true });
        await setDoc(doc(db, 'finances', 'withdrawalBalance'), { pendingWithdrawal: null }, { merge: true });
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