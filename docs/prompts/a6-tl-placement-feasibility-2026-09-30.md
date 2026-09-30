# A6 — Teaching Load placement feasibility before save (decision 14, operator 2026-09-30 11:10)

**Role:** executor (`atlas-executor-ds-delegate`), reasoning variant **high**. Sole writer for this
worktree and branch. QA is a separate, fresh, read-only session (`atlas-qa-ds-delegate`, **high**).

**Base SHA:** `17f6013ed15f11be0da2694b3250012c0edb9c04` (== `origin/main`, fast-forward, clean).
**Worktree:** `E:/ATLAS-worktrees/lane-a6-tl-placement`
**Branch:** `fix/a6-tl-placement-feasibility`
**Tier:** MEDIUM (production wiring + user-facing behaviour). No HIGH action: no deploy, no live
write, no migration, no generation, no publication, no runtime/task/env change.

## 0. Operator decision 14 (verbatim, `docs/plans/operator-decisions.md`)

> **Teaching Load never saves a load the timetable cannot place.** Before "Apply suggested" (or any
> assignment) saves, Teaching Load runs a quick placement check; a class that cannot fit is named in
> plain words with a teacher who does fit. The generator also repairs instead of giving up: when a
> class has no free slot, it tries moving one blocking class (the 30 Sep Makabansa TLE case: only
> 11:30 was free and every rotation teacher was booked there). **Guard: A6, A8.**

**This packet delivers only the first half** (the pre-save check + the named class + a teacher who
fits). The "generator repairs by moving one blocking class" half is A8's; do not implement it, do not
touch the generator.

### Live case this must catch (Lane C -> A8, 2026-09-30 09:40 +08, live run 355, year 5)

- Section external **87**, **Grade 8 Makabansa**; subject **11 TLE Exploratory – ICT** (`TLE_ROTATION`,
  preferred room CLASSROOM); owner **teacher 25 Francis Miguel Navarro**.
- Reason `NO_AVAILABLE_SLOT` / `FACULTY_SLOT_UNAVAILABLE` on sessions T1 1,4 / T2 2,5 / T3 3 —
  5 unplaced sessions, Publish blocked.
- Only **11:30** was free for Makabansa, and every rotation teacher (11 ICT, 12 AFA, 13 FCS) was
  booked there by another section. **EDUARDO VILLAREAL was free at 11:30 in all terms.**
- Makabansa has 35 entries per term (average 46).

## 1. Reuse mandate — no second copy of scheduling logic

The check MUST be a composition of existing generator-aligned primitives. Any local re-implementation
of interval overlap, term scope, slot enumeration, rotation counting, or conflict rules is a
`CORRECTION_REQUIRED` finding. Required call surface:

| Need | Existing primitive (do not copy) |
|---|---|
| Demand + rotation lines (per subject×section×term) | `buildCanonicalTimetableDemand`, `readDayShapePolicy` — `atlas-server/src/services/timetable-demand.service.ts` |
| Section-free / teacher-free slot search (bounded) | `searchCandidateSlots` — `timetable-insertion.service.ts:324` (bound `MAX_EVALUATED_SLOTS = 240`, line 175) |
| Weekly slot shape | `buildWeeklyDayShape` — `timetable-insertion.service.ts:202` |
| Occupancy primitives | `emptyOccupancy`, `addLockedSessionOccupancy` — `timetable-insertion.service.ts:270,274` |
| The generator's conflict predicate (faculty/section/room, term-scoped) | `evaluateCandidateInvariants` — `timetable-candidate-domain.ts:133`, reached only via `evaluateInsertionCandidateInvariants` (`timetable-insertion.service.ts:241`) |
| Truthful reason vocabulary | `InsertionReason` / `guidanceFor` — `timetable-insertion.service.ts:42,56,168` (use it; add no new reason codes) |
| Room compatibility | `filterCompatibleRooms`, `isRoomCompatibleForSubject` — `timetable-insertion.service.ts:245,232` |
| Alternative teacher must be qualified | the existing qualification/cover candidate path — `qualification-evaluator.service.ts` (`evaluateQualification` / `evaluateQualificationWithPolicy`) and/or `listCoverCandidates` (`teaching-load-cover.service.ts:365`). Name which one you used in the design note. |

