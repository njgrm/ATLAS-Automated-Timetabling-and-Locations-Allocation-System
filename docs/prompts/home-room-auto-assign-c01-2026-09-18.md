# HOME-ROOM-AUTO-ASSIGN-C01 — make building grade scope authoritative

- Stream: `HOME-ROOM-AUTO-ASSIGN-C01`
- Kind: `CYCLE`, source + one separately authorized config apply. Risk: `MEDIUM`
  source; the live `Building.gradeScope` write is a separate `HIGH`-gated apply.
- Base: `49aa4eaf` (current `origin/main`)
- Writable worktree: `E:/ATLAS-worktrees/home-room-auto-assign-c01` (planner-provisioned)
- Branch: `work/home-room-auto-assign-c01`
- Additive commits only.
- Recommended executor reasoning: `high`.
- Supersedes `docs/prompts/home-room-auto-assign-recon-c01-2026-09-18.md`
  (recon answered; that file is deleted by this packet's commit).

## 0. Proven defect (failing case captured live on 2026-09-18)

Auto-assign places **every section of every grade into the Grade 10 Academic
Wing**. Captured through the real route with `mode: 'preview'`,
`overwriteExisting: true` (zero writes) against the active year
(`schoolYearId` 10, `schoolId` 1):

| Grade | Proposed |
| --- | --- |
| 7 | `G10 Room 101..105 @ Grade 10 Academic Wing` |
| 8 | `G10 Room 201..205 @ Grade 10 Academic Wing` |
| 9 | `G10 Room 301..305 @ Grade 10 Academic Wing` |
| 10 | `G10 Room 401..405 @ Grade 10 Academic Wing` |

The **persisted** (manually set) assignment is per-grade correct — Grade 7 ->
Grade 7 Academic Wing, 8 -> 8, 9 -> 9, 10 -> 10 — so this is a real regression
that the manual data is masking. Changing the home rooms to blank and pressing
auto-assign **would destroy the correct assignment**.

### Mechanism (verified)

`atlas-server/src/services/home-room-auto-assign.service.ts:79-82`

```ts
function buildingMatchScore(sectionGrade: number, buildingGradeScope: number[]): number {
  if (buildingGradeScope.length === 0) return 1; // any-grade
  if (buildingGradeScope.includes(sectionGrade)) return 2; // exact match
  return 0; // no match
}
```

Live building state (`GET /api/v1/map/schools/1/buildings`):

| id | building | gradeScope | rooms |
| --- | --- | --- | --- |
| 1 | Grade 7 Academic Wing | `[]` | 20 |
| 2 | Grade 8 Academic Wing | `[]` | 24 |
| 3 | Grade 9 Academic Wing | `[]` | 20 |
| 4 | Grade 10 Academic Wing | `[]` | 20 |
| 5 | Science and Innovation Center | `[]` | 5 |
| 6 | MAPEH and Wellness Hub | `[]` | 4 |
| 7 | TLE and Livelihood Center | `[]` | 5 |
| 60 | Speech Lab | `[7,8,9,10]` | 0 |

Every academic wing is `[]`, so every building scores `1`. The `sortKey`
tiebreaker (`:86-97`) then falls to `buildingName`, and
`"Grade 10 Academic Wing"` sorts **before** `"Grade 7 Academic Wing"`
(`'1' < '7'`). Grade 10's 20 rooms are therefore offered first to every section,
and 20 rooms exactly absorb all 20 sections.

## 1. Required outcomes

**R1 — Deterministic, non-lexicographic ordering.**
The room/section ordering must not depend on lexicographic building name. Use an
explicit deterministic tiebreak chain — for example: exact grade scope, then
capacity fit, then natural (numeric-aware) building name, then building id, then
floor, then `floorPosition`, then room name/id. The same inputs must always
produce the same assignment regardless of insertion order.

**R2 — An any-grade building must not outrank a grade-specific one.**
`matchScore` 2 > 1 > 0 already encodes this; preserve it and prove it. Do not
"fix" the ordering by making `[]` mean "no match".

**R3 — Grade scope is the authoritative signal.**
When a building declares a scope, sections of that grade must prefer it. When
scope is `[]`, treat it as deliberately any-grade (that is correct for shared
facilities) — but it must never win over an exact match.

**R4 — Non-home-room facilities must not silently capture home rooms.**
The Science and Innovation Center, MAPEH and Wellness Hub, and TLE and
Livelihood Center hold specialist rooms. Decide and document explicitly whether
they are eligible for home-room assignment. If they are excluded, exclude them
by an explicit persisted signal (e.g. `isTeachingBuilding`/room type), not by a
name match. Record the decision in the packet's return.

**R5 — Preserve the correct current assignment.**
With the four wings scoped (see §2), a preview with `overwriteExisting: true`
must reproduce the persisted per-grade assignment exactly: 5 sections per wing,
no cross-grade leakage. This is the primary acceptance.

## 2. The config apply (separate, HIGH-gated — do NOT execute in this packet)

The source fix alone does not correct the live data. The four academic wings
must be scoped:

```
building 1 -> [7]   building 2 -> [8]   building 3 -> [9]   building 4 -> [10]
```

Deliver this as a **separate reviewed apply** with a preview, exact target,
before/after signature, and rollback (`set gradeScope = '{}'` for ids 1-4).
Do not bundle it into the source commit and do not run it without explicit
approval.

## 3. Production-path proof required

| # | Requirement | Negative control |
| --- | --- | --- |
| 1 | Scoped wings reproduce the per-grade assignment | Failing-first: with the current `[]` scope and the old tiebreaker, assert the all-into-Grade-10 result — the test must fail before the fix |
| 2 | Determinism | Shuffle room/section input order; assert identical output |
| 3 | Any-grade never outranks exact match | Two buildings, one exact one any-grade; assert the exact one wins |
| 4 | `mode: 'preview'` writes nothing | Before/after signature on `Section.homeRoomId`; assert zero delta |
| 5 | `mode: 'apply'` writes exactly the previewed set | Assert write count equals the previewed set, and no extra rows |
| 6 | Real route | `POST /api/v1/sections/home-rooms/:schoolYearId/auto-assign` with `authenticate` + `requirePrivilegedRole`; authority matrix (missing/invalid JWT, non-privileged role, cross-school actor, malformed body) → zero dispatch, zero writes |

## 4. Forbidden

- No live `gradeScope` write, no `mode: 'apply'` against the live database, no
  generation, no publication, no deployment, no migration.
- Do not edit `docs/plans/live-state.md`, the machine register, or `CHANGELOG.md`.
- Do not "fix" this by renaming buildings.
- Companion repositories remain READ_ONLY.

## 5. Return contract

Commit the bounded candidate and return `REVIEW_REQUIRED` with base SHA,
candidate SHA, exact changed paths, the requirement -> production path ->
negative control -> result table, the captured failing-first evidence, your R4
decision with its justification, and any `BLOCKED`/`DEFERRED` row named
explicitly. Executors do not self-accept, merge, or push.

## 6. Browser evidence

The auto-assign control is a rendered operator surface. Any client change
requires live Tailnet browser evidence with a `window.location.origin`
assertion. Read-only inspection only; do not press Apply.
