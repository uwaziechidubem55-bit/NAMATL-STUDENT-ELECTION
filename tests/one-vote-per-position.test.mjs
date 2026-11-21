// ============================================================================
// ONE VOTE PER POSITION, and ONE WINNER PER POSITION.
//
// Tests for the REAL api/vote.js and src/utils/positions.js against an
// in-memory database (tests/helpers/fake-firestore.mjs). Nothing here touches
// the real Firestore.
//
// The position names below are typed exactly as on the live ballot of
// 21 Nov 2026 (capitals and trailing spaces included); the people are made up.
// Two offices were typed in two ways — "Asst. SECRETARY GENERAL " /
// "ASST. SECRETARY GENERAL " and "Asst. WELFARE DIRECTOR " /
// "ASST. WELFARE DIRECTOR " — so each was treated as two positions.
//
// Run:  node --import ./tests/helpers/register.mjs --test tests/one-vote-per-position.test.mjs
// ============================================================================
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getFakeFirestore } from './helpers/fake-firestore.mjs';

process.env.FIREBASE_SERVICE_ACCOUNT = '{}';
process.env.SERVER_SESSION_SECRET = 'test-session-secret';

const el = await import('../api/_election.js');
const server = await import('../api/_positions.js');
const pages = await import('../src/utils/positions.js');
const voteHandler = (await import('../api/vote.js')).default;

const db = getFakeFirestore();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function makeRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = () => res;
  return res;
}
async function post(body) {
  const res = makeRes();
  await voteHandler({ method: 'POST', query: {}, body, headers: { 'x-real-ip': '10.0.0.1' } }, res);
  return res;
}

const ADA = { name: 'Ada Obi', matric: 'CMOS/13875/2024', level: '300', uniqueKey: 'KEY-ADA-NAMATLEC', hasVoted: false };
const BEN = { name: 'Ben Eze', matric: 'CMOS/20001/2024', level: '200', uniqueKey: 'KEY-BEN-NAMATLEC', hasVoted: false };
const ADA_DOC = 'students/CMOS_13875_2024';
const BEN_DOC = 'students/CMOS_20001_2024';

// id -> [position exactly as typed, name]
const BALLOT = {
  pres:     ['PRESIDENT ', 'Pat President'],
  vp1:      ['VICE PRESIDENT 1', 'Vera One'],
  vp2:      ['VICE PRESIDENT 2', 'Victor Two'],
  asgSmall: ['Asst. SECRETARY GENERAL ', 'Sam Small'],
  asgBig:   ['ASST. SECRETARY GENERAL ', 'Sola Big'],
  fin:      ['FINANCIAL SECRETARY ', 'Femi Finance'],
  tres:     ['TREASURER ', 'Tina Treasurer'],
  soc:      ['DIRECTOR OF SOCIALS ', 'Dele Socials'],
  asoc:     ['ASST. DIRECTOR  OF SOCIALS ', 'Ada Socials'],
  spo:      ['DIRECTOR OF SPORTS ', 'Dan Sports'],
  aspo:     ['Asst. DIRECTOR OF SPORTS ', 'Aisha Sports'],
  pro:      ['PUBLIC RELATIONS OFFICER ', 'Paul Relations'],
  awSmall:  ['Asst. WELFARE DIRECTOR ', 'Wale Small'],
  awBig:    ['ASST. WELFARE DIRECTOR ', 'Wunmi Big'],
};
const LIVE_POSITIONS = Object.values(BALLOT).map(([position]) => position);
// One choice in every position: 12 offices, not 14.
const FULL_BALLOT = ['pres', 'vp1', 'vp2', 'asgBig', 'fin', 'tres', 'soc', 'asoc', 'spo', 'aspo', 'pro', 'awSmall'];

