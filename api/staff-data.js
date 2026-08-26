// NAMATLS Staff Data API — allows staff to read candidates & students without admin auth
import { getAdminDb } from './_admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  // Validate staff token
  if (!token || !token.startsWith('staff_') || token.length < 20) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Valid staff token required.' });
  }

  const { action } = req.body || {};

  if (!action) {
    return res.status(400).json({ success: false, message: 'Action is required' });
  }

  const db = getAdminDb();

  switch (action) {
    case 'listCandidates': {
      const snap = await db.collection('candidates').get();
      return res.json({ success: true, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    case 'listStudents': {
      const snap = await db.collection('students').get();
      return res.json({ success: true, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    default:
      return res.status(400).json({ success: false, message: 'Unknown action: ' + action });
  }
}