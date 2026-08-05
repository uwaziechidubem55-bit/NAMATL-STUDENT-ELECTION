// NAMATLS Admin API — server-side data operations for AdminDashboard.
// Guarded with a high-level diagnostic log layer to force Vercel to report silent errors.

let getAdminDb, verifyToken;

try {
  // Capture dynamic module loading errors if Vercel is choking on file paths or extensions
  const adminModule = await import('./_admin.js');
  const sessionModule = await import('./_session.js');
  getAdminDb = adminModule.getAdminDb;
  verifyToken = sessionModule.verifyToken;
} catch (importError) {
  // If the import fails, this forces Vercel to print the exact missing file or module path
  console.error("❌ CRITICAL STARTUP ERROR: Failed to import underlying dependencies inside api/admin.js!");
  console.error("Stack trace:", importError.stack || importError.message || importError);
}

const SECRET = process.env.SERVER_SESSION_SECRET || '';

function isAdmin(req) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!verifyToken) {
      throw new Error("verifyToken helper function was never initialized successfully due to a prior import crash.");
    }
    const session = verifyToken(token, SECRET);
    return !!session && session.role === 'admin';
  } catch (authError) {
    console.error("❌ AUTHENTICATION PROCESS CRASHED:", authError.message);
    return false;
  }
}

const serializeTs = (ts) => {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  return ts;
};

export default async function handler(req, res) {
  // Log incoming requests immediately to see if the engine registers traffic
  console.log(`📡 [api/admin] Received execution request: ${req.method} | Action: ${req.body?.action || 'None'}`);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    if (!isAdmin(req)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { action, ...payload } = req.body || {};

    if (!getAdminDb) {
      throw new Error("getAdminDb initialization completely failed. Your Firebase instance could not boot up.");
    }
    const db = getAdminDb();

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
      case 'findStudentKey': {
        // ---- Validate inputs ----
        const name = (payload.name || '').toString().trim();
        const matric = (payload.matric || '').toString().trim().toUpperCase().replace(/\s+/g, '');
        if (!name || !matric) {
          return res.status(400).json({ success: false, message: 'Both name and matric are required' });
        }

        // ---- Locate the student doc (same normalization as api/student.js) ----
        // Matric is stored with '/' replaced by '_', e.g. FUPRE/2021/1234 -> FUPRE_2021_1234
        const docId = matric.replace(/\//g, '_');
        const snap = await db.doc(`students/${docId}`).get();
        if (!snap.exists) {
          return res.status(200).json({ success: false, message: 'Student not found. Check the name and matric number.' });
        }

        const student = snap.data();

        // ---- Soft name check (case-insensitive, tolerates name order) ----
        const storedName = (student.name || '').toString().trim().toLowerCase();
        const queryName = name.toLowerCase();
        const nameMatches =
          storedName === queryName ||
          storedName.includes(queryName) ||
          queryName.includes(storedName);
        if (!nameMatches) {
          return res.status(200).json({ success: false, message: 'Student not found. The name does not match this matric number.' });
        }

        // ---- Return the student (includes uniqueKey) ----
        return res.json({
          success: true,
          student: {
            ...student,
            id: snap.id,
            createdAt: serializeTs(student.createdAt)
          }
        });
      }
      default:
        return res.status(400).json({ success: false, message: 'Unknown action: ' + action });
    }
  } catch (runtimeError) {
    // This logs any raw operational failures directly back to Vercel's console output
    console.error("❌ RUNTIME FAILURE INSIDE EXECUTION HANDLER:", runtimeError.stack || runtimeError.message);
    return res.status(500).json({ success: false, message: runtimeError.message });
  }
}