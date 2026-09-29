# A8 C3 — generate WITH teacher gaps, and blockers grouped by cause — executor handoff

**Base SHA** `f1fb076a15609232a5e9764e5d24b3f6cdf37e00`
**Product candidate** `d87e1b3ed8e346326dce65b812cd9ff17aadc49c` (source, tests, scripts)
**Branch** `work/a8-c3-generate-gaps` · **Worktree** `E:/ATLAS-worktrees/lane-a8-c3-generate-gaps` — `KEEP_ACTIVE` until A8 C3 is accepted, then `RETIRE_AFTER_INTEGRATION`.
**Packet** `docs/prompts/a8-c3-generate-with-gaps-2026-09-29.md` · **Risk** HIGH (generation gate) — one `atlas-reviewer-high` pass.

## The problem, in the operator's words

Live S.Y. 2023-2024, 14:25: `status BLOCKED`, `generateAllowed false`, **651** blocker rows, each an identical
sentence with its own "Recheck generation readiness" button. 620 of those rows were **one fact at two grains**:
50 classes with no Teaching Load owner, reported once per pair (`TL_DEMAND_UNCOVERED`, 50) and once per session
of it (`TL_NO_QUALIFIED_OWNER`, 570, x3 terms). 31 rows were three further root causes (`WORKLOAD_POLICY_BLOCK`
15, `FACULTY_SUBJECT_NOT_QUALIFIED` 12, `FACULTY_OVERLOAD` 4).

## Exact changed paths (17)

Server — `atlas-server/`
- `src/services/generation-blocker-groups.service.ts` **(new)** — the one gap/advisory/blocker rule + the one root-cause grouping.
- `src/services/generation-readiness.service.ts` — classification, gate, new payload fields.
- `src/services/generation.service.ts` — `summarizeTeacherGaps`, `POLICY_ADVISORY_VIOLATION_CODES`, the object overload of `buildGenerationCompletedMessage`, three `RunSummary` fields.
- `src/__tests__/a8-c3-generate-with-gaps.test.ts` **(new, 12 tests)**.
- `src/__tests__/generation-canonical-readiness-genc02.test.ts` — `unownedSubjects` + `lowWeeklyCap` mock overrides, 6 new `A8C3.*` rows, the base gate invariant marked superseded in place with a strictly stronger replacement beside it.
- `src/__tests__/generation-completion-copy-c2.test.ts` — `U4`'s literal marked superseded in place; `U4R` added beside it. Nothing deleted.
- `package.json` — `test:a8-c3-generate-gaps`; both new/used files added to `test:server-suite`.

