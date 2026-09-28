# Packet A7-C2-EXEC — every past school year, and the leftovers (executor packet)

Issued by Planner A7, 2026-09-29 ~01:0x. Source: Lane C's post `docs/handoffs/lane-c-to-a2.md` **23:20 +08
"A7 (School Year Setup), BLOCKER"**, plus the three leftovers I routed myself in c1 and Lane C has now asked me
to close. c1 is accepted and on `origin/main` at `c9dd5f05`; **you are building on the current `origin/main`
tip, not on c1's branch.**

- **Worktree (your ONLY writable surface):** `E:/ATLAS-worktrees/lane-a7-school-year-setup`
- **Branch:** `work/a7-school-year-setup-c2` · base `f72885a1` · confirm `git status --short` is empty first.
- **Tier: MEDIUM, and do not let anyone reclassify it downward.** You are adding **a route that writes to
  production data** (it deactivates a year mirror). No live action is executed by this cycle and **you never
  deploy** — A4 does. One fresh independent QA follows, and its authority rows are the load-bearing ones.
- **⚠ `E:` is at 22.27 GiB, below the §3 25 GiB warn line.** `node_modules` is already installed in both
  packages from c1 — **do not run `npm ci`, `npm install` or any build.** Report `E:` at the end. A4 owns the
  reclaim (§14).
- **Failing-first is required, not optional.** §11: a green helper test that was never red proves nothing. For
  each of the four items below, produce the failing control **before** the fix and record it.

## Why, in Lane C's words

After the EnrollPro reset, ATLAS holds year 8 (2029-30, kept as history), 9 (2030-31) and 10 (2031-32).
**Years 9 and 10 are neither the active year nor archived, so they appear on no page at all.** The operator
running four rollovers live on 2026-09-30 cannot find last year's data. Evidence:
`docs/reviews/codex-live-newyear-2022-2023-20260928.md`.

## What I already established, so you do not have to rediscover it

- **Root cause of the invisible years:** `listArchivedYears()` (`atlas-server/src/services/enrollpro-rollover.service.ts:1170`)
  filters `where: { schoolId, isArchived: true }`. Years 9 and 10 are excluded by that filter, not missing from
  the database. `enrollProSchoolYearMirror` rows exist for them.
- **The active year is already in the payload:** `RolloverStatusResult.atlasSchoolYearId` is the active mirror's
  `enrollProSchoolYearId`, so each year can be classified active / kept / past from data you already have.
- **The archive capability already exists and is safe:** `archiveSchoolYear({ schoolId, schoolYearId, actorId, reason, authToken })`
  at `enrollpro-rollover.service.ts:1201` takes an **explicit `schoolYearId`**, **refuses the EnrollPro active
  year** with `409 CANNOT_ARCHIVE_ACTIVE_YEAR`, is **idempotent** (`alreadyArchived`) and **deletes nothing** —
  it deactivates the mirror and preserves every row as read-only history.
- **Status is built in FOUR places**, all of which must carry the new field: `getRolloverStatus` (two return
  sites, lines ~990 and ~1086), `previewRolloverSync` (~1090), and the internal
  `composeResumedRecoveryPreview` (~2152). A missed site is exactly the defect we are fixing.

## Rulings — these close questions, do not re-open them

**R3 — "use the existing archive endpoint" cannot be done literally, and doing it anyway would archive the WRONG
year. Here is the correct reading.** The existing route `POST /rollover-archive/apply`
(`atlas-server/src/routes/runtime.router.ts:455`) calls `archiveAndSyncActiveYear()`, which archives *the year
being rolled over from* **and syncs**, and it takes **no `schoolYearId`**. Pointing a per-year "Keep as history"
button at it would archive the active year and run a sync — a data-integrity defect in front of an audience.
So: **add two thin routes over the existing, already-shipped `archiveSchoolYear()` service** —
`POST /rollover-archive/year/preview` and `POST /rollover-archive/year/apply`, each taking an explicit
`schoolYearId`. This reuses the existing archive mechanism exactly as Lane C intended; it invents no archive
logic and adds no new write path.
- Copy the authority shape of the sibling routes **verbatim**: `authenticateWithSystemToken`, then
  `authorizeRuntimeMutation(req, res, { requirePrivileged: true })`, then `withSchoolLock(schoolId, ...)`. Take
  `schoolId` from the authorised caller — **never from the request body or a query param.**
- **No sync, no rollover, no term authority, no reset** may be reachable from either new route.
- The preview must be **zero-write** and report the same `preservedCounts` shape the history card already uses.
- Never call these routes, or any write route, in a test against a live or shared database.

