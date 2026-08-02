// NAMATLS Admin Login v2 — issues a signed session token
import { signToken } from './_session.js';

// constant-time string comparison (avoid timing side-channels)
const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) {
    return res.status(500).json({ success: false, message: 'Admin credentials not configured on server.' });
  }

  if (!safeEqual(String(username), expectedUser) || !safeEqual(String(password), expectedPass)) {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }

  if (!process.env.SERVER_SESSION_SECRET) {
    return res.status(500).json({ success: false, message: 'Server session secret not configured.' });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signToken({ role: 'admin', iat: now, exp: now + 3600 }, process.env.SERVER_SESSION_SECRET);

  return res.status(200).json({ success: true, token, expiresIn: 3600 });
}