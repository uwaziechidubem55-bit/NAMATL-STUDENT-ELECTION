// ============================================================================
// NAMATLS rate limiter — a small Firestore counter that protects the PUBLIC
// bank-transfer endpoints (proof submit / screenshot upload / status lookup)
// from spam and from people guessing other students' references.
//
// The leading underscore means Vercel does NOT count this file as a serverless
// function (Hobby plan: max 12 functions) — it is a helper module, exactly like
// _audit.js / _session.js.
//
// It NEVER throws and it FAILS OPEN: if Firestore cannot be reached the request
// is let through, so a real student is never blocked by a counter problem.
// ============================================================================
import { createHash } from 'crypto';

/** The visitor's public IP as Vercel reports it (Vercel overwrites these headers). */
export function clientIp(req) {
  const headers = (req && req.headers) || {};
  const real = String(headers['x-real-ip'] || '').trim();
  const forwarded = String(headers['x-forwarded-for'] || '').split(',')[0].trim();
  return real || forwarded || String(req?.socket?.remoteAddress || '') || 'unknown';
}

// The IP is never stored in plain text — only a salted hash is used as the key.
function bucketRef(db, scope, who, windowSec) {
  const salt = process.env.SERVER_SESSION_SECRET || '';
  const hash = createHash('sha256').update(`${scope}|${who}|${salt}`).digest('hex').slice(0, 32);
  return db.doc(`rateLimits/${scope}_${windowSec}_${hash}`);
}

function readBucket(snap, rule, now) {
  const windowMs = rule.windowSec * 1000;
  const data = snap.exists ? snap.data() : null;
  const fresh = !data || now - Number(data.windowStart || 0) >= windowMs;
  const windowStart = fresh ? now : Number(data.windowStart);
  const count = fresh ? 0 : Number(data.count) || 0;
  return { windowMs, windowStart, count };
}

/**
 * Records ONE hit against every rule and says whether it is still allowed.
 * @param {object} db    Firestore (admin)
 * @param {object} opts
 * @param {string} opts.scope  name of the thing being limited, e.g. 'mp-submit'
 * @param {string} opts.who    who is being limited (the visitor's IP)
 * @param {{limit:number, windowSec:number}[]} opts.rules
 * @returns {Promise<{ok:boolean, retryAfterSec?:number, degraded?:boolean}>}
 */
export async function consumeRateLimit(db, { scope, who, rules }) {
  try {
    const now = Date.now();
    const refs = rules.map(rule => bucketRef(db, scope, who, rule.windowSec));
    return await db.runTransaction(async (tx) => {
      const snaps = [];
      for (const ref of refs) snaps.push(await tx.get(ref));

      const next = [];
      for (let i = 0; i < rules.length; i++) {
        const { windowMs, windowStart, count } = readBucket(snaps[i], rules[i], now);
        if (count >= rules[i].limit) {
          return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)) };
        }
        next.push({ scope, windowStart, count: count + 1, expiresAt: new Date(windowStart + windowMs) });
      }
      refs.forEach((ref, i) => tx.set(ref, next[i]));
      return { ok: true };
    });
  } catch (e) {
    console.error('rate limit skipped (fails open):', e.message);
    return { ok: true, degraded: true };
  }
}

/** Same question as consumeRateLimit but WITHOUT recording a hit (read only). */
export async function peekRateLimit(db, { scope, who, rules }) {
  try {
    const now = Date.now();
    for (const rule of rules) {
      const snap = await bucketRef(db, scope, who, rule.windowSec).get();
      const { windowMs, windowStart, count } = readBucket(snap, rule, now);
      if (count >= rule.limit) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)) };
      }
    }
    return { ok: true };
  } catch (e) {
    console.error('rate limit check skipped (fails open):', e.message);
    return { ok: true, degraded: true };
  }
}

/** "about 4 minutes" — for the message shown to the visitor. */
export function waitText(retryAfterSec) {
  const sec = Number(retryAfterSec) || 60;
  if (sec < 90) return 'about a minute';
  if (sec < 3600) return `about ${Math.ceil(sec / 60)} minutes`;
  return `about ${Math.ceil(sec / 3600)} hour(s)`;
}
