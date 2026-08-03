// NAMATLS student login — looks up the student, never returns the stored key.
import { getAdminDb } from './_admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { matric } = req.body || {};
  if (!matric) return res.status(400).json({ success: false, message: 'matric is required' });

  const docId = matric.trim().toUpperCase().replace(/\s+/g, '').replace(/\//g, '_');
  const snap = await getAdminDb().doc(`students/${docId}`).get();

  if (!snap.exists) {
    return res.status(404).json({ success: false, message: 'Matric Number not registered. Please sign up first.' });
  }

  const s = snap.data();
  return res.status(200).json({
    success: true,
    student: { name: s.name, matric: s.matric, level: s.level, hasVoted: !!s.hasVoted },
  });
}