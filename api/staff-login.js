// NAMATLS Staff Login API — password check against Vercel environment variable
import { getAdminDb } from './_admin.js';
import { writeAudit } from './_audit.js';

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
    await writeAudit({ getDb: getAdminDb, actor: 'staff', action: 'LOGIN_FAILED', details: { kind: 'staff' } });
    return res.status(401).json({ success: false, message: 'Access Denied. Incorrect password.' });
  }

  // Generate a simple staff token
  const token = 'staff_' + Buffer.from(
    `staff:${Date.now()}:${Math.random().toString(36).substr(2, 16)}`
  ).toString('base64');

  await writeAudit({ getDb: getAdminDb, actor: 'staff', action: 'STAFF_LOGIN', details: {} });

  return res.status(200).json({
    success: true,
    token,
    message: 'Access granted. Welcome!',
  });
}