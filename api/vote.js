// NAMATLS Vote — server-side: key check + one-vote enforcement + atomic increment.
import { getAdminDb } from './_admin.js';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { matric, uniqueKey, candidateId } = req.body || {};
  if (!matric || !uniqueKey || !candidateId) {
    return res.status(400).json({ success: false, message: 'matric, uniqueKey and candidateId are required' });
  }

  const db = getAdminDb();
  const docId = matric.trim().toUpperCase().replace(/\s+/g, '').replace(/\//g, '_');
  const sRef = db.doc(`students/${docId}`);
  const cRef = db.doc(`candidates/${candidateId}`);

  const studentSnap = await sRef.get();
  if (!studentSnap.exists) {
    return res.status(404).json({ success: false, message: 'Matric Number not registered.' });
  }
  if (studentSnap.data().uniqueKey !== uniqueKey.trim()) {
    return res.status(401).json({ success: false, message: 'Incorrect Unique Code. Access Denied' });
  }
  if (studentSnap.data().hasVoted) {
    return res.status(409).json({ success: false, message: 'You have already voted.' });
  }

  const candidateSnap = await cRef.get();
  if (!candidateSnap.exists) {
    return res.status(404).json({ success: false, message: 'Candidate not found.' });
  }

  try {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(sRef);
      if (fresh.exists && fresh.data().hasVoted) {
        throw new Error('ALREADY_VOTED');
      }
      tx.update(cRef, { votes: FieldValue.increment(1) });
      tx.update(sRef, { hasVoted: true });
    });
  } catch (e) {
    if (e.message === 'ALREADY_VOTED') {
      return res.status(409).json({ success: false, message: 'You have already voted.' });
    }
    throw e;
  }

  return res.status(200).json({ success: true, message: 'Vote recorded!' });
}