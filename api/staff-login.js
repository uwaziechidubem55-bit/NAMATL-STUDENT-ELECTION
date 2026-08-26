// NAMATLS Staff Login API — password check against Vercel environment variable
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  // Read from Vercel environment variable — set STAFF_PASSWORD in Vercel dashboard
  const staffPassword = process.env.STAFF_PASSWORD || 'NAMATLSTAFF@FUPRE';

  if (password.trim() !== staffPassword) {
    return res.status(401).json({ success: false, message: 'Access Denied. Incorrect password.' });
  }

  // Generate a simple staff token
  const token = 'staff_' + Buffer.from(
    `staff:${Date.now()}:${Math.random().toString(36).substr(2, 16)}`
  ).toString('base64');

  return res.status(200).json({
    success: true,
    token,
    message: 'Access granted. Welcome!',
  });
}