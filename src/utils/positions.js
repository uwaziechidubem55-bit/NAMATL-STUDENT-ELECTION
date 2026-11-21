// ============================================================================
// One rule for "are these the same position?" — for the pages.
//
// The position is typed by hand for every candidate, so one office can be saved
// as "Asst. WELFARE DIRECTOR " for one person and "ASST. WELFARE DIRECTOR" for
// another. Only the letters and the numbers count; capital or small letters,
// spaces, dots and dashes are ignored:
//   "Asst. WELFARE DIRECTOR "  ==  "ASST. WELFARE DIRECTOR"
//   "VICE PRESIDENT 1"         !=  "VICE PRESIDENT 2"
//
// The vote endpoint uses the same rule from api/_positions.js. The two copies
// must stay identical — tests/one-vote-per-position.test.mjs fails if they differ.
// ============================================================================
// Not counted: spaces, ordinary punctuation and symbols, the accents that
// normalize('NFKD') splits off a letter, and the long dashes / curly quotes /
// invisible spaces that arrive with copy and paste. Letters and numbers of any
// language are kept. (Plain ranges on purpose — this must run on old phones.)
const NOT_COUNTED = /[\s\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e\u00a1-\u00bf\u0300-\u036f\u2000-\u206f]+/g;

export function positionKey(position) {
  return String(position == null ? '' : position)
    .normalize('NFKD')
    .toLowerCase()
    .replace(NOT_COUNTED, '');
}

// The ballot: candidates put into one section per position, so a voter picks
// one person per position. Sections come in the order the positions first
// appear. `label` is the position as typed on the first candidate of the section.
export function groupByPosition(candidates) {
  const sections = [];
  const index = new Map();
  (candidates || []).forEach((c) => {
    const key = 'pos:' + positionKey(c.position);
    if (!index.has(key)) {
      index.set(key, sections.length);
      sections.push({ key, label: String(c.position), candidates: [] });
    }
    sections[index.get(key)].candidates.push(c);
  });
  return sections;
}

// The Winners list on the result sheet: one line per position, holding only the
// candidate with the most votes — nobody who lost. Equal top votes show as a
// tie; a position nobody voted in shows "No votes". Lines come in the order the
// positions first appear in `rows` ([{ name, position, votes }]).
export function winnersByPosition(rows) {
  const groups = [];
  const index = new Map();
  (rows || []).forEach((r) => {
    const key = 'pos:' + positionKey(r.position);
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ key, rows: [] });
    }
    groups[index.get(key)].rows.push(r);
  });
  return groups.map((g) => {
    const top = Math.max(...g.rows.map((r) => Number(r.votes) || 0));
    const leaders = g.rows.filter((r) => (Number(r.votes) || 0) === top);
    if (top <= 0) return { key: g.key, position: g.rows[0].position || 'Unassigned', winner: 'No votes', votes: 0 };
    const position = leaders[0].position || 'Unassigned';
    if (leaders.length > 1) return { key: g.key, position, winner: 'TIE — ' + leaders.map((r) => r.name).join(' / '), votes: top };
    return { key: g.key, position, winner: leaders[0].name, votes: top };
  });
}
