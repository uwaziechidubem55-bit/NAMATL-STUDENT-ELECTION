// NAMTLS Withdrawal API v3.1 - Waits For Flutterwave Real Status
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { amount, accountNumber, narration } = req.body;

    if (!amount || !accountNumber) {
      return res.status(400).json({ success: false, message: 'Amount and account number are required' });
    }

    const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;

    if (!FLUTTERWAVE_SECRET) {
      return res.status(500).json({ success: false, message: 'FLUTTERWAVE_SECRET_KEY not set in Vercel environment variables.' });
    }

    if (Number(amount) < 100) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal is 100' });
    }

    if (Number(amount) > 1000000) {
      return res.status(400).json({ success: false, message: 'Maximum withdrawal is 1,000,000' });
    }

    const OPAY_BANK_CODE = '100004';
    const reference = `NAMTLS-WD-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    console.log(`[NAMTLS] Initiating transfer: $${amount} to ${accountNumber}`);

    // STEP 1: Submit transfer to Flutterwave
    const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLUTTERWAVE_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_bank: OPAY_BANK_CODE,
        account_number: accountNumber.toString(),
        amount: Number(amount),
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
      return res.status(400).json({ success: false, message: `Flutterwave rejected the transfer: ${errorMsg}`, flutterwaveFullResponse: transferData });
    }

    const transferId = transferData.data?.id;
    if (!transferId) {
      return res.status(200).json({
        success: true,
        unverified: true,
        message: `Flutterwave accepted (Ref: ${reference}) but no transfer ID returned. Check Flutterwave dashboard.`,
        reference: reference
      });
    }

    // STEP 2: Poll for final status (up to 30 seconds)
    let finalStatus = '';
    let finalData = null;
    let attempts = 0;
    const maxAttempts = 10;

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

        if (finalStatus === 'successful') {
          return res.status(200).json({
            success: true,
            verified: true,
            message: `CONFIRMED: $${Number(amount).toLocaleString()} successfully sent to Opay ${accountNumber}! Ref: ${reference}`,
            reference: reference,
            flutterwaveId: transferId,
            status: 'successful'
          });
        }

        if (finalStatus === 'failed') {
          const failReason = finalData.data?.complete_message || finalData.data?.note || 'No reason provided';
          return res.status(400).json({
            success: false,
            message: `Transfer FAILED: ${failReason}`,
            flutterwaveFullResponse: finalData,
            reference: reference
          });
        }

        if (finalStatus === 'pending' || finalStatus === 'processing' || finalStatus === 'queued') {
          continue;
        }

        break;
      } catch (pollError) {
        console.log(`[NAMTLS] Poll error on attempt ${attempts}: ${pollError.message}`);
        continue;
      }
    }

    const flutterwaveStatusUrl = `https://dashboard.flutterwave.com/transfers/${transferId}`;
    return res.status(200).json({
      success: true,
      unverified: true,
      message: `Flutterwave ACCEPTED the transfer (Ref: ${reference}) but after ${maxAttempts * 3}s the status is still "${finalStatus || 'unknown'}". Check: ${flutterwaveStatusUrl}`,
      reference: reference,
      flutterwaveId: transferId,
      status: finalStatus || 'unknown',
      flutterwaveDashboardUrl: flutterwaveStatusUrl
    });

  } catch (e) {
    console.error('[NAMTLS] Server error:', e.message);
    return res.status(500).json({
      success: false,
      message: `Server Error: ${e.message}. Check Vercel function logs.`
    });
  }
}