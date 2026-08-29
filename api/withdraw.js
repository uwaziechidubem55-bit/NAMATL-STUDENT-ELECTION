// NAMTLS Withdrawal API v7 — admin auth + server-safe Firebase init.
// Withdrawal records live in the top-level `withdrawals/{reference}` collection
// (the old `finances/withdrawals/{reference}` path is invalid in Firestore —
// document paths require an EVEN number of segments).
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, missingFirebaseEnv } from './_firebase.js';
import { verifyToken } from './_session.js';
import { writeAudit } from './_audit.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    if (missingFirebaseEnv.length) {
      return res.status(500).json({
        success: false,
        message: 'Server Firebase env missing: ' + missingFirebaseEnv.join(', '),
      });
    }
    const db = getDb();

    const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET || '';
    if (!FLUTTERWAVE_SECRET) {
      return res.status(500).json({ success: false, message: 'Flutterwave secret key not set (FLUTTERWAVE_SECRET_KEY / FLW_SECRET_KEY / FLUTTERWAVE_SECRET)' });
    }

    // ---- Session auth ----
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!process.env.SERVER_SESSION_SECRET) {
      return res.status(500).json({ success: false, message: 'Server session secret not configured.' });
    }
    const session = verifyToken(token, process.env.SERVER_SESSION_SECRET);
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Unauthorized: please log in as admin again.' });
    }

    // ---- Body + admin PIN check ----
    const { amount, accountNumber, narration, adminId, pin } = req.body || {};
    if (!amount || !accountNumber) {
      return res.status(400).json({ success: false, message: 'Amount and account number are required' });
    }

    const expectedAdminId = process.env.ADMIN_ID || '';
    const expectedPin = process.env.WITHDRAWAL_PIN || '';
    if (!expectedAdminId || !expectedPin) {
      return res.status(500).json({ success: false, message: 'Admin withdrawal credentials not configured on server.' });
    }
    if (String(adminId) !== expectedAdminId || String(pin) !== expectedPin) {
      return res.status(401).json({ success: false, message: 'Invalid Admin ID or withdrawal PIN' });
    }

    const withdrawalAmount = Number(amount);
    if (withdrawalAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // ---- Balance + pending lock ----
    const balanceDoc = db.doc('finances/withdrawalBalance');
    const balanceSnap = await balanceDoc.get();

    const pending = balanceSnap.exists ? balanceSnap.data().pendingWithdrawal : null;
    if (pending && pending.status && pending.status !== 'failed') {
      return res.status(400).json({
        success: false,
        unverified: true,
        message: `A withdrawal is already processing (Ref: ${pending.reference}). Confirm it first — checking Flutterwave now...`,
        reference: pending.reference,
        flutterwaveId: pending.flutterwaveId || null,
      });
    }

    const currentBalance = balanceSnap.exists ? Number(balanceSnap.data().balance || 0) : 0;
    if (withdrawalAmount > currentBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₦${currentBalance.toLocaleString()}`,
      });
    }

    const OPAY_BANK_CODE = '100004';
    const reference = `NAMTLS-WD-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    const recordRef = db.collection('withdrawals').doc(reference);
    await recordRef.set({
      reference,
      amount: withdrawalAmount,
      accountNumber: String(accountNumber),
      status: 'processing',
      createdAt: new Date().toISOString(),
    });

    console.log(`[NAMTLS] Initiating transfer: N${withdrawalAmount} to ${accountNumber} (${reference})`);

    const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank: OPAY_BANK_CODE,
        account_number: String(accountNumber),
        amount: withdrawalAmount,
        narration: narration || 'NAMTLS E-Voting Withdrawal',
        currency: 'NGN',
        reference,
        beneficiary_name: 'DANIEL CHIDUBEM UWAZIE',
      }),
    });

    const transferData = await transferResponse.json();
    console.log('[NAMTLS] Submit response:', JSON.stringify(transferData, null, 2));

    if (transferData.status !== 'success') {
      let errorMsg = transferData.message || 'Unknown Flutterwave error';
      if (transferData.data?.complete_message) errorMsg = transferData.data.complete_message;
      if (transferData.data?.note) errorMsg = transferData.data.note;
      await recordRef.set({ status: 'failed', failedAt: new Date().toISOString() }, { merge: true });
      return res.status(400).json({
        success: false,
        message: `Flutterwave rejected: ${errorMsg}`,
        flutterwaveFullResponse: transferData,
      });
    }

    const transferId = transferData.data?.id;
    if (!transferId) {
      await recordRef.set({ status: 'submitted-no-id', submittedAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({
        success: true,
        unverified: true,
        message: `Flutterwave accepted (Ref: ${reference}) but no transfer ID returned. It will auto-confirm via webhook.`,
        reference,
      });
    }

    await recordRef.set({ flutterwaveId: String(transferId), status: 'queued' }, { merge: true });
    await balanceDoc.set({
      pendingWithdrawal: {
        reference,
        flutterwaveId: String(transferId),
        amount: withdrawalAmount,
        status: 'queued',
        createdAt: new Date().toISOString(),
      },
    }, { merge: true });

    // ---- Short poll (fast path only; the webhook is the source of truth). ----
    const maxAttempts = Math.min(Number(process.env.WITHDRAW_POLL_ATTEMPTS || 3), 6);
    let finalStatus = '';
    let finalData = null;

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transfers/${transferId}`, {
          headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET}` },
        });
        finalData = await verifyResponse.json();
        finalStatus = finalData.data?.status || '';
        console.log(`[NAMTLS] Poll attempt ${attempts + 1}/${maxAttempts}: status = ${finalStatus}`);

        if (finalStatus.toLowerCase() === 'successful') {
          await db.runTransaction(async (tx) => {
            const cur = await tx.get(recordRef);
            if (cur.exists && cur.data().status === 'successful') return;
            tx.set(recordRef, { status: 'successful', verifiedAt: new Date().toISOString() }, { merge: true });
            tx.set(balanceDoc, {
              balance: FieldValue.increment(-withdrawalAmount),
              totalWithdrawn: FieldValue.increment(withdrawalAmount),
              lastWithdrawalAt: new Date().toISOString(),
              lastWithdrawalRef: reference,
              pendingWithdrawal: null,
            }, { merge: true });
          });

          return res.status(200).json({
            success: true,
            verified: true,
            message: `CONFIRMED: N${withdrawalAmount.toLocaleString()} sent to Opay ${accountNumber}! Ref: ${reference}`,
            reference,
            flutterwaveId: transferId,
            status: 'successful',
          });
        }

        if (finalStatus.toLowerCase() === 'failed') {
          const failReason = finalData.data?.complete_message || finalData.data?.note || 'No reason provided';
          await recordRef.set({ status: 'failed', failedAt: new Date().toISOString() }, { merge: true });
          await balanceDoc.set({ pendingWithdrawal: null }, { merge: true });
          return res.status(400).json({
            success: false,
            message: `Transfer FAILED: ${failReason}`,
            flutterwaveFullResponse: finalData,
            reference,
          });
        }
      } catch (pollError) {
        console.log(`[NAMTLS] Poll error on attempt ${attempts + 1}: ${pollError.message}`);
      }
    }

    await writeAudit({ db, actor: 'admin', action: 'WITHDRAWAL_REQUESTED', details: { amount: Number(amount) || 0, accountNumber: String(accountNumber).slice(-4).padStart(10, '*'), reference } });

    return res.status(200).json({
      success: true,
      unverified: true,
      message: `Transfer submitted and processing on Flutterwave (Ref: ${reference}). Confirming automatically...`,
      reference,
      flutterwaveId: transferId,
      status: finalStatus || 'unknown',
      flutterwaveDashboardUrl: `https://dashboard.flutterwave.com/transfers/${transferId}`,
    });
  } catch (e) {
    console.error('[NAMTLS] Server error:', e);
    return res.status(500).json({
      success: false,
      message: `Server Error: ${e.message}. Check function logs.`,
    });
  }
}