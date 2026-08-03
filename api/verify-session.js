// NAMATLS session verification — called by ProtectedRoute
import { verifyToken } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

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
