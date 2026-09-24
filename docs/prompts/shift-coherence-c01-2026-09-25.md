# S8 — SHIFT-COHERENCE-C01 packet (2026-09-25)

Program: `docs/plans/teacher-concern-authority-plan-2026-09-24.md` (stream **S8**, decision **D11**,
cycle **C4b**). Read the plan doc; do not restate it. Read `docs/reference/agent-verification-gates.md`
and `docs/reference/agent-timetable-invariants.md` before editing.

- Base SHA: `63efb62e6f494118deb0334c5cf138eaaf121422`
- Worktree / branch (single writer): `E:/ATLAS-worktrees/shift-coherence-s8` / `work/shift-coherence-s8`
- Tier: **MEDIUM source / HIGH generation**. Generation, migration apply, publication and deployment
  are **not** authorized here.

## 1. Defect and objective (D11)

`autoFill` (`teaching-load-automation.service.ts`) is grade- and shift-blind, so it can assign one
teacher to a grade-7/8 section (shift window `06:00–15:30`) **and** a grade-9/10 section
(`09:45–18:30`) — a `06:00–18:30` duty day, which exceeds the DepEd 8-hour service day. S7 preferred
grades only *bias*; this guard *prevents*. Add a policy-switched coherence guard that flags (SOFT,
default) or blocks-in-autoFill (HARD, switchable), is **always overridable** by manual assignment, and
**names who spans and why** — it must never silently block generation.

## 2. Owned paths (edit only these)

- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/scheduling-policy.service.ts`
- `prisma/schema.prisma` — only the two new `SchedulingPolicy` columns
- `prisma/migrations/20260925000001_shift_coherence/migration.sql` (new file, additive only)
- `atlas-client/src/components/SchedulingPolicyPane.tsx` — only the two new toggles + copy
- `atlas-server/src/__tests__/shift-coherence-s8.test.ts` (new)
- `atlas-server/package.json` — only the new `test:shift-coherence` script

## 3. Frozen contract

### 3.1 Policy (mirror S6/D9 exactly)

Add two `SchedulingPolicy` booleans: `enableShiftCoherenceGuard` (default **true**) and
`enforceShiftCoherenceGuard` (default **false**). Mirror `enableTeacherLunchWindow`/
`enforceTeacherLunchWindow` in every place it appears: `POLICY_DEFAULTS`, `SchedulingPolicyData`,
`validatePolicyInput` (boolean, typed errors `enableShiftCoherenceGuard must be a boolean` /
`enforceShiftCoherenceGuard must be a boolean`), the read projection, and the pane toggle pattern
(`enable` off forces `enforce` off). Copy must say SOFT by default and that HARD blocks publication-
relevant outcomes; one plain-language help line.

### 3.2 Shift authority

Resolve windows from `grade_shift_windows` for `(schoolId, schoolYearId)`. The numeric grade is the
section's **`displayOrder`** (never an EnrollPro `gradeLevelId`). For a section, resolve its window as
the exact `(gradeLevel, programType)` row when present, else the `(gradeLevel, programType = null)` row;
when neither exists the section has **no** shift authority and is **excluded** — never fabricate a
window.

### 3.3 Span rule (deterministic)

For a faculty, let `W` be the set of **distinct** resolved windows across their sections (already
assigned plus the candidate section under consideration). A faculty **spans** iff:

```
W.length >= 2  AND  no single window in W has both the minimum start and the maximum end of W
```

i.e. the union extent `[min start, max end]` is not itself one of the assigned windows. This flags
`06:00–15:30` + `09:45–18:30` (union `06:00–18:30`) and does **not** flag G7+G8 (identical windows).

### 3.4 Behaviour

- `enable=false`: guard off — **zero** notices, **zero** shift-coherence rejections, behaviour
  byte-identical to base.
- `enable=true, enforce=false` (**SOFT**, default): assignment proceeds unchanged; emit a bounded
  `shiftCoherenceNotices[]` on `AutoFillResult` and a human `warnings` line. No rejection, no coverage
  change.
- `enable=true, enforce=true` (**HARD**): `autoFill` must not select a candidate whose acceptance
  creates a span **while a non-spanning candidate remains**; rejected candidates get the new typed
  `TeachingLoadCandidateRejectionReason` `SHIFT_COHERENCE_CONFLICT`. When *no* non-spanning candidate
  exists the row goes **unresolved** with that typed reason — never a thrown/blocking error.
- **Always overridable:** the guard gates `autoFill` candidate selection only. Manual assignment and
  the reviewed proposal-apply path are not gated (state this explicitly in the service comment).

### 3.5 Diagnostics name WHO and WHY

Each notice/rejection carries: faculty `id` + name, the spanning windows (`gradeLevel`, `programType`,
`startTime`, `endTime`), and the responsible sections (`id`, `name`, `gradeLevel`). Bound the collection
with the existing `MAX_CANDIDATE_REJECTIONS` pattern. Never emit an unlabelled or aggregate-only count.

### 3.6 Ranking and S7 boundary

When `enable=true`, prefer non-spanning candidates as a **soft** rank signal. Do **not** change S7's
`evaluateGradePreferenceMatch`, the `OUTSIDE_PREFERRED_GRADE` advisory, or its unconditional-advisory
behaviour. Do not reorder `compareCoverageCandidateRank` in a way that changes S7 outcomes.

## 4. Do NOT touch

- `atlas-server/src/services/constraint-validator.ts` — the timetable-level concern is not this guard.
- `generation-preflight.service.ts`, `schedule-constructor.ts`, `hybrid-scheduler.ts`,
  `generation-input-snapshot.service.ts`, `preference.service.ts`, `preference.router.ts` (S1).
- `published-schedule.service.ts` (S5).
- S7 surface: `faculty-grade-preference.service.ts`, `faculty.router.ts` preference routes, client
  `Faculty.tsx` / `FacultyRow.tsx`.
- Existing migrations under `prisma/migrations/**` (add a new one only).
- Any file under `atlas-client/src/pages/**`; any runtime dir; `D:\ATLAS`; companion repos; other
  worktrees; `docs/plans/live-state.md` and the plan doc (planner-owned).
- No generation, publication, migration apply, deployment, login, or live-data action.

## 5. Required checks

1. **Failing-first (gate 2):** a control that fails on base — e.g. guard off accepts a G7+G9 teacher
   with no notice; and a mutant that deletes the span check accepts the same teacher under HARD.
2. **Consumers (gate 8/9):** mechanically grep the test tree for `autoFill`,
   `simulateRealFacultyCoverage`, `findBestCandidateForMode`, `preferenceNotices`, and the scheduling-
   policy consumers; report the search performed and every fixture the new default could change. A
   fixture that stops satisfying the guard is a regression you must name.
3. **Snapshot/freshness:** report whether the scheduling policy feeds `GenerationInputSnapshot`/
   `generation-input-snapshot.service.ts`; if so state that existing runs may read `STALE` (expected,
   not a defect). Do not run generation.
4. **Migration:** additive `ALTER TABLE ... ADD COLUMN ... BOOLEAN NOT NULL DEFAULT ...`; `prisma
   validate` only. Do **not** run `migrate`, `migrate deploy`, or `db push`. Do not edit existing
   migrations.
5. **Test registration:** register the new suite as `test:shift-coherence`; confirm `gate-reachability`
   (run inside `test:server-suite`) still passes so no `src/**/*.test.ts` is unreachable.

Commands (run from `atlas-server` where applicable):

```
npm run test:shift-coherence
npm run test:faculty-grade-preference     # S7 preservation
npm run test:server-suite                 # gate-reachability + hermetic
npm run build
git diff --check
```

## 6. Evidence (one commit, one short handoff)

Commit **only** the owned paths on `work/shift-coherence-s8`. Do **not** push, and do not touch `main`
or any other branch. Handoff: base SHA · candidate SHA · exact changed paths · what changed and why ·
decisive commands actually run with results · each risk marked `BLOCKING`/`NON_BLOCKING` · verdict
`REVIEW_REQUIRED`. One page; no transcripts. Then a fresh independent `atlas-qa` reviews the immutable
range `<base>...<candidate>`, and only then does the planner integrate.
