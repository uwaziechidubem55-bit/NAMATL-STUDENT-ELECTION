// NAMATLS Vote — server-side: key check + one-vote enforcement + multi-position atomic increment.
import { getAdminDb } from './_admin.js';
import { writeAudit } from './_audit.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getElectionStatus } from './_election.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { matric, uniqueKey, candidateId, candidateIds } = req.body || {};

  // Support both multi-position array of candidateIds or single candidateId
  let voteIds = [];
  if (Array.isArray(candidateIds) && candidateIds.length > 0) {
    voteIds = candidateIds.filter(Boolean);
  } else if (candidateId) {
    voteIds = [candidateId];
  }

  if (!matric || !uniqueKey || voteIds.length === 0) {
    return res.status(400).json({ success: false, message: 'matric, uniqueKey and candidate selections are required' });
  }

  const db = getAdminDb();

  // The PORTAL's clock decides — not the phone's. No vote is accepted unless
  // the election is live right now on the server (see api/_election.js), so
  // changing a phone's time cannot open voting early or keep it open late.
  const election = await getElectionStatus(db);
  if (election.phase !== 'live') {
    const message = election.phase === 'ended'
      ? 'The election has ended. Voting is closed.'
      : election.phase === 'upcoming'
        ? 'Voting has not started yet.'
        : 'Voting is not open right now.';
    return res.status(403).json({ success: false, code: 'ELECTION_NOT_LIVE', phase: election.phase, message });
  }

  const docId = matric.trim().toUpperCase().replace(/\s+/g, '').replace(/\//g, '_');
  const sRef = db.doc(`students/${docId}`);

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

  try {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(sRef);
      if (fresh.exists && fresh.data().hasVoted) {
        throw new Error('ALREADY_VOTED');
      }

      // Atomically increment votes for each chosen position candidate
      for (const cid of voteIds) {
        const cRef = db.doc(`candidates/${cid}`);
        tx.update(cRef, { votes: FieldValue.increment(1) });
      }

      // Mark student as voted
      tx.update(sRef, {
        hasVoted: true,
        votedCandidateIds: voteIds,
        votedAt: new Date().toISOString()
      });
    });
  } catch (e) {
    if (e.message === 'ALREADY_VOTED') {
      return res.status(409).json({ success: false, message: 'You have already voted.' });
    }
    throw e;
  }

  const voter = studentSnap.data() || {};
  await writeAudit({ db, actor: docId, action: 'VOTE_CAST', details: { positions: voteIds.length, name: voter.name || '', level: voter.level || '' } });
  return res.status(200).json({ success: true, message: 'Votes recorded successfully!' });
}