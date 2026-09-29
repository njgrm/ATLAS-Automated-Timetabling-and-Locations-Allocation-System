# A6-TL-DEMAND-SOURCE-C01 — Teaching Load reads the ONE demand source generation readiness reads

**Planner:** A6 (primary planner, DeepSeek V4.1 Flash). **Executor:** `atlas-executor-ds-delegate` (one writer, this worktree).
**Risk:** MEDIUM (server + client production wiring, cross-layer read path; **no** HIGH action unlocked).
**Worktree:** `E:/ATLAS-worktrees/lane-a6-tl-demand` · branch `work/a6-tl-demand-20260930` · base `origin/main` `c93bec03`.
**Trigger:** `docs/handoffs/lane-c-to-a2.md:4491` (Lane C → A6 + A8, 2026-09-30 01:15) and A8's gen post at `:4515`/`:4537`.
**Governing rules:** AGENTS.md §2, §3, §5, §11 (tests first, failing-first, production path), §13 (no HIGH action).

## 1. The defect, in the operator's words

Live is 2026-2027 (EnrollPro year 5). The operator confirmed 4 real AP gaps (Mabini G7 SPS, Makatao G8 STE,
Orchid G9 REG, Gold G10 SPA) and hand-assigned them. Before that, "Apply suggested teaching load" had finished and
the Teaching Load header read **100% staffed** — while generation readiness saw the 4 AP gaps.

## 2. Root cause (name it in the commit and the handoff)

Teaching Load **re-derives its own section/subject pair universe** instead of consuming canonical derived demand.
Three sites each build their own universe:

1. `atlas-server/src/services/faculty-assignment.service.ts` — `getAssignmentSummary` builds `teachablePairSet`
   (around `:5771-5782`) from `activeSubjects` (local `subject.findMany({isActive, code≠HG})`) ×
   `currentYearSectionScope`, where the **section grade is the mirror's `displayOrder`** (`:5666`
   `gradeLevel: section.displayOrder`) and the program is `programType ?? 'REGULAR'`.
2. `getActiveSubjectCoverageSummary` / `getRelevantSectionIdsForSubject` (`:1800`, `:1135-1146`) — the **suggestion's
   candidate set** — uses the SAME predicate.
3. `atlas-client/src/components/faculty-assignments/teachingLoadOutage.ts` — `isSectionSubjectApplicable` /
   `buildSubjectShortage` walk `subjects × sections` with `subject.gradeLevels.includes(section.displayOrder)` — the
   **class list** and `See who needs a teacher` window.

Generation readiness does NOT use any of these. It derives demand canonically via `buildDerivedDemand` →
`deriveCanonicalDemand` (`derived-demand.service.ts`) and counts coverage with
`summarizeTeachingLoadCoverage` (`generation-preflight.service.ts:602`), keyed `${subjectId}:${sectionExternalId}`,
where the **section grade is `resolveSectionGradeLevel` (the EnrollPro grade NAME; `grade-level-resolver.ts:184`,
which deliberately does NOT read `displayOrder`)**. The repo already records `displayOrder` as presentation only and
seeds `displayOrder = 9` against `gradeLevelName = "Grade 7"` in `teaching-load-carry-forward-postgres.test.ts`.

**Therefore:** wherever a section's resolved grade (grade name) differs from its mirror `displayOrder`, or the two
predicates disagree, TL omits a pair readiness requires. The `% staffed` denominator and the suggestion skip it, so
after Apply TL reads **100% staffed** while readiness still lists the pair missing. This is a *second truth* defect,
not a rounding bug.

## 3. The ONE fix

Make Teaching Load read **one** canonical demand pair set — the same one readiness reads — at all three sites.