**R4 — the year list is an ADDITIVE field on the existing status response, not a new read endpoint.**
`archivedYears` stays **byte-identical** (RolloverResetPanel and CarryForwardReviewPanel consume it). Add a new
optional `schoolYears` array, each entry carrying the id, the label, a plain `state`
(`current` | `kept as history` | `past, not yet kept`) and `preservedCounts` when counts are requested. One
shared helper computes it; **call it at all four status sites** (above). A fifth path that forgets it is a
BLOCKING finding, so add a test that drives each exported status function and asserts the field is present.

**R5 — `SAVE_TERM_AUTHORITY_1_9`: make the SENTENCE plain, keep the PHRASE byte-identical.** I asked Lane C for
this and I am taking the stricter reading. That string is the human interlock on a **live-data write**
(`AGENTS.md` §13), and the server compares the typed value to `termPreview.confirmationText`. Rewriting or
removing the interlock is a behaviour change on a HIGH-adjacent path and it is **not mine to make**. So:
plain-language the surrounding instruction, present the code in a readable box, keep the required phrase and the
comparison exactly as they are, and add a line saying what saving does. **Record as an open row: dropping the
interlock is the operator's decision** — I am handing that back to Lane C, not closing it.

**R6 — the Timetable link uses the SAME id the existing Teaching Load history link already uses**
(`enrollProSchoolYearId`, as `/teaching-load/history?schoolYearId=…` does today). Do not invent an ATLAS
internal id. A2 is building `/timetable?schoolYearId=<id>`; if that route is not there yet the link must
**fail closed** — say so in plain words on the page rather than routing to a page that silently ignores the
parameter. Coordinate the shape in your handoff; do not wait for A2.

## The four items

1. **List EVERY past school year on School Year Setup** — current, kept, and past-not-yet-kept alike. One row
   per year, each with a plain status sentence. This replaces the c1 "Past school years" card, which only ever
   showed archived years.
2. **"Keep as history" for a not-yet-kept year**: the R3 routes, **preview first**, in plain words — name the
   year, say what is kept, say that nothing is deleted, and require the operator to confirm. No crimson is
   needed here, but be honest that it changes the year.
3. **Each past-year row links read-only Teaching Load** (the existing link, unchanged) **and read-only Timetable**
   at `/timetable?schoolYearId=<id>` per R6.
4. **The three leftovers I routed in c1, now closed:**
   - the ordered-terms dialog sentence (R5);
   - the carry-forward distribution block: bare `carry` and `Over hard cap` → plain words (`would be copied`,
     and a plain statement of over-limit teaching hours);
   - **extend the jargon guard** to catch bare `carry` and `hard cap` in rendered text, not just the
     hyphenated `carry-forward`. The guard had exactly this hole and Lane C found it.

## Tests — failing-first, reachable, additive

- Extend `src/components/__tests__/a7-year-setup-plain-words.test.tsx` (or add a sibling file) with rows for
  items 1–4. **Add the new file to a committed `test:*` script in the same commit** and to `test:client-suite`.
  A test no gate runs is not evidence (`AGENTS.md` §11).
- **Server rows for the new routes, and these are the ones that matter:**
  1. the route **refuses the EnrollPro active year** (failing-first: prove it returns `409` and writes nothing);
  2. it **refuses a year belonging to another school** — failing-first, and prove **zero dispatch and zero
     writes** on the refusal, not just a status code;
  3. **preview writes nothing** — instrument and show zero mutations;
  4. apply on an already-archived year is **idempotent** (`alreadyArchived: true`, no second write);
  5. a non-privileged caller is refused **before** any service call.
- Retain every pre-existing assertion you touch. A correction that removes or weakens evidence fails review.
  Mark superseded rows superseded, with the authority and today's date, and add the replacement beside them.

## Gates to run and report (literal commands + results, base AND candidate)

`npm run test:a7-year-setup-plain-words` · `test:ux-guardrails` · `test:client-quality` · `test:dup-read-callers` ·
client `npx tsc --noEmit` · server `npx tsc --noEmit` (record the base count and the candidate count) ·
`git diff --check` · `git status --short` empty. **No install, no build, no server, no browser, no database.**

## Handoff

`docs/handoffs/a7-c2-result.md`: base + candidate SHA, exact changed paths, the failing-first record for each
item, the before → after wording table, every command with its literal result, the R3/R4/R5/R6 decisions with
today's date, `E:` free space, and `git status --short` + `git stash list` (you must create no stash).

## Boundaries

Never touch the live or staging runtime, any database, any credential, any scheduled task. A5 owns EnrollPro
adapters and timeouts. A2 owns the timetable route and every timetable component — link to it, do not build it.
A3/A6 own their pages. `AGENTS.md` §8 still holds: no native `<select>`, no raw `<button>`, no `<details>`, no
`title=`, `@/ui` primitives, one primary action per card, no file above 1000 lines.