function seedElection() {
  db.seed(ADA_DOC, ADA);
  db.seed(BEN_DOC, BEN);
  for (const [id, [position, name]] of Object.entries(BALLOT)) db.seed(`candidates/${id}`, { name, position, votes: 0 });
  db.seed('settings/main', { activeMode: 'election', isActive: true });   // switched on, no dates -> live
}
const adaVotes = (candidateIds) => post({ matric: ADA.matric, uniqueKey: ADA.uniqueKey, candidateIds });
const benVotes = (candidateIds) => post({ matric: BEN.matric, uniqueKey: BEN.uniqueKey, candidateIds });
const votesOf = (id) => db.read(`candidates/${id}`).votes;
const totalVotes = () => db.list('candidates').reduce((sum, c) => sum + (c.votes || 0), 0);

// A refused ballot must leave no trace at all.
function assertNothingRecorded(studentDoc = ADA_DOC) {
  assert.equal(totalVotes(), 0, 'no candidate gained a vote');
  const s = db.read(studentDoc);
  assert.equal(s.hasVoted, false, 'the voter is not marked as voted');
  assert.equal(s.votedCandidateIds, undefined);
  assert.equal(db.list('auditLogs').filter((l) => l.action === 'VOTE_CAST').length, 0, 'no vote in the diary');
}
function assertRefusedForPosition(res) {
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'ONE_VOTE_PER_POSITION');
}

beforeEach(() => {
  db.reset();
  el.forgetElectionSettingsCache();
});

// ---------------------------------------------------------------------------
// 1. What counts as "the same position"
// ---------------------------------------------------------------------------
test('the same position typed in different ways is ONE position', () => {
  const same = [
    ['Asst. WELFARE DIRECTOR ', 'ASST. WELFARE DIRECTOR '],
    ['Asst. SECRETARY GENERAL ', 'ASST. SECRETARY GENERAL '],
    ['PRESIDENT ', 'President'],
    ['  president', 'PRESIDENT'],
    ['ASST. DIRECTOR  OF SOCIALS ', 'Asst Director of Socials'],
    ['VICE-PRESIDENT 1', 'Vice President 1'],
    ['P.R.O', 'PRO'],
    ['Director of Sports.', 'DIRECTOR OF SPORTS'],
  ];
  for (const [a, b] of same) assert.equal(pages.positionKey(a), pages.positionKey(b), `"${a}" and "${b}" are the same position`);
});

test('different offices stay different positions', () => {
  const different = [
    ['VICE PRESIDENT 1', 'VICE PRESIDENT 2'],
    ['DIRECTOR OF SOCIALS ', 'ASST. DIRECTOR  OF SOCIALS '],
    ['DIRECTOR OF SPORTS ', 'DIRECTOR OF SOCIALS '],
    ['DIRECTOR OF SPORTS ', 'Asst. DIRECTOR OF SPORTS '],
    ['TREASURER ', 'FINANCIAL SECRETARY '],
    ['PRESIDENT ', 'VICE PRESIDENT 1'],
    ['Asst. SECRETARY GENERAL ', 'Asst. WELFARE DIRECTOR '],
  ];
  for (const [a, b] of different) assert.notEqual(pages.positionKey(a), pages.positionKey(b), `"${a}" and "${b}" are different positions`);
});

test('the live ballot: 14 candidates are in 12 positions (it was counted as 14)', () => {
  assert.equal(new Set(LIVE_POSITIONS).size, 14, 'letter for letter there were 14 "positions"');
  assert.equal(new Set(LIVE_POSITIONS.map(pages.positionKey)).size, 12);
});

