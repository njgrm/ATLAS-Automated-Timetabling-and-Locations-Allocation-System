# S1 — TEACHER-AVAILABILITY-AUTHORITY packet (2026-09-25)

Program: `docs/plans/teacher-concern-authority-plan-2026-09-24.md` — stream **S1**, decisions **D1/D2**,
cycle **C5** (lane A of two; runs in parallel with S4-server). Read the plan doc and
`docs/reference/agent-verification-gates.md` before editing. The frozen contract is the plan doc
**§A (Availability authority)** plus this packet; where they differ, this packet wins.

- Base SHA: `6d3ce4b4c88dd38aa30b4c08ff0d1078760450bd`
- Worktree / branch (single writer): `E:/ATLAS-worktrees/teacher-availability-s1` / `work/teacher-availability-s1`
- Tier: **MEDIUM source / HIGH generation**. Generation, migration apply, publication and deployment are
  **not** authorized. Migration is authored and `prisma validate`d only.

## 1. Objective

Make a term-scoped, reviewed, versioned availability authority the single source generation consumes for
a teacher's `UNAVAILABLE` (HARD exclusion) and `PREFERRED` (ranked SOFT) signals, replacing the legacy
`FacultyPreference`/`PreferenceTimeSlot` generation read. Do **not** flip
`ATLAS_ENABLE_LEGACY_TIME_PREFERENCES`; leave the legacy service in place (deprecated, no generation
consumer) so existing fixtures do not break.

## 2. Owned paths (edit only these)

- `prisma/schema.prisma` — add `FacultyAvailability` and `FacultyAvailabilitySlot` (plan §A shapes)
- `prisma/migrations/20260925000002_faculty_availability/migration.sql` (new, additive only)
- `atlas-server/src/services/faculty-availability.service.ts` (new)
- `atlas-server/src/routes/faculty-availability.router.ts` (new)
- `atlas-server/src/app.ts` — register the new router only
- `atlas-server/src/services/preference.service.ts`, `atlas-server/src/routes/preference.router.ts` —
  deprecation only (no generation consumer; do not delete models or break the legacy routes)
- `atlas-server/src/services/generation-preflight.service.ts` — swap the availability read
- `atlas-server/src/services/schedule-constructor.ts` — consume the new authority
- `atlas-server/src/services/hybrid-scheduler.ts` — consume the new authority
- `atlas-server/src/services/generation-input-snapshot.service.ts` — `availability` domain source
- `atlas-server/src/__tests__/faculty-availability-s1.test.ts` (new)
- `atlas-server/package.json` — add only your own `test:faculty-availability` line (never reorder/remove)

## 3. Frozen contract

Per plan §A: models `FacultyAvailability` (school, year, faculty, termIndex, status, version,
reviewedBy, reviewedAt) and `FacultyAvailabilitySlot` (day, startTime, endTime, state ∈
`PREFERRED|AVAILABLE|UNAVAILABLE`). Routes (scheduler JWT, capability `timetable:edit`, actor-school
scoped): `GET|PUT /api/v1/faculty-availability/:schoolId/:schoolYearId/faculty/:facultyId`,
`POST .../submit`, `PATCH .../review`. Generation reads **reviewed-only** and **term-scoped**;
`UNAVAILABLE` is the hard set, `PREFERRED` the ranked set. The `availability` freshness domain digests
the reviewed slots for the active term.

Concrete insertion points verified on base: `generation-preflight.service.ts:754` reads
`client.facultyPreference.findMany(...)` and threads `preferences` into the constructor;
`schedule-constructor.ts:1857 buildUnavailableTimeRanges` applies `UNAVAILABLE` ranges and
`FACULTY_SLOT_UNAVAILABLE` already exists as an `UnassignedItem['reason']` (`:1351`) consumed at
`generation-preflight.service.ts:406`; `hybrid-scheduler.ts:649-681` reads the same slot set. Route the
new authority through these exact points and reuse `FACULTY_SLOT_UNAVAILABLE` — do not invent a new code
unless a distinct meaning requires it.

## 4. Acceptance rows

1. **Failing-first (gate 2):** on the packet base a submitted+reviewed `UNAVAILABLE` window does not
   exist; on the candidate it makes generation leave the session unplaced with `FACULTY_SLOT_UNAVAILABLE`
   (mutant that schedules inside the window must fail).
2. **Binding:** only `reviewed` authorities bind; `submitted`/unreviewed does not affect generation.
   Term-scoped to the active ordered term; an unresolved term fails closed (never defaults to Term 1).
3. **Infeasible authority:** at review, an authority that makes the teacher's required load infeasible is
   rejected with a typed 4xx and **zero writes**.
4. **Semantics:** `PREFERRED` changes ranking only — HARD counts unchanged; `UNAVAILABLE` remains a HARD
   exclusion; the explicit audited relax path still works.
5. **Freshness:** the `availability` domain digest comes from the reviewed new-authority slots; a
   persisted reviewed edit changes the run fingerprint. State honestly whether
   `GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION` must bump; if it does not, say why the domain change alone
   is sufficient.
6. **Authority:** routes are actor-school scoped; cross-school 403; unauthenticated 401; no `?? 1`
   default; rejection writes nothing (gate 6).
7. **Legacy:** `ATLAS_ENABLE_LEGACY_TIME_PREFERENCES` is not flipped; the legacy service still
   compiles/works but is no longer a generation consumer.

## 5. Do NOT touch

- `published-revision.service.ts`, `manual-edit.service.ts`, `published-revision.router.ts` (S4-server lane).
- `atlas-client/**` entirely (client mapping is C6/S4-client).
- `scheduling-policy.service.ts`, `teaching-load-automation.service.ts`, `constraint-validator.ts` (S6/S8/S1-adjacent; do not re-open).
- Existing migrations under `prisma/migrations/**`; `CHANGELOG.md`; `docs/plans/**` (planner-owned).
- Runtime dirs, `D:\ATLAS`, companion repos, other worktrees. No generation, publication, migration
  apply, deployment, or login.

## 6. Required checks

- Author the migration additively; `npx prisma validate` only. Do **not** run `migrate`, `migrate deploy`,
  or `db push` against any database. The disposable-DB harness (ephemeral `atlas_restore_drill_*`) is
  authorized for `test:server-db` if you add a DB row, and only there.
- Register the new suite as `test:faculty-availability`; `test:server-suite` (which runs
  `gate-reachability`) must stay green.
- Enumerate consumers mechanically (gate 9): `facultyPreference`, `preferenceTimeSlot`,
  `buildUnavailableTimeRanges`, `FacultyPreferenceInput`, `preferences` in the generation chain; report
  every fixture that must change and update it **additively** — never weaken or delete an assertion.
- Commands: `npm run test:faculty-availability`, `npm run test:server-suite`, `npm run build`,
  `git diff --check` (from `atlas-server` where applicable).

## 7. Evidence

Commit only the owned paths on `work/teacher-availability-s1`. Do not push; do not touch `main` or other
branches. If you approach your step limit, commit a coherent candidate and report its exact state.
Handoff: base SHA · candidate SHA · changed paths · what changed and why · decisive commands with
results · consumer enumeration (search + affected fixtures) · each risk `BLOCKING`/`NON_BLOCKING` ·
verdict `REVIEW_REQUIRED`. Then a fresh independent `atlas-qa` reviews the immutable range, and only then
does the planner integrate. `atlas-server/package.json` is shared with the S4-server lane and is resolved
by union at integration — add only your own line.
