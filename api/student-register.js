// NAMATLS student registration — server-side, bypasses Firestore rules via firebase-admin.
import { getAdminDb } from './_admin.js';

function generateUniqueKey() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${timestamp}${random}-NAMATLEC`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { name, matric, level } = req.body || {};
  if (!name || !matric || !level) {
    return res.status(400).json({ success: false, message: 'name, matric and level are required' });
  }

  const normalized = matric.trim().toUpperCase().replace(/\s+/g, '');
  const docId = normalized.replace(/\//g, '_');
  const studentRef = getAdminDb().doc(`students/${docId}`);

  const existing = await studentRef.get();
  if (existing.exists) {
    return res.status(409).json({ success: false, message: 'Matric Number already registered. Please Login.' });
  }

  const uniqueKey = generateUniqueKey();
  await studentRef.set({
    name: name.trim(),
    matric: normalized,
    level: level.trim(),
    uniqueKey,
    hasVoted: false,
    createdAt: new Date().toISOString(),
  });

  return res.status(200).json({ success: true, uniqueKey });
}