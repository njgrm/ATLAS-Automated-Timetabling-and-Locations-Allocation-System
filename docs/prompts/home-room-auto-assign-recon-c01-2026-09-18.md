# HOME-ROOM-AUTO-ASSIGN-RECON-C01 — is the grade-scope behaviour a real defect?

- Stream: `HOME-ROOM-AUTO-ASSIGN-RECON-C01`
- Kind: `RECON`, read-only. Risk: `LOW`. No source change, no write, no deploy.
- Base: `2e20e8a6` (current `origin/main`)
- Worktree: none required. Read-only probe from
  `E:/ATLAS-worktrees/release-client-quality-01` (at `origin/main`).
- Recommended executor reasoning: `high` (the probe decides whether a fix is warranted).

## 0. Why this packet exists

The planner found the grade-scope match dimension **inert** but could not
establish that the resulting behaviour is wrong. Do not fix an unproven defect.

Verified at `2e20e8a6`:

- `atlas-server/src/services/home-room-auto-assign.service.ts:79-82`
  ```ts
  function buildingMatchScore(sectionGrade: number, buildingGradeScope: number[]): number {
    if (buildingGradeScope.length === 0) return 1; // any-grade
    if (buildingGradeScope.includes(sectionGrade)) return 2; // exact match
    return 0; // no match
  }
  ```
- Every `Building.gradeScope` is `[]`, so every building scores `1` and the match
  dimension never discriminates. Ordering falls through to
  `{ grade, sectionName, matchScore, buildingName, floor, floorPosition, roomName }`
  (`sortKey`, `:86-97`) — note `grade` and `sectionName` sort **first**, so
  sections remain grouped by grade regardless.
- `gradeScope` is already editable: `atlas-client/src/components/BuildingPanel.tsx`,
  `CampusMapEditor.tsx`; writable via `atlas-server/src/routes/map.router.ts`.
- `computeAutoAssign` supports `mode: 'preview'` (`:5`, `:99`) and only writes
  when `mode === 'apply'` (`:280-281`).
- Route: `POST /sections/home-rooms/:schoolYearId/auto-assign`
  (`atlas-server/src/routes/section.router.ts:219-258`), `authenticate` +
  `requirePrivilegedRole`.

## 1. The decisive test

For the active school year (upstream `enrollProSchoolYearId` **10**), call the
auto-assign route with `mode: 'preview'` and diff its proposed assignments
against the **persisted** home-room assignments.

Preview is zero-write. Assert and record the before/after signature
(home-room assignment rows) to prove nothing was written.

## 2. Verdict rules

- **No diff** → the current persisted assignment already matches what
  auto-assign would produce. The lane is **unconfigured data, not a defect**.
  Close it and record that `[]` is a deliberate any-grade scope. Do not open a
  fix packet.
- **Diff present** → a real defect exists. Record, for each differing section:
  section, grade, persisted room/building, proposed room/building, and the
  ordering field that decided it. Then return the evidence so the planner can
  author the fix packet with a proven failing case.
- **Preview unavailable / route rejects** → report the exact typed error and the
  minimum missing authority. Do not guess.

## 3. Also record (cheap, decides the fix shape)

- Whether any building has a non-empty `gradeScope` today (SQL read is fine).
- Whether `allowCrossGradeFallback` is passed by the real caller
  (`section.router.ts:258`) and what it changes.
- Whether the client surfaces an auto-assign preview to operators, and if the
  preview's proposed rooms are actually shown before apply.

## 4. Forbidden

- No `mode: 'apply'`. No write of any kind.
- No source edit, no commit, no deploy, no migration, no generation, no publication.
- No login beyond what the standing browser-QA authorization allows; if a
  privileged session is required and unavailable, report
  `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` with the exact missing authority.

## 5. Return contract

Return one compact report: the preview-vs-persisted diff (or its absence), the
zero-write before/after signature, the SQL/source reads actually performed, and
exactly one of:

- `NO_DEFECT_CONFIRMED` — close the lane;
- `DEFECT_CONFIRMED` — with the failing case evidence;
- `EXTERNALLY_BLOCKED(<reason>)` — with the missing authority named.

Do not author a fix in this packet.
