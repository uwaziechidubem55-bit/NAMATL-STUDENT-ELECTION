// NAMTLS Withdrawal API v4 - pending-record + duplicate-send protection + transferId always returned
import { doc, setDoc, getDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from '../src/firebase';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { amount, accountNumber, narration } = req.body;
    if (!amount || !accountNumber) {
      return res.status(400).json({ success: false, message: 'Amount and account number are required' });
    }

    const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY;
    if (!FLUTTERWAVE_SECRET) {
      return res.status(500).json({ success: false, message: 'FLUTTERWAVE_SECRET_KEY not set in Vercel env vars' });
    }

    const withdrawalAmount = Number(amount);
    if (withdrawalAmount < 100) return res.status(400).json({ success: false, message: 'Minimum withdrawal is 100' });
    if (withdrawalAmount > 1000000) return res.status(400).json({ success: false, message: 'Maximum withdrawal is 1,000,000' });

    // ===== DUPLICATE-SEND PROTECTION =====
    // If a previous withdrawal is still unconfirmed on Flutterwave, refuse a new
    // transfer instead of sending the money twice.
    const balanceDoc = doc(db, 'finances', 'withdrawalBalance');
    const balanceSnap = await getDoc(balanceDoc);
    const pending = balanceSnap.exists() ? balanceSnap.data().pendingWithdrawal : null;
    if (pending && ['processing', 'queued', 'pending', 'new'].includes(String(pending.status || '').toLowerCase())) {
      return res.status(409).json({
        success: false,
        unverified: true,
        message: `A withdrawal is already processing (Ref: ${pending.reference}). Confirm it first — checking Flutterwave now...`,
        reference: pending.reference,
        flutterwaveId: pending.flutterwaveId || null
      });
    }

    const OPAY_BANK_CODE = '100004';
    const reference = `NAMTLS-WD-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    // ===== Save the record FIRST (source of truth for webhook/check-transfer) =====
    const recordRef = doc(db, 'finances', 'withdrawals', reference);
    await setDoc(recordRef, {
      reference,
      amount: withdrawalAmount,
      accountNumber: accountNumber.toString(),
      status: 'processing',
      createdAt: new Date().toISOString()
    });

    console.log(`[NAMTLS] Initiating transfer: N${withdrawalAmount} to ${accountNumber} (${reference})`);

    const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_bank: OPAY_BANK_CODE,
        account_number: accountNumber.toString(),
        amount: withdrawalAmount,
        narration: narration || 'NAMTLS E-Voting Withdrawal',
        currency: 'NGN',
        reference: reference,
        beneficiary_name: 'DANIEL CHIDUBEM UWAZIE'
      })
    });

    const transferData = await transferResponse.json();
    console.log('[NAMTLS] Submit response:', JSON.stringify(transferData, null, 2));

    if (transferData.status !== 'success') {
      let errorMsg = transferData.message || 'Unknown Flutterwave error';
      if (transferData.data?.complete_message) errorMsg = transferData.data.complete_message;
      if (transferData.data?.note) errorMsg = transferData.data.note;
      await setDoc(recordRef, { status: 'failed', failedAt: new Date().toISOString() }, { merge: true });
      return res.status(400).json({
        success: false,
        message: `Flutterwave rejected: ${errorMsg}`,
        flutterwaveFullResponse: transferData
      });
    }

    const transferId = transferData.data?.id;
    if (!transferId) {
      await setDoc(recordRef, { status: 'submitted-no-id', submittedAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({
        success: true,
        unverified: true,
        message: `Flutterwave accepted (Ref: ${reference}) but no transfer ID returned. It will auto-confirm via webhook.`,
        reference: reference
      });
    }

    // ===== Record the pending state so webhook / check-transfer can finalize =====
    await setDoc(recordRef, { flutterwaveId: String(transferId), status: 'queued' }, { merge: true });
    await setDoc(balanceDoc, {
      pendingWithdrawal: {
        reference,
        flutterwaveId: String(transferId),
        amount: withdrawalAmount,
        status: 'queued',
        createdAt: new Date().toISOString()
      }
    }, { merge: true });

    // ===== Short poll (fast path only). Webhook + check-transfer handle the rest. =====
    let finalStatus = '';
    let finalData = null;
    let attempts = 0;
    const maxAttempts = 6; // ~18s, no longer blocks the request

    while (attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transfers/${transferId}`, {
          headers: { 'Authorization': `Bearer ${FLUTTERWAVE_SECRET}` }
        });
        const verifyData = await verifyResponse.json();
        finalData = verifyData;
        finalStatus = verifyData.data?.status || '';
        console.log(`[NAMTLS] Poll attempt ${attempts}/${maxAttempts}: status = ${finalStatus}`);

        if (finalStatus.toLowerCase() === 'successful') {
          // Finalize EXACTLY ONCE
          await runTransaction(db, async (tx) => {
            const cur = await tx.get(recordRef);
            if (cur.exists() && cur.data().status === 'successful') return;
            tx.set(recordRef, { status: 'successful', verifiedAt: new Date().toISOString() }, { merge: true });
            tx.set(balanceDoc, {
              balance: increment(-withdrawalAmount),
              totalWithdrawn: increment(withdrawalAmount),
              lastWithdrawalAt: new Date().toISOString(),
              lastWithdrawalRef: reference,
              pendingWithdrawal: null
            }, { merge: true });
          });

          return res.status(200).json({
            success: true,
            verified: true,
            message: `CONFIRMED: N${withdrawalAmount.toLocaleString()} sent to Opay ${accountNumber}! Ref: ${reference}`,
            reference: reference,
            flutterwaveId: transferId,
            status: 'successful'
          });
        }

        if (finalStatus.toLowerCase() === 'failed') {
          const failReason = finalData.data?.complete_message || finalData.data?.note || 'No reason provided';
          await setDoc(recordRef, { status: 'failed', failedAt: new Date().toISOString() }, { merge: true });
          await setDoc(balanceDoc, { pendingWithdrawal: null }, { merge: true });
          return res.status(400).json({
            success: false,
            message: `Transfer FAILED: ${failReason}`,
            flutterwaveFullResponse: finalData,
            reference: reference
          });
        }
      } catch (pollError) {
        console.log(`[NAMTLS] Poll error on attempt ${attempts}: ${pollError.message}`);
        continue;
      }
    }

    // ===== Still not confirmed -> return the reference so the app can keep checking =====
    const flutterwaveStatusUrl = `https://dashboard.flutterwave.com/transfers/${transferId}`;
    return res.status(200).json({
      success: true,
      unverified: true,
      message: `Transfer submitted and processing on Flutterwave (Ref: ${reference}). Confirming automatically...`,
      reference: reference,
      flutterwaveId: transferId,
      status: finalStatus || 'unknown',
      flutterwaveDashboardUrl: flutterwaveStatusUrl
    });

  } catch (e) {
    console.error('[NAMTLS] Server error:', e.message);
    return res.status(500).json({
      success: false,
      message: `Server Error: ${e.message}. Check function logs.`
    });
  }
}