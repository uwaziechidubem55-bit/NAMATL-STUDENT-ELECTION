// Admin login API — credentials live ONLY in server env vars (never in the client bundle)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Use POST' });
  }

  const { username, password } = req.body || {};

  const adminUser = process.env.ADMIN_USERNAME || '';
  const adminPass = process.env.ADMIN_PASSWORD || '';

  if (!adminUser || !adminPass) {
    // Fail closed: refuse logins until the server env vars are set
    return res.status(500).json({ success: false, message: 'Admin credentials not configured on server' });
  }

  if (username !== adminUser || password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Invalid Credentials. Ask admin for password.' });
  }

  return res.status(200).json({ success: true });
}