test('the pages and the vote endpoint use exactly the same rule', () => {
  const samples = [
    ...LIVE_POSITIONS,
    '', ' ', undefined, null, 0, 7, 'P.R.O', 'pro', 'Vice-President', 'VICE  PRESIDENT', 'Président', 'PRESIDENT\u00a0',
    'Senator (100L)', 'SENATOR 100 L', 'constructor', '__proto__', 'Welfare & Sports', '🏆 Captain', 'Ｐｒｅｓｉｄｅｎｔ',
  ];
  for (const sample of samples) {
    assert.equal(server.positionKey(sample), pages.positionKey(sample), `same answer for ${JSON.stringify(sample)}`);
  }
  assert.equal(pages.positionKey(undefined), '');
  assert.equal(pages.positionKey(null), '');
  assert.equal(pages.positionKey('   '), '');

  // ...and the rule itself is written the same way, word for word, in both files.
  const ruleIn = (file) => {
    const text = readFileSync(new URL(file, import.meta.url), 'utf8');
    const from = text.indexOf('const NOT_COUNTED');
    const to = text.indexOf('\n}\n', text.indexOf('export function positionKey'));
    assert.ok(from > 0 && to > from, `the rule is in ${file}`);
    return text.slice(from, to);
  };
  assert.equal(ruleIn('../api/_positions.js'), ruleIn('../src/utils/positions.js'));
});

test('the rule needs nothing newer than the rest of the site (old phones)', () => {
  const text = readFileSync(new URL('../src/utils/positions.js', import.meta.url), 'utf8');
  const code = text.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.ok(!/\\p\{/.test(code), 'no \\p{...} in a pattern');
  assert.ok(!/\/[a-z]*u[a-z]*[\s,;)]/.test(code.replace(/\/\/.*$/gm, '')), 'no "u" flag on a pattern');
});

// ---------------------------------------------------------------------------
// 2. The law on the portal: one candidate per position on a ballot
// ---------------------------------------------------------------------------
test('a normal ballot — one person in every position — is accepted and each gets exactly one vote', async () => {
  seedElection();
  const res = await adaVotes(FULL_BALLOT);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  for (const id of FULL_BALLOT) assert.equal(votesOf(id), 1, `${id} has one vote`);
  assert.equal(votesOf('asgSmall'), 0);
  assert.equal(votesOf('awBig'), 0);
  assert.equal(totalVotes(), 12);
  const s = db.read(ADA_DOC);
  assert.equal(s.hasVoted, true);
  assert.deepEqual(s.votedCandidateIds, FULL_BALLOT);
});

test('two different people for the same position are refused, and nothing is recorded', async () => {
  seedElection();
  db.seed('candidates/pres2', { name: 'Peter Second', position: 'PRESIDENT ', votes: 0 });
  const res = await adaVotes(['pres', 'pres2']);
  assertRefusedForPosition(res);
  assert.match(res.body.message, /only one candidate for PRESIDENT\./);
  assert.match(res.body.message, /refresh the page/i);
  assertNothingRecorded();
});

test('same position typed with different capitals (the live case) — voting for both is refused', async () => {
  seedElection();
  const welfare = await adaVotes(['pres', 'awSmall', 'awBig']);
  assertRefusedForPosition(welfare);
  assert.match(welfare.body.message, /WELFARE DIRECTOR/);
  assertNothingRecorded();

  const secretary = await adaVotes(['asgSmall', 'asgBig']);
  assertRefusedForPosition(secretary);
  assert.match(secretary.body.message, /SECRETARY GENERAL/);
  assertNothingRecorded();
});

test('same position typed with different spaces or dots — voting for both is refused', async () => {
  seedElection();
  db.seed('candidates/asoc2', { name: 'Bisi Socials', position: 'Asst Director of Socials', votes: 0 });
  assertRefusedForPosition(await adaVotes(['asoc', 'asoc2']));
  assertNothingRecorded();
});

test('the two people can be anywhere on the ballot, not only side by side', async () => {
  seedElection();
  const res = await adaVotes(['awSmall', 'pres', 'vp1', 'vp2', 'fin', 'tres', 'soc', 'asoc', 'spo', 'aspo', 'pro', 'asgBig', 'awBig']);
  assertRefusedForPosition(res);
  assertNothingRecorded();
});

