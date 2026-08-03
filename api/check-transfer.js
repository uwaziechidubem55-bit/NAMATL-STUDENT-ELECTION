// /api/check-transfer.js — REAL-TIME + AUTOMATED withdrawal status checker
// Asks Flutterwave directly whether a transfer passed, then finalizes the
// Firestore withdrawal record + balance EXACTLY ONCE (idempotent).
// Records live in the top-level `withdrawals/{reference}` collection.
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './_firebase.js';

// Reusable function to verify a single transfer ID/reference against Flutterwave
async function verifySingleTransfer(db, secretKey, reference, transferId) {
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

  // Recover by searching saved records if needed
  if (!record && flwTransferId) {
    const qs = await db.collection('withdrawals').where('flutterwaveId', '==', String(flwTransferId)).get();
    if (!qs.empty) {
      const firstDoc = qs.docs[0]; // ✅ FIXED: Safely grab the first item from the array
      recordRef = firstDoc.ref;
      record = firstDoc.data();
    }
  }

  if (!flwTransferId) {
    return { success: false, status: 'missing_id', message: 'No Flutterwave transfer ID available yet.' };
  }

  // Already finalized check
  if (record && (record.status === 'successful' || record.status === 'failed')) {
    return {
      success: true,
      verified: record.status === 'successful',
      status: record.status,
      reference: record.reference,
      message: record.status === 'successful'
        ? `CONFIRMED: N${Number(record.amount).toLocaleString()} was sent (${record.reference}).`
        : `Transfer ${record.reference} failed.`
    };
  }

  // Ask Flutterwave for the REAL status
  const resp = await fetch(`https://api.flutterwave.com/v3/transfers/${flwTransferId}`, {
    headers: { 'Authorization': `Bearer ${secretKey}` }
  });
  const data = await resp.json();
  const status = String(data.data?.status || data.status || 'unknown').toLowerCase();
  const flwAmount = Number(data.data?.amount || 0);
  const ref = record?.reference || reference || data.data?.reference || ('NAMTLS-WD-' + flwTransferId);

  if (status === 'successful') {
    await db.runTransaction(async (tx) => {
      const targetRef = recordRef || db.collection('withdrawals').doc(ref);
      const cur = await tx.get(targetRef);
      if (cur.exists && cur.data().status === 'successful') return;
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

    return { success: true, verified: true, status: 'successful', reference: ref, message: `CONFIRMED: Transfer ${flwTransferId} successful. Balance updated.` };
  }

  if (status === 'failed') {
    if (recordRef) {
      await recordRef.set({ status: 'failed', failedAt: new Date().toISOString() }, { merge: true });
      await db.doc('finances/withdrawalBalance').set({ pendingWithdrawal: null }, { merge: true });
    }
    const reason = data.data?.complete_message || data.data?.note || data.message || 'No reason given';
    return { success: true, verified: false, status: 'failed', reference: ref, message: `Transfer FAILED: ${reason}.` };
  }

  return { success: true, verified: false, status, reference: ref, message: `Transfer is still "${status}" on Flutterwave.` };
}

export default async function handler(req, res) {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET;
  if (!secretKey) {
    return res.status(500).json({ success: false, message: 'Flutterwave secret key not set' });
  }

  const db = getDb();

  // -------------------------------------------------------------------------
  // APPROACH A: Automated Background Cron Job (Triggered by Vercel via GET)
  // -------------------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      // Find all withdrawals that are currently stuck in processing or queued status
      const processingDocs = await db.collection('withdrawals').where('status', 'in', ['processing', 'queued']).limit(10).get();
      
      if (processingDocs.empty) {
        return res.status(200).json({ success: true, message: 'Cron run clear: No processing withdrawals found.' });
      }

      console.log(`[NAMTLS CRON] Found ${processingDocs.size} processing transfers to check.`);
      const results = [];

      for (const docSnap of processingDocs.docs) {
        const txData = docSnap.data();
        const outcome = await verifySingleTransfer(db, secretKey, txData.reference, txData.flutterwaveId);
        results.push({ reference: txData.reference, status: outcome.status });
      }

      return res.status(200).json({ success: true, cronProcessed: results });
    } catch (cronError) {
      console.error('[NAMTLS CRON] Automation Error:', cronError.message);
      return res.status(500).json({ success: false, error: cronError.message });
    }
  }

  // -------------------------------------------------------------------------
  // APPROACH B: Manual On-Demand Check (Triggered by clicking Dashboard button via POST)
  // -------------------------------------------------------------------------
  if (req.method === 'POST') {
    const { reference, transferId } = req.body || {};
    if (!reference && !transferId) {
      return res.status(400).json({ success: false, message: 'Send reference or transferId' });
    }

    try {
      const outcome = await verifySingleTransfer(db, secretKey, reference, transferId);
      if (!outcome.success) {
        return res.status(400).json(outcome);
      }
      return res.status(200).json(outcome);
    } catch (e) {
      console.error('Manual check-transfer error:', e.message);
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
