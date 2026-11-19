# Election clock, result sheet winners, and the Super Admin "Logins" screen

## 1. Election clock — the portal decides, not the phone

All timing is decided by the server in `api/_election.js`. A phone only displays the answer.

**Dates.** The start and end typed on *Election Settings* are read as Nigerian time (UTC+1). The dates on that screen win over the copies kept in `settings/main`, so a date changed after activation reaches students straight away.

**Switched on** means *Activation → Election* is active (`settings/main.activeMode` is `election` or `both`, or `isActive` is true).

| Phase | When | Student screen |
|---|---|---|
| `upcoming` | a start time is set and has not arrived (switched on or not) | "ELECTION IS COMING SOON" + countdown |
| `live` | switched on, start reached, end not passed | the ballot |
| `ended` | for 24 hours after the end time, or after *Stop Election* | "ELECTION HAS ENDED" |
| `idle` | everything else | plain "ELECTION IS COMING SOON" |

At zero the ballot opens only if the election is switched on. With no dates at all, switching on opens voting at once (as before).

**Where it is used**

- `POST /api/student?action=electionStatus` (public) — gives the portal time, the phase and the dates. The student page asks on opening, every minute, on returning to the page and when the network comes back, and counts in between with a timer that does not follow the phone's date/time setting.
- `api/vote.js` — refuses a vote unless the phase is `live` (`403`, code `ELECTION_NOT_LIVE`).
- `saveMainSettings` in `api/admin.js` — when a save switches the election off after it started, it stamps `settings/main.electionEndedAt` (the end time if it already passed, otherwise now). Switching on again clears the stamp.
- Admin dashboard auto-stop — asks the portal (`getElectionStatus`) whether the end time has passed, instead of using the clock of the admin's device.

If the status cannot be reached at all, the student page falls back to the old phone-clock rule for display only; votes are still checked by the server.

## 2. Result sheet

*Print Results → Generate Results* now shows the logo in a circle and a **Winners** table between the results table and the date line. One row per position: the candidate with the most votes; equal top votes show as `TIE — name / name`; a position with no votes shows `No votes`. The winners are worked out from the rows already on the sheet; nothing else on the sheet changed.

## 3. Super Admin — who entered

- **Logins** screen (`superLogins` action, super admin only): everyone who logged in or registered, with name, matric number, level, date registered, time of entry and whether they voted. Views: each person once, or every entry. Search and CSV export.
- **Live Monitor**: a logged-in student appears by name, matric number and level; visitors who have not logged in still appear as a code.
- **Audit Log**: student actions show the person's name and level beside the matric number.

The unique key is never sent to these screens.

## Tests

```
node --import ./tests/helpers/register.mjs --test tests/election.test.mjs
node --import ./tests/helpers/register.mjs --test tests/manual-payment.test.mjs
```