1. **Single source (server).** Add an exported read-only helper in `derived-demand.service.ts`, e.g.
   `resolveTeachingLoadDemandPairs(schoolId, schoolYearId, deps?)`, that runs `buildDerivedDemand(...)` and returns
   either `{ ok: false; blockers }` or `{ ok: true; revision; pairs: Array<{ subjectId; sectionExternalId;
   sectionMirrorId; subjectCode; gradeLevel; programType }>; totalPairs }`. Key pairs exactly as readiness does
   (`deriveCanonicalDemand`'s `teachingLoadPairs`). Zero writes, no new endpoint.
2. **`getAssignmentSummary`.** Replace the `teachablePairSet` walk with the canonical pair set. Map
   `sectionExternalId` → the section id TL already uses. **Fail closed:** when canonical demand is unavailable
   (`TERM_STRUCTURE_UNAVAILABLE`/other blockers), do NOT fabricate 100% — surface a typed readiness status on the
   summary (e.g. `teachingLoadDemandReady: false` + blockers) and let the client render "cannot check" rather than a
   percentage. Never a `0`/`100` invented figure.
3. **`getActiveSubjectCoverageSummary`.** Key `relevantSectionCount` / `ownedSectionIds` / `uncoveredSections` off
   the same canonical pairs, so **Apply suggested teaching load covers every pair readiness requires** (the 4 AP
   pairs would have been candidate rows).
4. **Client class list / `% staffed`.** The header figure and the "class list"/`See who needs a teacher` list read
   the server's canonical figures. Delete the client's independent demand walk (`isSectionSubjectApplicable` /
   `buildSubjectShortage`'s subject×section enumeration) as the *demand universe*; if a fallback is kept it must be
   clearly non-authoritative and must never produce a percentage or an "every class has a teacher" claim.
   `buildStaffingTruthFigures` arithmetic itself may stay.

Keep the existing placeholder / unowned / real-teacher semantics and every A6 c5/c9 label contract intact.

## 4. Failing-first fixture (MANDATORY, must fail on the base commit)

DB-backed, disposable database only — `atlas_restore_drill_*` naming, started through the repo's documented
disposable-DB path (§5/§13). Do NOT use `D:/ATLAS/atlas-server/.env` or any live DB.

Fixture, minimal and deterministic:
- sole active, non-archived school year at `(schoolId, schoolYearId)`; verified 3-term `termContractCache` on
  `enrollProSchoolYearMirror`; a `schedulingPolicy` row so `deriveCanonicalDemand` returns `ok`.
- one section whose **resolved grade name is "Grade 9"** and whose mirror **`displayOrder` is NOT 9** (use 12):
  `gradeLevelName "Grade 9"`, `displayOrder 12`, `programType 'REGULAR'`, `isActiveForScheduling true`,
  `isStale false`.
- AP subject: `code 'AP'`, `gradeLevels [9]`, `programScopes ['REGULAR']`,
  `schedulingDisposition 'SCHEDULED_TEACHING'`, `isActive true`, `minMinutesPerWeek 240`.
- **no** ownership row for `AP : thatSection`.
- enough other owned pairs that the old figure is exactly `100` (so the defect is "100% while a pair is missing",
  not a small-fraction rounding).

Assertion, before → after (same test, run against base then candidate):
- BASE: `getAssignmentSummary(...).coverageTotals.totalPairs` **excludes** the AP pair and `unassignedPairs` is
  such that `buildStaffingTruthFigures` reports `staffedPercent === 100`; `buildGenerationReadiness(...)` /
  `summarizeTeachingLoadCoverage` reports `requiredPairs` **including** it and `missingPairs >= 1`. Report both
  numbers literally in the commit body.
- FIXED: `summary.coverageTotals.totalPairs === readiness.teachingLoadCoverage.requiredPairs` (the universe is
  single-sourced), the AP pair is present in TL, and it appears among the suggestion's candidate/uncovered rows.
- A mutant control: reverting only the `getAssignmentSummary` universe (keeping displayOrder) must turn the row red
  (restore byte-exact with `git hash-object` == `git rev-parse`).

Also add a pure unit row if the canonical pair mapping has a transform, and a parity row on a second program shape.

## 5. Acceptance rows (each names its harness)

| # | Row | Harness |
| --- | --- | --- |
| R1 | Failing-first: base omits the pair and reports 100%; readiness requires it | disposable-DB node:test |
| R2 | After: `summary.totalPairs === readiness.requiredPairs` on the fixture | disposable-DB node:test |
| R3 | After: the suggestion candidate set contains the AP pair (relevant/uncovered row) | disposable-DB node:test |
| R4 | Fail-closed: canonical demand unavailable → typed status, never a fabricated percentage | disposable-DB node:test |
| R5 | Client class list / header render the server figures; no independent subject×section demand walk remains for the universe | jsdom/unit + source assertion on the deleted predicate |
| R6 | Preservation: A6 c5/c6/c9/c10 existing suites still pass; `test:server-suite` green | committed scripts |
| R7 | Mutant/revert discriminates (R1 red on revert, byte-restored) | disposable-DB node:test |
| R8 | Zero-write: no new writes on the read path | disposable-DB node:test |
| R9 | Every new/changed test file is reachable from a committed `package.json` script (§11) | `gate-reachability` |

## 6. Boundaries

- Server + client source and tests only. No migration, no prisma schema change, no generation, no publication, no
  deploy, no sign-in, no live/shared-DB write, no companion repo, no runtime/env/task change.
- Do not touch `docs/plans/live-state.md` or `docs/handoffs/lane-c-to-a2.md`.
- Do not widen into generation-side classification (A8 c5 already did that) or into the term-cache apply.
- Commit conventional; one candidate commit; push the branch. Handoff ≤ 1 page into `docs/handoffs/`.
- Worktree disposition for this cycle: `RETIRE_AFTER_INTEGRATION`; junction removed with `cmd /c rmdir` first.

## 7. Evidence required from the executor

One commit + one short handoff: base SHA, candidate SHA, changed paths, the literal failing-first numbers
(`100` vs `missingPairs N`), the failing-first command and result on base and candidate, the mutant result, the
gate tallies, and every known risk marked `BLOCKING`/`NON_BLOCKING`. No transcripts.