test('the same person cannot be put on a ballot more than once', async () => {
  seedElection();
  for (const ids of [['pres', 'pres'], ['pres', 'vp1', 'pres'], ['pres', 'pres', 'pres', 'pres']]) {
    assertRefusedForPosition(await adaVotes(ids));
    assertNothingRecorded();
  }
});

test('VICE PRESIDENT 1 and VICE PRESIDENT 2 are two offices — voting in both is allowed', async () => {
  seedElection();
  const res = await adaVotes(['vp1', 'vp2']);
  assert.equal(res.statusCode, 200);
  assert.equal(votesOf('vp1'), 1);
  assert.equal(votesOf('vp2'), 1);
});

test('after a refused ballot the same voter can still vote properly — once', async () => {
  seedElection();
  assertRefusedForPosition(await adaVotes(['awSmall', 'awBig']));
  const ok = await adaVotes(['awBig']);
  assert.equal(ok.statusCode, 200);
  assert.equal(votesOf('awBig'), 1);
  assert.equal(votesOf('awSmall'), 0);

  // "Once they vote for A, they cannot vote for B too."
  const second = await adaVotes(['awSmall']);
  assert.equal(second.statusCode, 409);
  assert.equal(votesOf('awSmall'), 0);
  assert.equal(totalVotes(), 1);
});

test('two ballots from the same voter at the same moment: only one is counted', async () => {
  seedElection();
  const [a, b] = await Promise.all([adaVotes(['awSmall']), adaVotes(['awBig'])]);
  assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 409]);
  assert.equal(votesOf('awSmall') + votesOf('awBig'), 1, 'one vote in the position, not two');
  assert.equal(totalVotes(), 1);
});

test('the rule is per voter: two voters may choose different people for the same position', async () => {
  seedElection();
  assert.equal((await adaVotes(['awSmall'])).statusCode, 200);
  assert.equal((await benVotes(['awBig'])).statusCode, 200);
  assert.equal(votesOf('awSmall'), 1);
  assert.equal(votesOf('awBig'), 1);
});

test('a candidate who is no longer on the ballot: refused with a clear message, nothing recorded', async () => {
  seedElection();
  const res = await adaVotes(['pres', 'removed-candidate', 'tres']);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'CANDIDATE_NOT_FOUND');
  assert.match(res.body.message, /no longer on the ballot/);
  assertNothingRecorded();
});

test('a ballot that is not a list of candidates is refused, nothing recorded', async () => {
  seedElection();
  const bad = [
    ['pres', 42],
    ['pres', { id: 'tres' }],
    ['pres', ['tres']],
    ['pres/../tres'],
    ['..'],
    ['__name__'],
    ['x'.repeat(201)],
    Array.from({ length: 101 }, (_, i) => `candidate-${i}`),
  ];
  for (const ids of bad) {
    const res = await adaVotes(ids);
    assert.equal(res.statusCode, 400, `refused: ${JSON.stringify(ids).slice(0, 60)}`);
    assert.equal(res.body.code, 'INVALID_BALLOT');
    assertNothingRecorded();
  }
});

test('candidates saved without a position count as one position together', async () => {
  seedElection();
  db.seed('candidates/n1', { name: 'No Position One', votes: 0 });
  db.seed('candidates/n2', { name: 'No Position Two', position: '', votes: 0 });
  db.seed('candidates/n3', { name: 'No Position Three', position: '   ', votes: 0 });
  const res = await adaVotes(['n1', 'n3']);
  assertRefusedForPosition(res);
  assert.match(res.body.message, /only one candidate in each position/);
  assertNothingRecorded();
  assert.equal((await adaVotes(['n2', 'pres'])).statusCode, 200);
});

// ---------------------------------------------------------------------------
// 3. Everything that worked before still works the same way
// ---------------------------------------------------------------------------
test('the older single-candidate form of the request still works', async () => {
  seedElection();
  const res = await post({ matric: ADA.matric, uniqueKey: ADA.uniqueKey, candidateId: 'pres' });
  assert.equal(res.statusCode, 200);
  assert.equal(votesOf('pres'), 1);
});

