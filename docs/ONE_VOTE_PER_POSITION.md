# One vote per position, one winner per position

## What went wrong

The position is typed by hand for every candidate. On the ballot of 21 Nov 2026 two offices were typed in two ways:

| Typed for one candidate | Typed for the other |
| --- | --- |
| `Asst. SECRETARY GENERAL ` | `ASST. SECRETARY GENERAL ` |
| `Asst. WELFARE DIRECTOR ` | `ASST. WELFARE DIRECTOR ` |

Positions were compared letter for letter, so each of these was treated as two positions:

- the ballot showed two sections, each marked "Running Unopposed", and a voter could vote for both people;
- the Winners list on the result sheet showed both people as winners;
- the vote endpoint did not look at positions at all, so a request sent without the page could also carry two people for one position, or the same person several times.

## The rule now

**Same letters and numbers = same position.** Capital or small letters, spaces, dots and dashes are ignored.

- `Asst. WELFARE DIRECTOR ` = `ASST. WELFARE DIRECTOR`
- `VICE PRESIDENT 1` ≠ `VICE PRESIDENT 2`
- `DIRECTOR OF SOCIALS` ≠ `ASST. DIRECTOR OF SOCIALS`

The rule lives in `api/_positions.js` (server) and `src/utils/positions.js` (pages). The two must stay identical; a test fails if they differ.

## Where it applies

1. **Vote endpoint (`api/vote.js`)** — after the voter's code is checked and before anything is written, the ballot is refused with HTTP 400 if:
   - two chosen candidates are in the same position, or the same candidate appears twice → `ONE_VOTE_PER_POSITION`;
   - a chosen candidate no longer exists → `CANDIDATE_NOT_FOUND`;
   - the list is not a list of candidate IDs, or has more than 100 → `INVALID_BALLOT`.

   A refused ballot records nothing, so the voter can still vote properly. One ballot per voter is unchanged (`hasVoted`, checked again inside the transaction).
2. **Ballot page (`src/pages/StudentDashboard.jsx`)** — one section per position, so choosing one person locks the others in that position. If the portal refuses a ballot (the ballot changed while the page was open), the voter sees why and the page reloads.
3. **Result sheet (`src/pages/AdminDashboard.jsx`)** — the Winners list has one line per position with only the candidate who won.

Nothing else was changed. With positions typed the same way, the ballot and the result sheet are identical to before.

## Not changed

- Votes already counted are not touched.
- The **Vote Point** column, the "across N positions" line, the dashboard "Positions" count, the Staff and Super Admin screens still compare positions letter for letter. Typing the position the same way for both candidates (Candidates → Edit; votes are kept) makes every screen agree.

## Tests

```
node --import ./tests/helpers/register.mjs --test tests/one-vote-per-position.test.mjs
```
