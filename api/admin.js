// NAMATLS Admin API — server-side data operations for AdminDashboard.
// Requires the same admin JWT used by /api/verify-session.
import { getAdminDb } from './_admin.js';
import { verifyToken } from './_session.js';

const SECRET = process.env.SERVER_SESSION_SECRET || '';

function isAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const session = verifyToken(token, SECRET);
  return !!session && session.role === 'admin';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  if (!isAdmin(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { action, ...payload } = req.body || {};
  const db = getAdminDb();

  try {
    switch (action) {
      case 'listCandidates': {
        const snap = await db.collection('candidates').get();
        return res.json({ success: true, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }
      case 'saveCandidate': {
        const { id, data } = payload;
        if (id) await db.doc(`candidates/${id}`).set(data, { merge: true });
        else await db.collection('candidates').add(data);
        return res.json({ success: true });
      }
      case 'deleteCandidate': {
        if (!payload.id) return res.status(400).json({ success: false, message: 'id required' });
        await db.doc(`candidates/${payload.id}`).delete();
        return res.json({ success: true });
      }
      case 'getElectionSettings': {
        const snap = await db.doc('settings/election').get();
        return res.json({ success: true, data: snap.exists ? snap.data() : null });
      }
      case 'saveElectionSettings': {
        await db.doc('settings/election').set(payload.data, { merge: true });
        return res.json({ success: true });
      }
      case 'getFormPurchaseSettings': {
        const snap = await db.doc('settings/formPurchase').get();
        return res.json({ success: true, data: snap.exists ? snap.data() : null });
      }
      case 'saveFormPurchaseSettings': {
        await db.doc('settings/formPurchase').set(payload.data, { merge: true });
        return res.json({ success: true });
      }
      case 'listSupport': {
        const snap = await db.collection('supportMessages').orderBy('timestamp', 'desc').limit(200).get();
        return res.json({ success: true, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }
      case 'markSupportRead': {
        if (!payload.id) return res.status(400).json({ success: false, message: 'id required' });
        await db.doc(`supportMessages/${payload.id}`).update({ status: 'read' });
        return res.json({ success: true });
      }
      case 'deleteSupport': {
        if (!payload.id) return res.status(400).json({ success: false, message: 'id required' });
        await db.doc(`supportMessages/${payload.id}`).delete();
        return res.json({ success: true });
      }
      case 'listFormPurchases': {
        const snap = await db.collection('formPurchases').get();
        return res.json({ success: true, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }
      case 'getBalance': {
        const snap = await db.doc('finances/withdrawalBalance').get();
        return res.json({ success: true, data: snap.exists ? snap.data() : null });
      }
      case 'listStudents': {
        const snap = await db.collection('students').get();
        return res.json({ success: true, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }
      default:
        return res.status(400).json({ success: false, message: 'Unknown action: ' + action });
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}