// NAMATLS Admin API — server-side data operations for AdminDashboard.
// Requires the same admin JWT used by /api/verify-session.
import { getAdminDb } from './_admin.js';
import { verifyToken } from './_session.js';

const SECRET = process.env.SERVER_SESSION_SECRET || '';

function isAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const session = verifyToken(token, SECRET); // (token, secret) — matches your _session.js
  return !!session && session.role === 'admin';
}

// Firestore Timestamps serialize to {_seconds,_nanoseconds} via JSON — convert to ISO strings for the client
const serializeTs = (ts) => {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  return ts;
};

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
      case 'getMainSettings': {
        const snap = await db.doc('settings/main').get();
        return res.json({ success: true, data: snap.exists ? snap.data() : null });
      }
      case 'saveMainSettings': {
        await db.doc('settings/main').set(payload.data, { merge: true });
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
        const items = snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...data, timestamp: serializeTs(data.timestamp) };
        });
        return res.json({ success: true, items });
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
        const items = snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...data, paidAt: serializeTs(data.paidAt) };
        });
        return res.json({ success: true, items });
      }
      case 'getBalance': {
        const snap = await db.doc('finances/withdrawalBalance').get();
        return res.json({ success: true, data: snap.exists ? snap.data() : null });
      }
      case 'listStudents': {
        const snap = await db.collection('students').get();
        return res.json({ success: true, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }
      case 'getResults': {
        const snap = await db.doc('electionData/results').get();
        return res.json({ success: true, data: snap.exists ? snap.data() : null });
      }
      case 'saveResults': {
        await db.doc('electionData/results').set(payload.data, { merge: true });
        return res.json({ success: true });
      }
      default:
        return res.status(400).json({ success: false, message: 'Unknown action: ' + action });
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}