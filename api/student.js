// NAMATLS Student API — login / register / verify-key in ONE function.
import { getAdminDb } from './_admin.js';

const normalizeMatric = (matric) => matric.trim().toUpperCase().replace(/\s+/g, '');
const toDocId = (matric) => normalizeMatric(matric).replace(/\//g, '_');

function generateUniqueKey() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${timestamp}${random}-NAMATLEC`;
}

async function login(req, res) {
  const { matric } = req.body || {};
  if (!matric) return res.status(400).json({ success: false, message: 'matric is required' });

  const snap = await getAdminDb().doc(`students/${toDocId(matric)}`).get();
  if (!snap.exists) {
    return res.status(404).json({ success: false, message: 'Matric Number not registered. Please sign up first.' });
  }
  const s = snap.data();
  return res.status(200).json({
    success: true,
    student: { name: s.name, matric: s.matric, level: s.level, hasVoted: !!s.hasVoted },
  });
}

async function register(req, res) {
  const { name, matric, level } = req.body || {};
  if (!name || !matric || !level) {
    return res.status(400).json({ success: false, message: 'name, matric and level are required' });
  }

  const normalized = normalizeMatric(matric);
  const docId = toDocId(matric);
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

async function verifyKey(req, res) {
  const { matric, uniqueKey } = req.body || {};
  if (!matric || !uniqueKey) {
    return res.status(400).json({ success: false, message: 'matric and uniqueKey are required' });
  }

  const snap = await getAdminDb().doc(`students/${toDocId(matric)}`).get();
  if (!snap.exists) {
    return res.status(404).json({ success: false, message: 'Matric Number not registered. Please sign up first.' });
  }
  if (snap.data().uniqueKey !== uniqueKey.trim()) {
    return res.status(401).json({ success: false, message: 'Incorrect Unique Code. Access Denied' });
  }
  return res.status(200).json({ success: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  const { action } = req.query; // set by vercel.json rewrites
  switch (action) {
    case 'login': return login(req, res);
    case 'register': return register(req, res);
    case 'verifyKey': return verifyKey(req, res);
    default:
      return res.status(400).json({ success: false, message: 'Unknown action: ' + action });
  }
}