// NAMATLS Audit Diary — the shared pen every API uses to record what happened.
// Lives in api/_audit.js. The leading underscore means Vercel does NOT count
// this file as a serverless function (Hobby plan: max 12 functions) — it is a
// free helper module, exactly like your existing _firebase.js / _session.js.
// Writes to the `auditLogs` collection. NEVER throws: auditing must not be
// able to break the main operation it is recording.

export async function writeAudit({ db, getDb, actor = 'system', action, details = {} }) {
  try {
    const database = db || (getDb ? getDb() : null);
    if (!database || !action) return;
    await database.collection('auditLogs').add({
      actor: String(actor).slice(0, 120),
      action: String(action).slice(0, 60),
      details,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('writeAudit skipped (never blocks main flow):', e.message);
  }
}
