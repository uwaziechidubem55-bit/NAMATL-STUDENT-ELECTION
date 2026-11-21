// ============================================================================
// One rule for "are these the same position?".
//
// The position is typed by hand for every candidate, so one office can be saved
// as "Asst. WELFARE DIRECTOR " for one person and "ASST. WELFARE DIRECTOR" for
// another. Compared letter for letter, those were two different positions: a
// voter could vote for both people and each one "won".
//
// Only the letters and the numbers count. Capital or small letters, spaces,
// dots and dashes are ignored:
//   "Asst. WELFARE DIRECTOR "  ==  "ASST. WELFARE DIRECTOR"
//   "VICE PRESIDENT 1"         !=  "VICE PRESIDENT 2"
//   "DIRECTOR OF SOCIALS"      !=  "ASST. DIRECTOR OF SOCIALS"
//
// The pages use the same rule from src/utils/positions.js. The two copies must
// stay identical — tests/one-vote-per-position.test.mjs fails if they differ.
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

// The position as it should read inside a message (extra spaces removed).
export function positionLabel(position) {
  return String(position == null ? '' : position).replace(/\s+/g, ' ').trim();
}
