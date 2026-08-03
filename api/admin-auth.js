// NAMATLS Admin auth — login + session verification in ONE function.
import { signToken, verifyToken } from './_session.js';

const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

async function login(req, res) {
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

async function verify(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!process.env.SERVER_SESSION_SECRET) {
    return res.status(500).json({ success: false, message: 'Server session secret not configured.' });
  }

  const session = verifyToken(token, process.env.SERVER_SESSION_SECRET);
  if (!session || session.role !== 'admin') {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
  return res.status(200).json({ success: true, role: session.role });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const { action } = req.query; // set by vercel.json rewrites
  switch (action) {
    case 'login': return login(req, res);
    case 'verify': return verify(req, res);
    default:
      return res.status(400).json({ success: false, message: 'Unknown action: ' + action });
  }
}