test('the earlier checks still answer first, even for a ballot that breaks the rule', async () => {
  seedElection();
  const twoForOne = ['awSmall', 'awBig'];

  const wrongKey = await post({ matric: ADA.matric, uniqueKey: 'WRONG', candidateIds: twoForOne });
  assert.equal(wrongKey.statusCode, 401);

  const stranger = await post({ matric: 'CMOS/99999/2024', uniqueKey: 'X', candidateIds: twoForOne });
  assert.equal(stranger.statusCode, 404);

  const empty = await post({ matric: ADA.matric, uniqueKey: ADA.uniqueKey, candidateIds: [] });
  assert.equal(empty.statusCode, 400);
  assert.equal(empty.body.code, undefined, 'the old "selections are required" answer, unchanged');

  assert.equal((await adaVotes(['pres'])).statusCode, 200);
  assert.equal((await adaVotes(twoForOne)).statusCode, 409, 'already voted');

  db.seed('settings/main', { activeMode: 'none', isActive: false });
  el.forgetElectionSettingsCache();
  const closed = await benVotes(twoForOne);
  assert.equal(closed.statusCode, 403);
  assert.equal(closed.body.code, 'ELECTION_NOT_LIVE');
  assert.equal(totalVotes(), 1);
});

test('people who are not allowed to vote cannot use the check to look up candidates', async () => {
  seedElection();
  const before = db.reads;
  await post({ matric: ADA.matric, uniqueKey: 'WRONG', candidateIds: FULL_BALLOT });
  const wrongKeyReads = db.reads - before;
  assert.ok(wrongKeyReads <= 3, `a wrong code reads the settings and the student only (${wrongKeyReads} reads)`);
});

// ---------------------------------------------------------------------------
// 4. The ballot page: one section per position
// ---------------------------------------------------------------------------
const liveCandidates = () => Object.entries(BALLOT).map(([id, [position, name]]) => ({ id, name, position, votes: 0 }));

test('ballot: two people in one position are in ONE section, so only one can be picked', () => {
  const sections = pages.groupByPosition(liveCandidates());
  assert.equal(sections.length, 12);
  const secretary = sections.find((s) => s.candidates.some((c) => c.id === 'asgSmall'));
  assert.deepEqual(secretary.candidates.map((c) => c.id), ['asgSmall', 'asgBig']);
  const welfare = sections.find((s) => s.candidates.some((c) => c.id === 'awSmall'));
  assert.deepEqual(welfare.candidates.map((c) => c.id), ['awSmall', 'awBig']);
  assert.equal(new Set(sections.map((s) => s.key)).size, 12, 'every section has its own key');
  assert.equal(sections.reduce((n, s) => n + s.candidates.length, 0), 14, 'nobody is left off the ballot');
});

test('ballot: a ballot built from the sections is always accepted by the portal', async () => {
  seedElection();
  const sections = pages.groupByPosition(liveCandidates());
  const lastInEachSection = sections.map((s) => s.candidates[s.candidates.length - 1].id);
  const res = await adaVotes(lastInEachSection);
  assert.equal(res.statusCode, 200);
  assert.equal(totalVotes(), 12);
});

test('ballot: positions typed the same way look exactly as before', () => {
  const candidates = [
    { id: 'a', name: 'A', position: 'President' },
    { id: 'b', name: 'B', position: 'Secretary' },
    { id: 'c', name: 'C', position: 'President' },
  ];
  const sections = pages.groupByPosition(candidates);
  assert.deepEqual(sections.map((s) => s.label), ['President', 'Secretary']);
  assert.deepEqual(sections.map((s) => s.candidates.map((c) => c.id)), [['a', 'c'], ['b']]);
});

