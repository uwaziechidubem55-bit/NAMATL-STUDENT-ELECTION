export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Use POST' });
  }

  const { transaction_id, academicYear } = req.body;

  if (!transaction_id || !academicYear) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  try {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ success: false, message: 'FLUTTERWAVE_SECRET_KEY not set in Vercel env vars' });
    }

    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (data.status === 'success' && data.data && data.data.status === 'successful') {
      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully'
      });
    }

    return res.status(400).json({
      success: false,
      message: data.message || 'Transaction not successful'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}