Occupancy basis: derive it from the same sources the generator's own read/preview paths use — DRAFT
`locked_session` rows and, **when an active draft run exists, its placed entries** (the Makabansa case
is only reproducible if the other sections' placed sessions count as teacher occupation). State the
choice and its evidence in the design note; if you can prove the draft-run entries are unreachable
cheaply for the checked scope, say so and say which rows you used instead. Never invent a third
occupancy model.

## 2. Required outcomes

**O1 — Zero-write placement check, server.** New service `atlas-server/src/services/teaching-load-placement-check.service.ts`
exporting (a) a pure, DB-free evaluator that turns demand lines + weekly slots + compatible rooms +
occupancy into per-line verdicts by delegating to `searchCandidateSlots`, and (b) a loader that builds
that input for a bounded request scope. Zero writes.

**O2 — Zero-write preview route.** `POST /faculty-assignments/placement-check` in
`atlas-server/src/routes/faculty-assignment.router.ts` (`authenticate`, `requirePrivilegedRole`,
actor-school scoped). Request: `{ schoolId, schoolYearId, lines: [{ sectionId, subjectId, facultyId }] }`
(finalise the exact shape in the design note; keep the client and server in one contract and cover it
with a parity assertion). Response per line: `placeable: boolean`, the reused `reason`, `sectionName`,
`subjectName`, and — when not placeable — `alternatives: [{ facultyId, facultyName, day, startTime, endTime }]`
(each alternative proven free by the same search) and no writes.

**O3 — Write gate on the single assignment save.** `setAssignments` (`faculty-assignment.service.ts:5319`),
reached by `PUT /faculty-assignments/:facultyId` (`faculty-assignment.router.ts:1041`), evaluates the
proposed ownership set for the affected sections before committing. An unplaceable line fails closed
with HTTP 409, `code: 'TEACHING_LOAD_UNPLACEABLE'`, and `details.blockers: [{ sectionName, subjectName,
facultyName, sentence, alternatives }]`. **Nothing is written for the failed request** (prove it).

**O4 — Write gate on "Apply suggested".** `applyTeachingLoadSuggestionProposal`
(`teaching-load-suggestion-proposal.service.ts:373`), reached by
`POST /faculty-assignments/suggestion-proposals/:proposalId/apply` (`faculty-assignment.router.ts:973`),
runs the same gate on the resulting ownership set; same typed 409 and the same `details.blockers`
shape; zero writes on refusal; the pending proposal is left intact (not consumed) so the operator can
apply the alternative and retry.

**O5 — One plain sentence + one-click alternative (client).** In `atlas-client/src/pages/TeachingLoad.tsx`
(`handleSave`, line 162; suggestion apply, line 360) and `AutoFillSummaryModal.tsx` (the apply action,
line ~741): before saving, call the check for the affected sections; when a line is not placeable, do
**not** issue the save, and show ONE plain sentence naming the section, the subject and why, plus a
one-click control that swaps in an alternative teacher who fits and re-runs the check/save. Wording
rules: no raw codes, no `Section 87`/`subject 11`, no jargon; name people by name. Also render the
server's 409 `details.blockers` the same way (race/other-tab case) so a failure is never a bare toast.
`AGENTS.md` §8 + the design-judgement gate apply: write the short layout note (what stays, what goes,
what moves behind `Tooltip`/`More`, what is deleted) before writing JSX.

**O6 — Speed.** One section's check under **2 s** end to end on the server route. Measure it, record
the literal command and the observed number. If the dominant cost is the canonical demand build,
narrow the read *inside the existing authority* (one pass / scoped query) — never with a second,
divergent demand computation.

## 3. Failing-first control (mandatory, hermetic)

New `atlas-server/src/__tests__/a6-tl-placement.check.test.ts` (hermetic, no DB) reproducing the
Makabansa shape:

- Makabansa's section occupancy: every candidate slot except **11:30** is taken by its own other
  sessions.
- Teacher 25 (ICT), the AFA and FCS rotation owners: each occupied at 11:30 by another section.
- Expected verdict: **not placeable**, reason `NO_AVAILABLE_SLOT`, with `teacherBusySlots > 0`
  distinguishing the teacher-blocked case, and the sentence naming Grade 8 Makabansa and TLE
  Exploratory – ICT.
- EDUARDO VILLAREAL: free at 11:30 for every applicable term ⇒ returned as an alternative who fits.
- **Controls:** (i) a would-be alternative who is *not* qualified or *not* free must NOT be returned
  (negative control); (ii) a section with a free slot and a free qualified teacher IS placeable
  (positive control — the check must not block everything); (iii) with empty occupancy everything is
  placeable.
- RED at base (`17f6013e`), GREEN on the candidate. Record the base run's literal command and output.

## 4. Also mandatory

- Route/DB rows run only through the documented disposable harness (`npm run test:server-db`) or
  hermetically. **Never** a bare DB-writing suite, never `atlas-server/.env` against live.
- Every new/changed test file is reachable from a committed script in the same commit:
  `atlas-server/package.json` → `test:a6-tl-placement`; the route/DB test added to the
  `test:server-db` list; the client test → `atlas-client/package.json` `test:a6-tl-placement-client`.
- A source-level guard test asserting the new module contains no local `intervalsOverlap` /
  `timeToMinutes` / term-scope re-implementation and does import the shared primitives (reuse proof).
- Rendered proof of O5: a loopback render with the API mocked (`VITE_ATLAS_API=http://127.0.0.1:5101`
  if a preview is used — never the live API), labelled `isolated`; before/after strings quoted.
  Start any preview with `Start-Process -WindowStyle Hidden -PassThru`, poll the port, stop that PID in
  the same command. Never a foreground server.
- Client suite + both type-checks and builds green; `git diff --check` clean.

## 5. Boundaries (deny list)

- Do not touch the generator/scheduler/repair paths, publication, carry-forward, cover-class,
  migration, `.env`, the supervisor, ports 5001/5174, or any live/shared database.
- No `git push`, no merge, no branch deletion, no worktree creation/removal, no `git stash`,
  no amend/rebase.
- Commit only the assigned paths; `git status --short` completely empty afterwards.
- If a required primitive cannot be reused as listed, **stop and report** — do not fork the logic.

## 6. Return format (one page, no transcripts)

Base SHA · candidate SHA · exact changed paths · what changed and why · the decisive commands
actually run with results (failing-first base run + green run, the route/DB run, the two builds,
`git diff --check`) · the measured one-section check time · the design note for O5 · known risks each
marked `BLOCKING`/`NON_BLOCKING` · verdict (`REVIEW_REQUIRED` or `BLOCKED`).

Worktree disposition: `RETIRE_AFTER_INTEGRATION`.
