# A8 c5 execution packet — every remaining blocker has a plain fix-it action

Lane A8, 2026-09-29. Base `f925045c` (`origin/main` tip). Branch `work/a8-c5-generation-fixable`.
Worktree `E:/ATLAS-worktrees/lane-a8-c5-fixable` (one writer: this lane's executor, then the planner).

**Risk HIGH as declared by the source packet** (`docs/prompts/a8-c5-generation-always-fixable-2026-09-29.md`):
the generation GATE contract and the publication predicate both change. The gate text/links do not relax
beyond what A8 c3 already decided.

## Authority boundary — what is NOT authorized by this packet

| Not authorized | Why | Who |
| --- | --- | --- |
| Deploying anything | §14: only Lane A4 deploys | A4 |
| A generation run (production OR staging) | HIGH action, §13 | operator |
| Publication of any run | HIGH action, §13 | operator |
| Any write to the live database | HIGH, §13 | operator |
| Migration / schema / runtime / env / task | HIGH, §13 | operator |
| Companion (EnrollPro/AIMS/SMART) edits | §4 READ_ONLY | — |

Authorized: source edits under this worktree; client unit/rendered tests; server suites on a **disposable**
database via `npm run test:server-db`; browser **reads** on staging after `/__dev/staging-login`, and
ordinary UI mutations on staging that an acceptance row needs (§12). No generation.

## Source of the work

1. `docs/prompts/a8-c5-generation-always-fixable-2026-09-29.md` (Lane C, 16:40 + addenda 17:25 / 19:05 / 20:05).
2. `docs/prompts/truth-fixes-2026-09-29.md` §A8 (Lane C, 17:25) — the addendum 17:25 prerequisite: the two
   BLOCKERs first, then this packet. Addendum 20:10 assigns the `/subjects` cold-load row to A8.

## Premises re-checked by the planner against `f925045c` (record what you find, do not assume)

- `faculty.router.ts:169`, `section.router.ts:267`, `section.router.ts:465` still read
  `schoolYearId = activeYear?.id ?? 1`. **Premise holds.** Section 465 already refuses a non-positive
  caller-supplied id with `INVALID_BODY`; the other two do not validate a caller-supplied id at all.
- `generation-preflight.service.ts` contains **no** `isPlaceholder` occurrence. **Premise holds.**
- `teaching-load-automation.service.ts:1209` is no longer the hire estimate — the file moved. The real site is
  **line 1257**: `recommendedNewHires = Math.round((concurrentMissingHoursPerWeek / (STANDARD_CAP_MIN / 60)) * 10) / 10`,
  which divides by the `STANDARD_CAP_MIN` constant while line 787 already resolves
  `policy?.teachingStandardMinutes ?? STANDARD_CAP_MIN`. **Premise holds, at the corrected line.**
- The "TOTAL MINUTES PER DAY" weekly total is confirmed at `workbook-export.service.ts:1064-1068` and
  `room-program-export.service.ts:215-219`. The in-code comment records this as a known successor
  (`docs/handoffs/a2-c5-building-occupancy-and-workbook-labels.md`). **Premise holds.**
- `timetable-generation-readiness.ts:302` reads `diagnostic.groups.length` unguarded. **Premise holds.**

## Slices

### S1 — server truth (`truth-fixes` §A8). Two BLOCKERs, then three rows.

**S1.1 — never default a school-year id in a write path.** `faculty.router.ts:169`, `section.router.ts:267`,
`section.router.ts:465`. When the caller supplies no `schoolYearId` and the EnrollPro active school year
cannot be resolved, fail closed with a typed error and **zero writes and zero downstream sync dispatch**.

- The refusal code is **NEW**: `ACTIVE_SCHOOL_YEAR_UNRESOLVED` does not exist anywhere at `f925045c`
  (`git grep` returns only this packet). Mark it new in the code comment. Its **shape** copies the existing
  unresolved-authority refusals — `ACTIVE_SCHOOL_YEAR_AMBIGUOUS` (asserted in
  `atlas-server/src/__tests__/active-term-live-resolution-c02.test.ts:370`) and the client vocabulary
  `ACTIVE_SCHOOL_YEAR_REQUIRED` (`atlas-client/src/pages/Subjects.tsx:171`). HTTP **409**, matching
  `ACTIVE_TERM_UNRESOLVED`.
- Its **authority** is Lane C's 17:25 ruling ("Fail closed with a typed error; never default a year id"), not
  a new contract grant. It refuses a write; it creates no new capability.
- Also add the missing caller-supplied-id validation to the two sites that lack it (`faculty.router.ts:165-166`,
  `section.router.ts:263-264`), using the shape `section.router.ts:456-461` already uses
  (`400 INVALID_BODY`, positive integer). Never substitute a year id.

**S1.2 — a placeholder-owned class is a third state (Lane C's ruling; the 17:25 BLOCKER).**
`generation-preflight.service.ts` ignores `isPlaceholder`, so a class sitting on a to-be-hired record is
indistinguishable from a class with a real owner. The contract:

- Three states, named as such: **real owner** / **on a to-be-hired teacher (placeholder)** / **open (no owner)**.
- A placeholder-owned class does **not** count as a real owner in readiness or coverage figures.
- It is listed **by name** (classes, not ids).
- It does **not** block generation (unchanged from A8 c3) and it does **not** block publication.
- An **open** class still blocks exactly as it does today. Do not widen the A8 c3 gap rules.
- Publication shows "N classes are on to-be-hired teachers" in words, with the names.

**The mechanism, because the word "advisory" already means the opposite in this codebase.** In ATLAS "advisory"
means *non-blocking for generation, still refused by publication*: `generation-blocker-groups.service.ts:69-73`
states that invariant, and every code in `POLICY_ADVISORY_VIOLATION_CODES` (`generation.service.ts:667-672`)
is also on `PROMOTABLE_CONSTRAINT_CODES` (`scheduling-policy.service.ts:181`). So a placeholder-owned class must
be a **distinct state with its own persisted code**, not a code added to either set:

- Emit a **new** code for a placeholder-owned class, named from the existing vocabulary
  (`SYNTHETIC_PLACEHOLDER` / "to-be-hired"; `faculty-assignment.service.ts:6136` already uses
  `SYNTHETIC_PLACEHOLDER`). It must be **absent** from `PROMOTABLE_CONSTRAINT_CODES` and **absent** from
  `POLICY_ADVISORY_VIOLATION_CODES`.
- `resolveUnassignedViolationCode` (`generation.service.ts:437`) must stop collapsing a placeholder-owned class
  into `LACKING_FACULTY`. `LACKING_FACULTY` stays in **both** existing sets, unchanged, so an **open** class
  still blocks publication exactly as today.
- **No membership may be removed from any existing set.** Removing one is a publication-gate relaxation
  outside this packet's authority, and a subtractive change to existing evidence (AGENTS.md 16).
- The run summary carries the placeholder-owned class count and names alongside the existing gap/advisory
  breakdown (`summarizeTeacherGaps`, `generation.service.ts:688`).

**S1.3 — the hire estimate uses the saved workload policy.** `teaching-load-automation.service.ts:1257`
must divide by the **resolved** policy standard minutes (the same value as line 787), not the
`STANDARD_CAP_MIN` constant. Control: a policy whose `teachingStandardMinutes` differs from the default must
change `recommendedNewHires`; a policy equal to the default must reproduce the base number.

**S1.4 — the exports label the weekly total as a week.** `workbook-export.service.ts` and
`room-program-export.service.ts`. The five day columns keep their per-day meaning; the total cell is the
five-day sum, so its label must say **per week**. Change the label only — the arithmetic and the day columns
are correct. Control: the export test must fail on base with the old label and pass on the fix.

### S2 — the client contract (the c5 packet itself)

**S2.0 (addendum 19:05) — guard `groups`.** `timetable-generation-readiness.ts:302` must treat a missing or
non-array `groups` as empty and take the legacy one-line fallback its own comment promises. Then re-pin
`a2-header-budget-2026-09-29.test.tsx` H4 state A (line 625) and state B (line 668), script
`test:ux-a2-header-budget` (that is already the committed name — there is no rename), **on purpose**: both
must keep their current labelled
behaviour, and both must now also render through the guard. Re-run the groups suite
`atlas-client/src/components/timetable/__tests__/a8-c3-generate-gaps-groups.test.tsx` (script
`test:a8-c3-generate-gaps`, the committed name) unchanged.

**S2.1 (rules 2 + 3) — every hard blocker code has a sentence and a route, and the test proves it.**
Build ONE shared, exported table of the hard blocker codes the preflight can emit, with, per code: the plain
sentence template, the count noun, the fix route, and the button label. It must be driven by the server's own
code inventory so it cannot drift, and it must be the single source used by both the group headline and the
repair resolver. Inventory at minimum (from `generation-preflight.service.ts` at `f925045c`):
`CANONICAL_SHAPE_CAPACITY_EXCEEDED`, `CANONICAL_SHAPE_VIOLATION`, `TL_NO_QUALIFIED_OWNER`,
`WORKLOAD_POLICY_BLOCK`, `ROOM_RESOURCE_UNAVAILABLE`, `POLICY_WINDOW_BLOCK`, `SEARCH_LIMIT_UNRESOLVED`,
`POLICY_UNINITIALIZED`, `TERM_AUTHORITY_STALE`, `TERM_AUTHORITY_UNRESOLVED`, `SECTION_SETUP_REQUIRED`,
`ROOMS_MISSING`, `TL_OWNERSHIP_CONFLICT`, `TEACHING_LOAD_REVIEW_REQUIRED`, `TL_DEMAND_UNCOVERED`,
`CANONICAL_TEMPLATE_INCOMPLETE`, `GRADE_WINDOW_MISSING`, `EMPTY_DERIVED_DEMAND`,
`FLAG_CEREMONY_SCOPE_INVALID`, plus the shape-policy codes reaching `classifyShapePolicyBlocker`
(`TERM_CACHE_MISSING`, `ROTATION_TERM_INVALID`) and every code `classifyDemandBlocker` can pass through.
**A code with no fix page is a defect:** give it the smallest real fix path, or make it advisory and write
the reason in the table. The test is table-driven with **a fixture per code** and must assert (a) every code
in the exported inventory has a non-empty sentence and a real mounted route, and (b) a code with no entry
fails — prove (b) with a failing-first control, or the test is vacuous.

**A source-text read is not visible proof.** The inventory-driven completeness test reads the server's
exported constant; on its own it proves only that the table matches the constant, never that a scheduler
sees a fixable line. Rows B1 and B2 are that proof and must not be dropped or merged into A7: A7 is the
source-level completeness control, B1/B2 are the rendered control.

**S2.2 (rule 1) — one line per root cause, one "Check again".** A8 c3 already renders this shape
(`SimpleGenerationBlockerGroups.tsx`). Keep it and make it correct against the S2.1 table: no per-row
repetition, no codes, counts in classes, ONE fix button per cause to the exact page/state, ONE "Check again"
for the panel. Nothing added to the region.

**S2.3 (addendum 20:05) — Generate is never greyed out.** The operator: "it should never be disabled."
In `timetable-capabilities.ts` the generation gate must be `enabled` in every state except `input.generating`.
Every condition that used to deny it — unresolved scope, `loading`, `blocked`, `unavailable`/`failed`,
`!generateAllowed || !zeroWrite`, `driftBlocked` — becomes a **stopper** the dialog explains, not a
disabled button. Clicking always opens the Generate dialog. The dialog says, in one plain line per cause with
a count, what truly prevents a timetable (no sections, no time periods, no subjects, school year out of sync),
each with one button that opens the exact place, plus "Check again". Never a greyed button with a tooltip.
A check that could not run retries **by itself once**, then says so plainly with a Retry button.
Table-driven test over **every** capability input: no state returns a disabled Generate except "run in
progress". Nothing that is only a warning may stop generation.

**This change is presentational, never a new server gate.** The canonical decision stays
`deriveGenerateDecision`, defined at `atlas-server/src/services/generation-blocker-groups.service.ts:217` and
called in production from `generation-readiness.service.ts:516`; it still refuses on its own terms, exercised
by `atlas-server/src/__tests__/generation-canonical-readiness-genc02.test.ts:366,385,422` (script
`test:server-suite`). "Always enabled" means the operator always gets the dialog and an honest list; it does
not mean the client became the only gate, and that server test must stay green and be re-run.

**S2.4 (rule 4) — publication names the classes in the same words.** The client publish refusal surface must
name placeholder-owned and open classes with the same sentence shape as S2.1, driven by the same table.

### S3 — `/subjects` cold load (addendum 20:10)

A scheduler waiting 20.5 s for `/subjects` thinks it is broken. Show the saved catalog immediately, refresh in
the background, and show a real receipt of what was served and when. Ordinary UI state only; no new
authority. The existing "Using saved data" copy on the subjects surface is the one to change — reuse the
existing receipt pattern, do not invent a second one.

## Acceptance rows — each names the harness that decides it

| # | Row | Harness | Decided by |
| --- | --- | --- | --- |
| A1 | No write path defaults a school-year id; unresolved → typed 409, zero writes, zero dispatch | `atlas-server/src/__tests__/a8-c5-active-year-fail-closed.test.ts` on a **disposable** DB via `npm run test:server-db` | executor, then QA |
| A2 | Placeholder-owned is a named third state: **not a real owner** and **listed by name** (both fail on base); blocks neither generation nor publication (preservation); **OPEN still blocks both** | `atlas-server/src/__tests__/a8-c5-placeholder-third-state.test.ts` (disposable DB) — the failing-first control is on "not a real owner" / "listed by name", which is where base is wrong; pair it with the **existing** OPEN-class refusal proof `atlas-server/src/__tests__/a8-c3-generate-with-gaps.test.ts:181-200` ("C3.11 SAFETY", script `test:a8-c3-generate-gaps`), which must stay green and must be re-run. The **open-class** half of the row (`LACKING_FACULTY` refused by
`countBlockingHardViolations`, `publication-contract.service.ts:117`) is asserted directly in the new
`a8-c5-placeholder-third-state` suite, because C3.11 itself exercises the three advisory codes rather than
the open class. | executor, then QA |
| A3 | Publication refusal names placeholder-owned classes in words | same server suite as A2, plus a client assertion in `atlas-client/src/components/timetable/__tests__/a8-c3-generate-gaps-groups.test.tsx` (script `test:a8-c3-generate-gaps`) | executor, then QA |
| A4 | `recommendedNewHires` follows the saved policy; a default policy reproduces the base number | `atlas-server/src/__tests__/a8-c5-hire-estimate-policy.test.ts` | executor, then QA |
| A5 | Both exports label the total per week; day columns unchanged | workbook: re-pin `atlas-server/src/__tests__/tt-output-c03r.test.ts:433` (the only existing assertion of `'TOTAL MINUTES PER DAY'`, and it must FAIL on base and PASS on the fix). room-program: **no existing suite pins that label** — `exportRoomProgramWorkbook` is imported by `published-immutability-c08.test.ts:137` and `tt-output-c05-beneficiary-parity.test.ts:34`, neither of which asserts the totals row. Add the label assertion to `tt-output-c05-beneficiary-parity.test.ts` (the parity suite that already owns that writer) and name it in the handoff. | executor, then QA |
| A6 | Missing `groups` takes the legacy fallback; H4 A/B re-pinned | `atlas-client/src/components/timetable/__tests__/a2-header-budget-2026-09-29.test.tsx` + the groups suite | executor, then QA |
| A7 | Every hard blocker code maps to a non-empty sentence and a real route; a missing entry FAILS | new table-driven client test, **one fixture per code**, with a failing-first control | executor, then QA |
| A8 | No capability input returns a disabled Generate except `generating`; each former denial is a named dialog stopper with a count and a fix route | new table-driven `timetable-capabilities` test over every input | executor, then QA |
| A9 | The blocker panel renders one line per cause, count in classes, one fix button, one "Check again" | `atlas-client/src/components/timetable/__tests__/a8-c3-generate-gaps-groups.test.tsx` (script `test:a8-c3-generate-gaps`), re-pinned for the S2.1 table **+** the staging screenshot (B1) | executor, then QA |
| A10 | `/subjects` paints the saved catalog immediately and refreshes behind it, with a receipt | a client test in `atlas-client/src/pages/__tests__/` covering `atlas-client/src/pages/Subjects.tsx` first paint, named and added to a committed client script in the same commit + the staging timing measurement (B3) | executor, then QA |
| G1 | `npm run test:encoding` passes | repo script | planner |
| G2 | server tsc + client tsc + client build | repo scripts | planner |
| G3 | `git diff --check` clean over the candidate range | git | planner |
| B1 | 1366x768 staging render of `/timetable` with the blocker panel: no truncation, no codes, no `…`, clickable things look clickable | **Browser row.** `scripts/dev/start-preview.ps1` + `/__dev/staging-login` + `scripts/qa/ux-audit.js` (major = 0, nothing under 14px) | **planner** (browser custody) |
| B2 | Each fix button opens the exact page/state it claims | **Browser row**, one per cause present on staging | **planner** |
| B3 | `/subjects` first paint is immediate; the receipt names what was served | **Browser row**, with a measured first-contentful time | **planner** |
| B4 | Force each of the top 4 blockers on a scratch year, screenshot, follow the button, fix, **generate**. "The top 4" is pinned here to the causes this packet names, so the row is not a judgement call: (1) **sections with no usable room** — `ROOMS_MISSING` / `ROOM_RESOURCE_UNAVAILABLE`; (2) **sections with no Teaching Load owner** — `TL_DEMAND_UNCOVERED` / `TEACHING_LOAD_REVIEW_REQUIRED`; (3) **no time window for a grade** — `GRADE_WINDOW_MISSING` / `POLICY_WINDOW_BLOCK`; (4) **term authority unresolved** — `TERM_AUTHORITY_UNRESOLVED` / `TERM_AUTHORITY_STALE`. Report which of the four the live staging data already presents (those need no forcing) and which had to be forced. | **DEPLOYMENT-ACCEPTANCE / HIGH row.** The forcing and the fix are ordinary UI mutations (§12) and are authorized; the **generate step is a generation run and is NOT authorized** — it goes to the operator. A cause that cannot be forced without a generation or an apply is reported `UNPERFORMED(reason)`, never `N/A`. | **planner + operator** |

## Throughput and hygiene

- Commit `wip(...)` to the branch and push at least every 30 minutes and before any long step.
- Never `git checkout --`, `reset --hard`, `clean`, or revert uncommitted work: `git stash push -u -m <why>` or
  commit it. Corrections are ADDITIVE new commits; never amend or rebase a handed-off commit.
- No helper scripts left in the tree; no PowerShell `Get-Content | Set-Content` round-trips on repo files.
- A changed or new test file must be reachable from a committed `package.json` script in the same commit.
- Never echo a credential; never read `D:\ATLAS-runtime-config\atlas-staging-qa.env`.
- Run no server or watcher in a foreground shell call; use `scripts/dev/start-detached.ps1`.
- Bare test runs never touch live: DB-writing suites only through `npm run test:server-db`.

## Deliverable

One candidate SHA on `work/a8-c5-generation-fixable` plus a one-page handoff:
base · candidate · exact changed paths · what changed and why · the decisive commands with their results ·
known risks marked `BLOCKING` / `NON_BLOCKING` · the A-row tally with each row's own result
(`passed` / `blocked` / `unperformed` + reason). No transcripts.