Client — `atlas-client/`
- `src/lib/timetable-generation-readiness.ts` — parses `groups`/`gaps`/`blockerCount`/`gapClassCount`, `presentGenerationBlockerGroups`, per-cause noun/verb copy, readiness state and summary.
- `src/lib/timetable-capabilities.ts` — the gate follows `generateAllowed && zeroWrite`; `blockerCount` no longer independently blocks.
- `src/components/timetable/simple/SimpleGenerationBlockerGroups.tsx` **(new, 128 lines)** — the grouped panel + the one "Check again" + the `@/ui` Accordion disclosure.
- `src/components/timetable/simple/SimpleGenerationBlockerSheet.tsx` — grouped view is the default; raw rows preserved verbatim behind the disclosure; per-row retry removed.
- `src/components/timetable/TimetableSimpleHeader.tsx`, `TimetableSetupPane.tsx` — read the blocking count, not the row count.
- `src/components/timetable/__tests__/a8-c3-generate-gaps-groups.test.tsx` **(new, 5 tests)**; `__tests__/generation-blockers-c02.test.tsx` (`C2-a.5`'s per-row-retry assertions superseded in place, `C2-a.5R` added beside it); `src/lib/__tests__/uxc01r-generation-readiness.test.ts` (one literal extended).
- `package.json` — `test:a8-c3-generate-gaps`.

**No Prisma file, schema or migration is touched** (`git status` on `prisma/` → 0 paths). No file exceeds the §8
1000-line limit; the largest React file I touched is 569 lines.

## The gap-vs-blocker rule, and why

Every blocker row lands in exactly one of three classes, so no count can silently drop a row
(`blockerCount + advisoryCount + gapCount === blockers.length` is asserted).

1. **GAP** — `TL_DEMAND_UNCOVERED` and `TL_NO_QUALIFIED_OWNER` (the same fact at pair and session grain), plus
   `WORKLOAD_POLICY_BLOCK` / `FACULTY_SUBJECT_NOT_QUALIFIED` / `FACULTY_OVERLOAD` **only when** the row's
   `(sectionId, subjectId)` pair is one this same diagnostic already proved has no active Teaching Load owner.
   A gap is a setup fact the run carries and names; it does not stop a reviewable schedule.
2. **ADVISORY** (planner ruling) — those same three codes when **not** attributable. Recorded, counted, grouped,
   named in the run result. Not generation-blocking.
3. **BLOCKER** — everything else, including any code outside the three. **Fails closed.**

`generateAllowed = blockingBlockers.length === 0 && scheduler.ran && blockingHardCount === 0 && zeroWrite`, with
`status` derived from the same expression. `blockingHardCount = hardCount − hardGapCount − advisoryHardCount`;
**`hardCount` is never reduced**, and `hardCount === hardGapCount + advisoryHardCount + blockingHardCount` is asserted.

**Why the three codes are advisory for generation and nothing else is.** They are the *workload and qualification*
findings the packet names as following from teacher coverage, and the operator's own list asks for the line
"4 teachers are over 30 hours → Review their load" rather than for a wall. Every other code — rooms, policy
windows, canonical shape, term authority, retained locks, demand authority, an ownership conflict — is a fact that
makes a run *wrong*, and none of it is softened.

**The safety invariant, proved both ways (`a8-c3-generate-with-gaps.test.ts` C3.11 and `A8C3.5`/`A8C3.6`).** All
three advisory codes are on `PROMOTABLE_CONSTRAINT_CODES`, and their persisted violation codes
(`FACULTY_OVERLOAD`, `FACULTY_SUBJECT_NOT_QUALIFIED`, `UNASSIGNED_SECTION`, `LACKING_FACULTY`) are on the same
allowlist. The test drives the **production** `countBlockingHardViolations` — the exact function `publishSchedule`
calls — and asserts each one refuses publication, and that the run's own `blockingHardViolationCount` counts them
so the client publish gate refuses too. `isRunPublishedStrict`, the publication predicate and the run's
hard-violation accounting are **untouched**: `git diff f1fb076a` touches no publication file.
The negative control (`A8C3.6`) proves the relaxation extends to nothing else: a real non-advisory blocker
alongside advisories still blocks, and a dry run that did not execute still blocks.

## Grouping (Deliverable 1)

One entry per **root cause**, counted in **classes**, deterministic (count desc, then cause asc; examples by
frequency then alphabetically — the result depends on the *set* of rows, not their order, asserted by reversing
the input). The two coverage codes fold into one `TEACHER_COVERAGE_GAP` line: 570 + 50 rows → **one line reading
50 classes**, with `sessionCount: 620` still on the group so nothing is hidden. A group counts `classes` when every
row names a real pair and `items` otherwise (a year-wide cause has no class), and an item count uses the
`entity`+`reason` composite so 4 overloaded teachers read as 4, not as one repeated sentence. `groups` partition
the blocker rows exactly (asserted by summing `sessionCount`). It is a pure fold over the array the diagnostic
already built: **no second preflight, no second scheduler run, no additional database read**, and zero-write is
re-asserted on every new path (`writes === []`, `databaseSignature.zeroWrite === true`).

## Where the run-result sentence comes from

`generation.service.ts` → `summarizeTeacherGaps({ unassignedItems: resolvedUnassignedItems, violations: mergedValidationResult.violations })`
— the run's **own persisted** rows, not the preflight's guess — persisted on the run as
`teacherGapClasses` / `timeSlotClasses` / `teacherGapExamples` / `policyAdvisoryCount`, then formatted by
`buildGenerationCompletedMessage` for the `GENERATION_RUN_COMPLETED` notification. Live shape:
`"New schedule ready. 50 classes still need a teacher and 1 class still needs a time slot and 2 policy advisories
to review before it can be published."` The single-number overload is **byte-identical** to the pre-A8 wording
(asserted), so no accepted copy changes silently.

## What I actually ran

| Command (workdir) | Result |
| --- | --- |
| `npx tsx --test src/__tests__/a8-c3-generate-with-gaps.test.ts` — **on base** | `tests 1, pass 0, fail 1` (`ERR_MODULE_NOT_FOUND … generation-blocker-groups.service.js`) |
| `npx tsx --test src/__tests__/generation-canonical-readiness-genc02.test.ts` — **on base** | `tests 20, pass 16, fail 4` — all four `A8C3.*` fail, first: "every coverage row is counted as a gap" |
| `npm run test:a8-c3-generate-gaps` (client) — **on base** | `tests 5, pass 1, fail 4` — first: "a teacher gap must not read as 'setup needs attention'" |
| `npm run test:generation-blockers-c02` (client) — **on base** | `tests 13, pass 12, fail 1` — pre-existing `C2-a.7` only |
| `npx tsx --test src/__tests__/a8-c3-generate-with-gaps.test.ts` (candidate) | `tests 12, pass 12, fail 0` |
| `npx tsx --test src/__tests__/generation-canonical-readiness-genc02.test.ts` (candidate) | `tests 22, pass 22, fail 0` |
| `npm run test:server-suite` (detached, `scripts/dev/start-detached.ps1`, log `a8c3-server-suite.log`) | **`pass 465, fail 0`** |
| `npx tsc --noEmit -p tsconfig.json` (server) | no output |
| `npx tsc --noEmit -p tsconfig.json` (client) | 5 errors, **all pre-existing and all in files I did not touch**: 4 × `Cannot find module 'playwright'` (the junction donor has no `playwright`) + 1 × `timetable-truth-labels-a2.test.ts(523,32)` literal-type comparison |
| `npm run build` (client, detached, `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`) | `built in 12.56s`, 0 errors. First attempt failed the §6 fail-closed guard for the missing env var; re-run with the origin set explicitly |
| `npm run build` (server, detached) | `tsc`, no output, 0 errors |
| `npm run test:a8-c3-generate-gaps` (client, candidate) | `tests 5, pass 5, fail 0` |
| `npm run test:generation-blockers-c02` (client, candidate) | `tests 14, pass 13, fail 1` — the **same pre-existing `C2-a.7`** (11 visible header controls vs the ≤6 cap), nothing new |
| `npm run test:uxc01r` (client) | `tests 38, pass 38, fail 0` |
| `npm run test:timetable-operator-ux` (client) | `tests 60, pass 59, fail 1` — pre-existing: `readinessLabel` returns `'2 Must fix, 9 advisories'`; the test and `SimpleHeaderHelpers`/`simple-timetable-state` are byte-identical to base and none is in my diff |
| `npm run test:a2-timetable-truth-labels` (client) | `tests 35, pass 34, fail 1` — pre-existing, same reasoning |
| `git diff --cached --check` | exit 0, no output |

Environment: `atlas-client/node_modules` is a junction to
`E:\ATLAS-worktrees\lane-a3-c12-dashboard-map-sections\atlas-client\node_modules` — **155 entries before and after**,
unchanged. `atlas-server/node_modules` is a junction to `D:\ATLAS\atlas-server\node_modules` — **209 entries,
unchanged**. `D:\ATLAS\atlas-client\node_modules` is unusable (no `@esbuild`); no fresh install was performed.

## Risks

**BLOCKING (for the HIGH reviewer to rule on, not for me to close)**
- **B1 — the relaxation is wider than "coverage-attributable".** Per the planner ruling, the three
  workload/qualification codes are advisory for generation **whether or not** attributable. On live 2023-2024 all
  31 of them are unattributable, so this candidate is what makes that year generate-allowed. I could not verify the
  live split (staging/live access is forbidden to me), so the claim rests on the packet's own evidence.
- **B2 — the run that this admits will carry hard violations.** A run generated under this rule persists
  `FACULTY_OVERLOAD` / `FACULTY_SUBJECT_NOT_QUALIFIED` / `UNASSIGNED_SECTION` as HARD. That is intended and
  publication refuses it (proved), but it means a generated-but-unpublishable run is now reachable where before it
  was not. The client already renders that state as `generated-issues`, and the notification names the advisories.
- **B3 — the placement decision is option (b).** The uncovered classes are left **unplaced** and listed, not placed
  with a "Teacher to be assigned" placeholder. The engine has no teacher-less placement lane: `constraint-validator`
  skips `facultyId == null` entries, but `validateTermTeacherResolution` and the output projections would flag them,
  and the run would persist hard violations for a new reason. Inventing that lane would have weakened placement
  authority, which the packet forbids. Nothing is dropped: every class is in the run's `unassignedItems`, in
  `summary.teacherGapClasses`/`teacherGapExamples`, and in the grouped panel.

**NON_BLOCKING**
- N1 — `groups[].examples` are built from the section mirror the preflight already loaded; the client may override
  with its own `labelForSection`. No extra read is made.
- N2 — the client falls back to the raw row count when a payload carries no `blockerCount`, which fails closed.
- N3 — `A8C3.1`'s mock constructor places an unowned pair instead of emitting a session-level row, so the
  570-rows-into-50-classes fold is proven in the pure suite, not in the integration rows. Stated in the row.
- N4 — three client suites carry one pre-existing failure each (`C2-a.7`; `test:timetable-operator-ux`;
  `test:a2-timetable-truth-labels`) and the client type-check carries 5 pre-existing errors. All are outside my diff.

## UNPERFORMED acceptance rows — NOT claimed

- **Staging/live proof on 2023-2024 with the 50 gaps: UNPERFORMED.** This is A4's deployment-time row. I ran no
  diagnostic, generation, publication, migration, deploy, restart, task/env change, login or browser action against
  live or staging. No staging or Tailnet browser evidence exists for this candidate.
- Rendered before/after screenshot comparison by a non-builder reviewer at 1366×768: **UNPERFORMED** (a §11
  design-judgement row for the review/integration step).
- The `ux-communication-rubric` score for the new grouped panel: **UNPERFORMED** (same owner).

---

## Correction round 1 (HIGH review CORRECTION_REQUIRED, 25 pass / 1 blocked / 0 unperformed)

**Round base** e14c04cd407fb318d6062b2be26d77aac2cffe19 (the previous tip). Additive commit on the same branch; nothing amended, rebased or reset.

### F1 (BLOCKING) — fixed: the gate's hard term was vacuous and hardGapCount was a false claim

**The defect.** generation-readiness.service.ts:482-488 computed the attribution test
(code is advisory-class && pair is uncovered) and then **discarded its result**, so hardGapCount actually
meant "every hard violation that is not advisory-class" and
lockingHardCount = hardCount − hardGapCount − advisoryHardCount ≡ 0 for every input. generateAllowed
therefore reduced to lockerCount === 0 && schedulerRan && zeroWrite and held only because the mirror loop at
:446-459 independently pushes a blocker row per HARD validator violation. The HIGH reviewer proved it on the
production path: 12 real FACULTY_DAILY_MAX_EXCEEDED violations classified hardGapCount=12 /
blockingHardCount=0.

**Why the committed tests missed it.** Both real-path negative controls (A8C3.3a, A8C3.6a) used
hugeMathMinutes, which raises a **preflight** blocker row (CANONICAL_SHAPE_CAPACITY_EXCEEDED) — lockerCount
saved them and the hard term was never reached. The pure-helper row at 8-c3-generate-with-gaps.test.ts:167-168
hand-fed deriveGenerateDecision an input shape the production call site can never produce. A helper-only proof is
not a real-path proof.

**The fix.** The three hard-violation classes are now computed **explicitly**, each a genuine subset of hardCount:
1. **attributable gap** — advisory-class code **and** a pair this diagnostic proved unowned (the only thing
   hardGapCount counts, which is what its published meaning at generation-readiness.service.ts:118-127 says);
2. **advisory** — advisory-class code whose attribution cannot be read (a real FACULTY_OVERLOAD names only a
   acultyId);
3. **blocking** — every other hard violation: any non-advisory code, plus the canonical shape violations folded
   into hardCount at :432-438, which carry no pair to attribute at all.
hardCount itself is untouched. The comment at :476-481 and the module doc at
generation-blocker-groups.service.ts:17-33 are now aligned with what the code does.

**The real-path proof (new rows A8C3.7, A8C3.8).** A8C3.7 drives maxTeachingMinutesPerDay: 30 through the
real constraint-validator to raise **FACULTY_DAILY_MAX_EXCEEDED** — a code the ruling did *not* make advisory —
on a fully staffed year, and asserts lockingHardCount > 0, hardGapCount === 0, dvisoryHardCount === 0, the
three counts partitioning hardCount, and generateAllowed === false. It then re-runs the **real**
deriveGenerateDecision with the reported numbers and **every blocker row stripped**, proving the hard term alone
still refuses; a vacuous term would return 	rue and the row would go red.

**Break-it-and-restore proof (literal).**
- Mutant A — attribution forced to
eturn true inside ttributableGapHard:

px tsx --test src/__tests__/generation-canonical-readiness-genc02.test.ts → **	ests 24, pass 21, fail 3**;
  A8C3.8 red.
- Mutant B — the **original pre-F1 defect** restored verbatim (hardGapCount = hardViolations.length −
  advisoryClassHard.length): same command → **	ests 24, pass 23, fail 1**; the failure is
  A8C3.7, AssertionError: blockingHardCount must be non-zero for a real hard violation, got 0 — exactly the
  vacuous-term symptom the reviewer named.
- Restored byte-exact from a pre-mutation copy: SHA-256 BD114020C4BA30AFF4B07923DC221D45C8AC58F75A539E348957A5FACB4F8D22,
  MUTANT-CODE-PRESENT: False, and the suite returns to **	ests 24, pass 24, fail 0**.

### Items 5–8 (NON_BLOCKING) — all four done

- **5 (packet wording match)** — the completed-run sentence now **names** the gaps, not just counts them:
  uildGenerationCompletedMessage takes 	eacherGapExamples and prints
  "New schedule ready. 50 classes still need a teacher: MAPEH 7-A, ENG 7-B, SCI 7-C." The examples are the run's
  own persisted summary.teacherGapExamples, capped at five, and **capped rather than truncated** (§8: no
  ellipsis). A nameless run still prints the bare count rather than an empty colon. Four new assertions in
  8-c3-generate-with-gaps.test.ts C3.12; the single-number overload and the count-only object form are
  unchanged, so no existing literal became invalid and **nothing was marked superseded or deleted for item 5**.
- **6** — groupHeadline no longer substitutes the panel-wide gapClassCount for group.count; the server
  already counted each group in classes, so the line reads group.count. Signature narrowed accordingly.
- **7** — "N things must be fixed" replaced with "N setup items must be fixed before a timetable can be made."
- **8** — the dead
etry branch is **removed** from SimpleGenerationBlockerGroups.tsx, and the model is honest:
  TimetableGenerationBlockerGroupPresentation.action is narrowed to { kind: 'navigate'; label; href }, so the
  unreachable control path can no longer be written.

### Re-run (literal, this round)

| Command | Result |
| --- | --- |
|
px tsx --test src/__tests__/generation-canonical-readiness-genc02.test.ts (candidate) | 	ests 24, pass 24, fail 0 |
|
pm run test:a8-c3-generate-gaps (server) | 	ests 12, pass 12, fail 0 |
|
pm run test:server-suite (server, detached) | **	ests 467, pass 467, fail 0** (was 465 — +2 from the new rows) |
|
px tsc --noEmit -p tsconfig.json (server) | 0 lines, no output |
|
px tsc --noEmit -p tsconfig.json (client) | 5 errors, unchanged and all pre-existing (4 × playwright missing from the junction donor, 1 × the 	imetable-truth-labels-a2 literal-type comparison) |
|
pm run test:a8-c3-generate-gaps (client) | 	ests 5, pass 5, fail 0 |
|
pm run test:generation-blockers-c02 (client) | 	ests 14, pass 13, fail 1 — the same pre-existing C2-a.7, nothing new |
|
pm run build (server, detached) | 	sc, 0 errors |
|
pm run build (client, detached, VITE_ENROLLPRO_URL set) | uilt in 11.77s, 0 errors |

### Risks after this round

- **B1 (unchanged, for the HIGH reviewer)** — the relaxation is wider than "coverage-attributable": per the planner
  ruling the three workload/qualification codes are advisory for generation whether or not attributable. The live
  2023-2024 split is still unverified by me.
- **B2 (unchanged)** — a run admitted under the rule persists HARD advisories, so a generated-but-unpublishable run
  is reachable. Intended; publication still refuses it.
- **B3 (unchanged)** — placement is option (b): the 50 classes are listed, not placed with a placeholder.
- **N5 (new, NON_BLOCKING)** — the hard term and the blocker-mirror loop overlap by design (defense in depth), so
  on any given fixture more than one term can point at the same underlying violation. A8C3.7 isolates the hard
  term explicitly; no other row depends on the overlap.
- **N6 (new, NON_BLOCKING)** — lockingHardCount is now non-zero in cases where the gate is already refused by
  lockerCount too, so a consumer reading it alone would see a larger number than strictly necessary. It is a
  partition of the true hardCount and is documented as such; no consumer gates on it directly.

**Staging/live acceptance on 2023-2024 remains UNPERFORMED and unclaimed** — A4's deployment-time row. No
diagnostic, generation, publication, migration, deploy, restart, task/env change, login or browser action was run
against live or staging in this round either.