// NAMATLS key verification — compares against the server copy.
import { getAdminDb } from './_admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { matric, uniqueKey } = req.body || {};
  if (!matric || !uniqueKey) {
    return res.status(400).json({ success: false, message: 'matric and uniqueKey are required' });
  }

  const docId = matric.trim().toUpperCase().replace(/\s+/g, '').replace(/\//g, '_');
  const snap = await getAdminDb().doc(`students/${docId}`).get();

  if (!snap.exists) {
    return res.status(404).json({ success: false, message: 'Matric Number not registered. Please sign up first.' });
  }

  if (snap.data().uniqueKey !== uniqueKey.trim()) {
    return res.status(401).json({ success: false, message: 'Incorrect Unique Code. Access Denied' });
  }

  return res.status(200).json({ success: true });
}