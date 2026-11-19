// NAMATLS election clock — the ONE place that decides, with the PORTAL's own
// clock (this server), whether the election is coming, live or ended.
//
// Lives in api/_election.js. The leading underscore means Vercel does NOT count
// this file as a serverless function (Hobby plan: max 12 functions).
//
// Why it exists: the student page used to compare the dates with the PHONE's
// clock, so anyone who changed their phone time could open the ballot early or
// keep it open late. Now the phone only DISPLAYS what this file decides, and
// api/vote.js refuses any vote this file does not call "live".
//
// The rule is the same one the student page always used:
//   live = Election switched on in Activation
//          AND the start date/time has arrived (or none is set)
//          AND the end date/time has not passed (or none is set)
// The only differences: the clock is the server's, and the dates the admin
// types are read as Nigerian time wherever the server happens to run.

export const PORTAL_UTC_OFFSET_MIN = 60;               // Nigeria (WAT, UTC+1) — no daylight saving
export const ENDED_NOTICE_MS = 24 * 60 * 60 * 1000;    // "ELECTION HAS ENDED" stays up for 24 hours

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const has = (obj, key) => !!obj && obj[key] !== undefined && obj[key] !== null;

// "2026-11-20" + "10:30" as typed by the admin (Nigerian time) -> the real instant in ms.
// Returns null when no usable date was set.
export function parsePortalDateTime(dateStr, timeStr, fallbackTime = '00:00') {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(dateStr));
  if (!d) return null;
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text(timeStr)) || /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(fallbackTime);
  if (!t) return null;
  const ms = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]), Number(t[3] || 0))
    - PORTAL_UTC_OFFSET_MIN * 60 * 1000;
  return Number.isFinite(ms) ? ms : null;
}

const toMs = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const ms = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
};

// settings/main  = the Activation switch (+ a copy of the dates made when it was switched on)
// settings/election = what the admin saved on the "Election Settings" screen
// The dates on the Election Settings screen win, so a date changed after
// activation reaches students straight away. The switch itself is read exactly
// the way the student page always read it.
export function resolveElectionSettings(main, election) {
  const m = main || {};
  const e = election || {};
  const field = (key) => (has(e, key) ? text(e[key]) : text(m[key]));

  const mode = text(has(m, 'activeMode') ? m.activeMode : e.activeMode);
  const flag = has(m, 'isActive') ? m.isActive : e.isActive;
  const active = mode === 'election' || mode === 'both' || flag === true || flag === 'true';

  const startDate = field('startDate');
  const startTime = field('startTime');
  const endDate = field('endDate');
  const endTime = field('endTime');

  return {
    active,
    startDate, startTime, endDate, endTime,
    startAt: startDate ? parsePortalDateTime(startDate, startTime, '00:00') : null,
    endAt: endDate ? parsePortalDateTime(endDate, endTime, '23:59') : null,
    stoppedAt: toMs(m.electionEndedAt), // stamped by this server when the election is switched off
  };
}

// phase:
//   'live'     -> show the ballot, accept votes
//   'upcoming' -> "ELECTION IS COMING SOON" + countdown to startAt
//   'ended'    -> "ELECTION HAS ENDED" (for 24 hours after it ended)
//   'idle'     -> the plain "ELECTION IS COMING SOON" screen
export function computeElectionStatus(settings, nowMs = Date.now()) {
  const s = resolveElectionSettings(settings && settings.main, settings && settings.election);
  const started = s.startAt === null ? true : nowMs >= s.startAt;
  const pastEnd = s.endAt === null ? false : nowMs >= s.endAt;

  let phase = 'idle';
  let endedAt = null;

  if (s.active && started && !pastEnd) {
    phase = 'live';
  } else {
    if (s.active && started && pastEnd) endedAt = s.endAt;        // ran to its end time, nobody switched it off yet
    else if (!s.active && s.stoppedAt !== null) endedAt = s.stoppedAt; // switched off (by the admin or the auto-stop)

    if (endedAt !== null && nowMs >= endedAt && nowMs < endedAt + ENDED_NOTICE_MS) phase = 'ended';
    else if (s.startAt !== null && nowMs < s.startAt) phase = 'upcoming';
    else phase = 'idle';
  }

  return {
    phase,
    active: s.active,
    started,
    startAt: s.startAt,
    endAt: s.endAt,
    endedAt: phase === 'ended' ? endedAt : null,
    endedUntil: phase === 'ended' ? endedAt + ENDED_NOTICE_MS : null,
    startDate: s.startDate,
    startTime: s.startTime,
    endDate: s.endDate,
    endTime: s.endTime,
  };
}

// Called when settings/main is about to be saved. Works out whether that save
// switches the election OFF (stamp the moment it ended, on the server's clock)
// or ON (forget the previous ending). Returns the extra fields to save.
export function electionEndStampFor(prevMain, election, patch, nowMs = Date.now()) {
  const before = computeElectionStatus({ main: prevMain || {}, election }, nowMs);
  const after = computeElectionStatus({ main: { ...(prevMain || {}), ...(patch || {}) }, election }, nowMs);

  if (before.active && !after.active) {
    if (!before.started) return {}; // switched off before it ever began — nothing ended
    const endedAt = before.endAt !== null && before.endAt < nowMs ? before.endAt : nowMs;
    return { electionEndedAt: new Date(endedAt).toISOString() };
  }
  if (!before.active && after.active) return { electionEndedAt: null }; // a new run starts clean
  return {};
}

// ---- reading the two settings documents ----
// maxAgeMs lets the public status check reuse a recent read (many phones ask
// every minute). Votes always pass 0 and read fresh.
let cache = { at: 0, value: null };

export async function readElectionSettings(db, { maxAgeMs = 0 } = {}) {
  const now = Date.now();
  if (maxAgeMs > 0 && cache.value && now - cache.at < maxAgeMs) return cache.value;
  const [mainSnap, electionSnap] = await Promise.all([
    db.doc('settings/main').get(),
    db.doc('settings/election').get(),
  ]);
  const value = {
    main: mainSnap.exists ? (mainSnap.data() || {}) : {},
    election: electionSnap.exists ? (electionSnap.data() || {}) : {},
  };
  cache = { at: now, value };
  return value;
}

export function forgetElectionSettingsCache() {
  cache = { at: 0, value: null };
}

export async function getElectionStatus(db, options = {}) {
  const settings = await readElectionSettings(db, options);
  const serverNow = Date.now();
  return { serverNow, ...computeElectionStatus(settings, serverNow) };
}
