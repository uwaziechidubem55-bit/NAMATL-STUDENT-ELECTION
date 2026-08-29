// NAMATLS Admin API — server-side data operations for AdminDashboard.
// Guarded with a high-level diagnostic log layer to force Vercel to report silent errors.
import { createHash } from 'crypto';
import { writeAudit } from './_audit.js';

let getAdminDb, verifyToken, signToken;

try {
  // Capture dynamic module loading errors if Vercel is choking on file paths or extensions
  const adminModule = await import('./_admin.js');
  const sessionModule = await import('./_session.js');
  getAdminDb = adminModule.getAdminDb;
  verifyToken = sessionModule.verifyToken;
  signToken = sessionModule.signToken;
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

// ===================== SUPER ADMIN HELPERS (control room) =====================
// Two locks, one door: EVERY /api/admin call still needs a valid ADMIN session
// (isAdmin below). The super-admin-only actions additionally require a valid
// SUPER session token sent in the 'x-super-token' header (isSuper here).
// No new serverless functions are created — the Vercel Hobby 12-function
// limit is respected by adding actions instead of files.

function isSuper(req) {
  try {
    const token = req.headers['x-super-token'] || '';
    const session = verifyToken(token, process.env.SERVER_SESSION_SECRET || '');
    return !!session && session.role === 'super';
  } catch (e) {
    return false;
  }
}

// The super admin code is never stored as plain text — only this hash
// (code + server secret, SHA-256), the same way passwords should live.
function hashCode(code) {
  return createHash('sha256').update(String(code) + ':' + (process.env.SERVER_SESSION_SECRET || '')).digest('hex');
}

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

      // ================================================================
      // SUPER ADMIN (control room) — price book, code safe, live stats.
      // ================================================================
      case 'getActivationPricing': {
        const snap = await db.doc('settings/activationPricing').get();
        if (!snap.exists) {
          // Old fixed behaviour until the super admin saves a price book:
          return res.json({ success: true, pricing: { maintenance: 0, siteUpdate: 0, databaseUpgrading: 0, total: 25000, freeYears: ['2026/2027'], usingFallback: true } });
        }
        const d = snap.data();
        const maintenance = Number(d.maintenance) || 0;
        const siteUpdate = Number(d.siteUpdate) || 0;
        const databaseUpgrading = Number(d.databaseUpgrading) || 0;
        return res.json({
          success: true,
          pricing: {
            maintenance, siteUpdate, databaseUpgrading,
            total: maintenance + siteUpdate + databaseUpgrading,
            freeYears: Array.isArray(d.freeYears) ? d.freeYears : [],
            usingFallback: false,
          },
        });
      }
      case 'saveActivationPricing': {
        if (!isSuper(req)) return res.status(403).json({ success: false, message: 'Super admin session required' });
        const maintenance = Number(payload.maintenance);
        const siteUpdate = Number(payload.siteUpdate);
        const databaseUpgrading = Number(payload.databaseUpgrading);
        if (![maintenance, siteUpdate, databaseUpgrading].every(n => Number.isFinite(n) && n >= 0)) {
          return res.status(400).json({ success: false, message: 'maintenance, siteUpdate and databaseUpgrading must be numbers (0 or more)' });
        }
        const freeYears = Array.isArray(payload.freeYears)
          ? payload.freeYears.map(y => String(y).trim()).filter(Boolean)
          : [];
        const total = maintenance + siteUpdate + databaseUpgrading;
        await db.doc('settings/activationPricing').set({
          maintenance, siteUpdate, databaseUpgrading, freeYears, total,
          updatedAt: new Date().toISOString(), updatedBy: 'super-admin',
        }, { merge: true });
        await writeAudit({ db, actor: 'super-admin', action: 'PRICING_SAVED', details: { maintenance, siteUpdate, databaseUpgrading, total, freeYears } });
        return res.json({ success: true, pricing: { maintenance, siteUpdate, databaseUpgrading, total, freeYears } });
      }
      case 'setSuperAdminCode': {
        const newCode = String(payload.newCode || '').trim();
        if (newCode.length < 6) {
          return res.status(400).json({ success: false, message: 'Code must be at least 6 characters' });
        }
        await db.doc('superAdmin/settings').set({
          codeHash: hashCode(newCode),
          failedAttempts: 0,
          lockUntil: null,
          updatedAt: new Date().toISOString(),
          updatedBy: 'admin',
        }, { merge: true });
        await writeAudit({ db, actor: 'admin', action: 'SUPER_CODE_CHANGED', details: {} });
        return res.json({ success: true, message: 'Super admin login code saved. The old code (if any) no longer works.' });
      }
      case 'superLogin': {
        const { code } = payload;
        if (!code) return res.status(400).json({ success: false, message: 'Super admin code is required' });
        if (!process.env.SERVER_SESSION_SECRET || !signToken) {
          return res.status(500).json({ success: false, message: 'Server session secret not configured.' });
        }
        const snap = await db.doc('superAdmin/settings').get();
        const data = snap.exists ? snap.data() : null;
        if (!data || !data.codeHash) {
          return res.status(404).json({ success: false, message: 'No super admin code set yet. Set it from the Admin Dashboard first.' });
        }
        if (data.lockUntil && Date.now() < Number(data.lockUntil)) {
          const mins = Math.ceil((Number(data.lockUntil) - Date.now()) / 60000);
          return res.status(423).json({ success: false, message: `Too many wrong attempts. Locked for ${mins} more minute(s).` });
        }
        if (hashCode(code) !== data.codeHash) {
          const attempts = (Number(data.failedAttempts) || 0) + 1;
          const lock = attempts >= 5 ? Date.now() + 30 * 60 * 1000 : null;
          await db.doc('superAdmin/settings').set({ failedAttempts: attempts, ...(lock ? { lockUntil: lock } : {}) }, { merge: true });
          await writeAudit({ db, actor: 'admin', action: 'SUPER_LOGIN_FAILED', details: { attempt: attempts } });
          const left = 5 - attempts;
          return res.status(401).json({ success: false, message: left > 0 ? `Wrong code. ${left} attempt(s) left before lockout.` : 'Wrong code. Locked for 30 minutes.' });
        }
        await db.doc('superAdmin/settings').set({ failedAttempts: 0, lockUntil: null }, { merge: true });
        const now = Math.floor(Date.now() / 1000);
        const superToken = signToken({ role: 'super', iat: now, exp: now + 7200 }, process.env.SERVER_SESSION_SECRET);
        await writeAudit({ db, actor: 'admin', action: 'SUPER_LOGIN', details: {} });
        return res.json({ success: true, superToken, expiresIn: 7200 });
      }
      case 'superVerify': {
        if (!isSuper(req)) return res.status(403).json({ success: false, message: 'Super admin session required' });
        return res.json({ success: true, role: 'super' });
      }
      case 'superStats': {
        if (!isSuper(req)) return res.status(403).json({ success: false, message: 'Super admin session required' });
        const now = Date.now();
        const twoMinAgo = new Date(now - 2 * 60 * 1000).toISOString();
        const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
        const dayStartIso = dayStart.toISOString();

        const [presenceSnap, studentsSnap, candidatesSnap, auditSnap, receiptsSnap, balanceSnap, activationsSnap, mainSnap] = await Promise.all([
          db.collection('presence').get(),
          db.collection('students').get(),
          db.collection('candidates').get(),
          db.collection('auditLogs').orderBy('at', 'desc').limit(100).get(),
          db.collection('paymentReceipts').limit(50).get(),
          db.doc('finances/withdrawalBalance').get(),
          db.doc('finances/activations').get(),
          db.doc('settings/main').get(),
        ]);

        // ---- presence: online = seen in the last 2 minutes ----
        const byPage = {};
        const online = [];
        const staleRefs = [];
        presenceSnap.docs.forEach(d => {
          const p = d.data();
          if (p.lastSeen && p.lastSeen >= twoMinAgo) {
            byPage[p.page || 'unknown'] = (byPage[p.page || 'unknown'] || 0) + 1;
            online.push({ id: d.id, page: p.page || 'unknown', role: p.role || 'visitor', lastSeen: p.lastSeen });
          } else if (!p.lastSeen || now - Date.parse(p.lastSeen || 0) > 60 * 60 * 1000) {
            staleRefs.push(d.ref);
          }
        });
        // Silent housekeeping: forget visitors gone for over an hour.
        staleRefs.slice(0, 50).forEach(r => { r.delete().catch(() => {}); });

        // ---- people ----
        let totalStudents = 0, voted = 0;
        studentsSnap.docs.forEach(d => { totalStudents += 1; if (d.data().hasVoted) voted += 1; });

        // ---- election ----
        const byPosition = {};
        candidatesSnap.docs.forEach(d => {
          const c = d.data();
          const pos = c.position || 'Unassigned';
          if (!byPosition[pos]) byPosition[pos] = [];
          byPosition[pos].push({ id: d.id, name: c.name || '—', votes: Number(c.votes) || 0 });
        });
        Object.values(byPosition).forEach(arr => arr.sort((a, b) => b.votes - a.votes));

        // ---- money ----
        const receipts = receiptsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const paymentsToday = receipts.filter(r => (r.creditedAt || '') >= dayStartIso);
        const paymentsTodaySum = paymentsToday.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        const balance = balanceSnap.exists ? (Number(balanceSnap.data().balance) || 0) : 0;
        const totalReceived = balanceSnap.exists ? (Number(balanceSnap.data().totalReceived) || 0) : 0;
        const activations = activationsSnap.exists ? activationsSnap.data() : {};

        // ---- diary ----
        const audit = auditSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const todayAudit = audit.filter(a => (a.at || '') >= dayStartIso);
        const loginsToday = todayAudit.filter(a => String(a.action).endsWith('LOGIN')).length;
        const failedLogins = todayAudit.filter(a => a.action === 'LOGIN_FAILED' || a.action === 'SUPER_LOGIN_FAILED').length;
        const votesToday = todayAudit.filter(a => a.action === 'VOTE_CAST').length;
        const registrationsToday = todayAudit.filter(a => a.action === 'STUDENT_REGISTER').length;

        return res.json({
          success: true,
          stats: {
            serverTime: new Date().toISOString(),
            online: { count: online.length, byPage, list: online },
            people: { totalStudents, voted, registrationsToday, loginsToday, failedLogins },
            election: { byPosition, votesToday, activeMode: mainSnap.exists ? (mainSnap.data().activeMode || 'none') : 'none' },
            money: { balance, totalReceived, paymentsToday: paymentsToday.length, paymentsTodaySum, activations, receipts },
            audit,
          },
        });
      }
      case 'superAuditFeed': {
        if (!isSuper(req)) return res.status(403).json({ success: false, message: 'Super admin session required' });
        const limit = Math.min(Number(payload.limit) || 200, 500);
        const snap = await db.collection('auditLogs').orderBy('at', 'desc').limit(limit).get();
        return res.json({ success: true, items: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
      }
      case 'superCleanupPresence': {
        if (!isSuper(req)) return res.status(403).json({ success: false, message: 'Super admin session required' });
        const snap = await db.collection('presence').get();
        const now = Date.now();
        let removed = 0;
        const stale = snap.docs.filter(d => {
          const p = d.data();
          return !p.lastSeen || now - Date.parse(p.lastSeen) > 10 * 60 * 1000;
        });
        await Promise.all(stale.map(d => d.ref.delete().then(() => { removed += 1; }).catch(() => {})));
        return res.json({ success: true, removed });
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