test('ballot: odd position names cannot break the page', () => {
  const sections = pages.groupByPosition([
    { id: 'a', position: 'constructor' }, { id: 'b', position: 'Constructor' },
    { id: 'c', position: '__proto__' }, { id: 'd', position: 'toString' }, { id: 'e' },
  ]);
  assert.deepEqual(sections.map((s) => s.candidates.map((c) => c.id)), [['a', 'b'], ['c'], ['d'], ['e']]);
  assert.deepEqual(pages.groupByPosition(undefined), []);
});

// ---------------------------------------------------------------------------
// 5. The Winners list on the result sheet: only the winner of each position
// ---------------------------------------------------------------------------
// Rows as the result sheet builds them: sorted by position, then by votes.
function sheetRows(votes) {
  return Object.entries(BALLOT)
    .map(([id, [position, name]]) => ({ name, position, votes: votes[id] || 0 }))
    .sort((a, b) => (a.position !== b.position ? a.position.localeCompare(b.position) : b.votes - a.votes));
}

test('winners: with two people in one position only the one who won is listed', () => {
  const rows = sheetRows({ pres: 9, vp1: 8, vp2: 7, asgSmall: 3, asgBig: 6, fin: 9, tres: 9, soc: 9, asoc: 9, spo: 9, aspo: 9, pro: 9, awSmall: 5, awBig: 4 });
  const winners = pages.winnersByPosition(rows);
  assert.equal(winners.length, 12, 'one line per position: 12, not 14');
  const names = winners.map((w) => w.winner);
  assert.ok(names.includes('Sola Big'), 'the Asst. Secretary General with more votes');
  assert.ok(!names.includes('Sam Small'), 'the one who lost is NOT in the winners list');
  assert.ok(names.includes('Wale Small'), 'the Asst. Welfare Director with more votes');
  assert.ok(!names.includes('Wunmi Big'), 'the one who lost is NOT in the winners list');
  assert.equal(winners.find((w) => w.winner === 'Sola Big').votes, 6);
  assert.equal(winners.find((w) => w.winner === 'Sola Big').position, 'ASST. SECRETARY GENERAL ');
  assert.equal(winners.find((w) => w.winner === 'Wale Small').votes, 5);
  // The two Vice Presidents are separate offices: both are winners.
  assert.ok(names.includes('Vera One') && names.includes('Victor Two'));
  assert.equal(new Set(winners.map((w) => w.key)).size, 12);
});

test('winners: a tie shows both names; a position with no votes shows "No votes"', () => {
  const rows = sheetRows({ pres: 2, asgSmall: 4, asgBig: 4 });
  const winners = pages.winnersByPosition(rows);
  const secretary = winners.find((w) => /SECRETARY GENERAL/.test(w.position));
  assert.match(secretary.winner, /^TIE — /);
  assert.ok(secretary.winner.includes('Sam Small') && secretary.winner.includes('Sola Big'));
  assert.equal(secretary.votes, 4);
  const welfare = winners.find((w) => /WELFARE DIRECTOR/.test(w.position));
  assert.deepEqual([welfare.winner, welfare.votes], ['No votes', 0]);
  assert.equal(winners.find((w) => w.position === 'PRESIDENT ').winner, 'Pat President');
});

test('winners: positions typed the same way give the same list as before', () => {
  const rows = [
    { name: 'Chidi Okeke', position: 'President', votes: 5 },
    { name: 'Ngozi Bello', position: 'President', votes: 3 },
    { name: 'Amaka Udo', position: 'Secretary', votes: 7 },
    { name: 'Bola Ade', position: 'Secretary', votes: 4 },
    { name: 'Lone Runner', position: '', votes: 1 },
  ];
  assert.deepEqual(
    pages.winnersByPosition(rows).map(({ position, winner, votes }) => ({ position, winner, votes })),
    [
      { position: 'President', winner: 'Chidi Okeke', votes: 5 },
      { position: 'Secretary', winner: 'Amaka Udo', votes: 7 },
      { position: 'Unassigned', winner: 'Lone Runner', votes: 1 },
    ],
  );
  assert.deepEqual(pages.winnersByPosition([]), []);
});
