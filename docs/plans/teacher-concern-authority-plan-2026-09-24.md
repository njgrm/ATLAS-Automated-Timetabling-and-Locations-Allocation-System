# Teacher-concern authority — plan (2026-09-24)

Status: **ACTIVE (Cycle 1 / S0 closed on commit of this file).** Operator decisions D1–D6 are
**locked as recommended** (operator, 2026-09-24). Cohorts are explicitly out of scope.

## Objective

Make the **scheduler** the single place that accommodates a teacher's preferences and availability —
**in draft and post-publish** — with those inputs genuinely affecting generated rows, and give
**SMART** read-only access to a teacher's **draft** schedule. Remove the ATLAS teacher portal; do not
hand teacher concerns to SMART.

## Locked decisions (D1–D11)

- **D1 — Semantics: both, staged.** `UNAVAILABLE` is a HARD exclusion with an explicit audited relax;
  `PREFERRED` is a ranked SOFT signal surfaced as non-promotable `SOFT` warnings. An availability
  authority binds only after scheduler review, and is validated against the teacher's required load so
  an "unavailable all week" submission is rejected as infeasible instead of silently blocking generation.
- **D2 — Persistence: new first-class authority.** Do **not** flip
  `ATLAS_ENABLE_LEGACY_TIME_PREFERENCES`. Add a term-scoped, reviewed, versioned availability authority
  (`FacultyAvailability` / `FacultyAvailabilitySlot`) and deprecate the legacy
  `faculty_preferences`/`preference_time_slots` write path. Migration required; the
  `GenerationInputSnapshot` version bumps and old runs fail closed `STALE`.
- **D3 — Draft exposure: teacher-scoped, authenticated, opt-in.** Faculty-scoped draft read keyed to
  `faculty-external-id`, authenticated by the companion-SSO/reverse identity, term- and run-scoped,
  fail-closed on an unresolved ordered term, gated by an explicit per-run **"Share draft with teachers"**
  toggle (default off). Never expose whole-school drafts.
- **D4 — Re-freeze: effective-dated identity deltas.** A revision may carry optional
  `identityOverrides` (term authority, special events, display slots, policy projection, class-program
  template) applied in effective-date order with the same consistency validation as the base freeze.
  Plus a bounded, audited, reason-required **withdraw/supersede** action (HIGH, separately gated).
- **D5 — Coupling: freshness-only + explicit regenerate.** No auto-regeneration. Fix the drift UI to map
  all seven domains, add an explicit "Regenerate to apply" affordance that preserves valid draft
  placements, and a read-only impact preview. Never auto-regenerate a published run.
- **D6 — Portal removal: confirmed.** Remove `/my/schedule`, `/my/preferences`, `/my/room-preferences`
  and their nav/footer entries; delete the dead notification deep links (`/preferences`, `/rooms`).
  SMART is view-only for teachers. **S3 is a prerequisite** for D6.
- **D7 — SMART draft-read auth (confirmed 2026-09-24).** The credential is the **companion integration
  key** (`ATLAS_SYSTEM_TOKEN` / `X-Integration-Key`); teacher scope is the `faculty-external` path
  parameter plus the per-run `draftSharedWithTeachers` toggle (default off). **No faculty-scoped token
  is minted.** Residual: a leaked key exposes every *shared* draft (never unshared, never whole-school).
  Revisit only if SMART ever calls ATLAS from the teacher's browser instead of server-to-server.
- **D8 — Break-window scope (approved).** Each `specialEvents[]` window gains an additive **`scope`
  set** (`appliesToAll`, `gradeLevels`, `programTypes`, `shift`) plus an additive
  **`source.shiftWindows[]`** grade→shift map. Row count is **unchanged** — the dedupe already collapses
  by window, so we only accumulate the scope set. Do **not** emit one row per grade.
- **D9 — Teacher lunch (approved).** Add `enableTeacherLunchWindow` + `enforceTeacherLunchWindow`
  (**SOFT by default, HARD switchable with an override**) to policy; a teacher keeps a free block over
  the lunch window of the grade band they teach (reusing the canonical grade-scoped lunch rows); the
  Teacher Program renders it. Absorbs `TEACHER-PROGRAM-LUNCH-BREAK-C01`.
- **D10 — Preferred grade levels (approved; persistent).** Optional per-teacher `preferredGradeLevels`
  in an **ATLAS-owned table keyed `(schoolId, facultyId)`** — **not** on the EnrollPro-synced
  `FacultyMirror`. **It does not reset on rollover** (no `schoolYearId` scope); schedulers edit it
  before assigning load. Empty = no preference. `autoFill` gains a **soft** preference tier and a new
  non-blocking reason `OUTSIDE_PREFERRED_GRADE`. **Advisory always overrides**: an adviser is always
  assignable to, and preferred for, their own advisory section's grade.
- **D11 — Shift coherence (approved).** A policy-switched guard against a teacher being assigned into
  **both** the morning and the afternoon shift window (`grade_shift_windows`). **Default SOFT**, HARD
  switchable, always overridable; diagnostics must name who spans and why. Preference alone does not fix
  the morning→evening pattern; this guard does.

## Current state (evidence, origin/main `cc72928c`)

- **No scheduler-facing availability writer exists.** The only persistence path is
  `FacultyPreference`/`PreferenceTimeSlot`, dropped unless `ATLAS_ENABLE_LEGACY_TIME_PREFERENCES=true`
  (`atlas-server/src/services/preference.service.ts:76-80`).
- **The "old page" is orphaned:** `atlas-client/src/components/faculty-shared/AvailabilityPicker.tsx`
  (drag-to-paint AVAILABLE/PREFERRED/UNAVAILABLE) has **zero importers**; removed in `f7df9cb0`
  (2026-05-28). `/faculty/preferences` (`OfficerPreferences.tsx`) and `/faculty/room-preferences`
  (`OfficerRoomPreferences.tsx`) are registered routes absent from the nav; the former states
  *"Teacher time availability is no longer collected here"* (`:675`).
- **Simple-timetable concern surfaces are indirect:** More menu → `Teacher leaving / Reassign load`,
  `Swap sessions`, `Place unresolved sessions`, `Review room requests` (`SimpleMoreMenuContent.tsx:72-102`);
  Tactical Sandbox shows `AvailabilityDeferredNotice` — *"no persisted faculty availability authority yet"*
  (`TacticalSandboxDock.helpers.ts:214`).
- **Generation consumes availability, but only `UNAVAILABLE`, and only if rows exist:** read at
  `generation-preflight.service.ts:754`, applied as a hard exclusion in `schedule-constructor.ts:1813-1868`,
  reused in `hybrid-scheduler.ts:649-681`. `PREFERRED` is read but inert; wellbeing booleans are persisted,
  change the fingerprint, and have no server consumer.
- **Policy change does not re-shape output:** `scheduling-policy.service.ts:1247` only saves; the run goes
  `STALE` by input fingerprint (`generation-input-snapshot.service.ts:99/420`) and publication is blocked
  (`publication-contract.service.ts:320-328`, 409 `PUBLICATION_INPUTS_STALE`). The client drift UI maps only
  5 of 7 domains, so `availability`/`derivedDemand` produce no fix chip (`timetableDriftRouting.ts:29-58`).
- **Post-publish direct edit is blocked** (409 `RUN_ALREADY_PUBLISHED`, `manual-edit.service.ts:241,492`).
  The only sanctioned change is a future-dated revision (`published-revision.router.ts:33-52,85`) that
  **does not re-freeze** identity (`published-revision.service.ts:565-571`); there is **no unpublish endpoint**.
- **No companion draft read exists.** Companions get only the public published GET family
  (`published-schedule.router.ts`); draft reads are JWT + `timetable:read` (`generation.router.ts:350-489`).
  Reusable producer: `generation.service.ts:getRunDraft/getLatestRunDraft` (`:1791/:1801`, `DraftReport` `:1754`).

## Streams

| # | Stream | Tier | Owns (disjoint) | Depends on |
|---|---|---|---|---|
| S0 | Interface freeze (this file) | LOW | `docs/**` | D1–D6 |
| S1 | TEACHER-AVAILABILITY-AUTHORITY | MEDIUM source / HIGH generation | `prisma/schema.prisma` + migration; `preference.service.ts`; `preference.router.ts`; `generation-preflight.service.ts`; `schedule-constructor.ts`; `hybrid-scheduler.ts`; `generation-input-snapshot.service.ts` | S0 |
| S2 | SCHEDULER CONCERN WORKSPACE (UI) | MEDIUM UI | `atlas-client/src/pages/**`; `components/faculty-shared/**`; `components/timetable/simple/**` (concern entry points); `navigation.ts`; `hooks/useNotificationInbox.ts` | S0 + S1 contract |
| S3 | SMART DRAFT READ | MEDIUM server / security-sensitive | new `atlas-server/src/routes/draft-schedule.router.ts`; `app.ts`; `docs/reference/*draft*`; SMART handoff doc | S0 |
| S4 | POST-PUBLISH MID-YEAR EDIT | MEDIUM-HIGH | `published-revision.service.ts`; `manual-edit.service.ts`; `components/timetable/simple/**`; `timetableDriftRouting.ts`; `lib/published-revision-client.ts` | S0 (+ D4 shape) |
| S5 | SPECIAL-EVENT-SCOPE-C01 | MEDIUM | `published-schedule.service.ts`; `schedule-constructor.ts` (`dedupeIntervalSlots`); tests; companion contract doc | D8 |
| S6 | TEACHER-LUNCH-POLICY-C01 | MEDIUM source / HIGH generation | `prisma/schema.prisma` + migration; `scheduling-policy.service.ts`/`router.ts`; `constraint-validator.ts`; `teacher-program-export.service.ts`; `docx-export.service.ts`; `SchedulingPolicyPane.tsx` | D9 |
| S7 | FACULTY-GRADE-PREFERENCE-C01 | MEDIUM | `prisma/schema.prisma` + migration; `teaching-load-automation.service.ts`; `faculty.router.ts`; `Faculty.tsx`/`FacultyRow.tsx`; new preference service | D10 |
| S8 | SHIFT-COHERENCE-C01 | MEDIUM / HIGH generation | `teaching-load-automation.service.ts`; `scheduling-policy.service.ts`; diagnostics | D11; **shares `autoFill` with S7 — sequence, do not parallelise** |

### Acceptance skeletons (executor packets fill these in)

- **S1:** persisted `UNAVAILABLE` makes generation leave the session unplaced with typed
  `FACULTY_SLOT_UNAVAILABLE` (failing-first mutant schedules inside the window); an unreviewed or
  infeasible authority cannot bind; `PREFERRED` changes ranking without changing HARD counts; the
  `availability` domain is present in the fingerprint and independently reported by the drift read.
- **S2:** a scheduler can open the concern workspace from the timetable **and** its own nav entry, record
  a teacher's availability grid + notes + room requests, review/approve them, and see the effect routed in
  the draft board and in the post-publish revision flow.
- **S3:** draft read returns only the authenticated teacher's own entries for one term/run; toggle-off,
  unauthenticated, foreign-teacher and unresolved-term all fail closed with typed codes; contract doc
  re-pinned off `5a333c74`.
- **S4:** a mid-year edit produces an effective-dated revision with identity deltas; read-back at a
  post-effective date returns the changed authority; attempt to mutate the base fails closed; withdraw is
  audited and reason-required.

## Cycle queue (keep current — this is the continuity index)

| Cycle | Lanes (parallel where shown) | State |
|---|---|---|
| C1 (S0) | interface freeze + decisions | **DONE** (`530e3b19`) |
| C2 | **S3** SMART draft read + contract corrections | **DONE** — integrated `e7ecd886`; QA `ACCEPT_READY` 8/8/0/0 |
| C3 | **S5** special-event scope ∥ **S6** teacher-lunch policy + export | **DONE** — integrated (`85ed33b6`+); QA `ACCEPT_READY` 6/6/0/0 after correcting the grade-ID recipe and gating 5 suites |
| C4a | **S7** faculty grade preference | **DONE** — integrated `885c9792`; QA `ACCEPT_READY` 8/8/0/0 |
| C4b | **S8** shift coherence (owns `teaching-load-automation.service.ts`; must follow S7) | **DONE** — candidate `ae79b45f`, merge `f37b8ea4`; QA `ACCEPT_READY` 19/19/0/0; migration `20260925000001_shift_coherence` unapplied |
| C5 | **S1** availability authority ∥ **S4-server** post-publish identity deltas | **DONE** — S1 `af3a24c5` + S4-server `d51a8f16` merged at `4e9acbf5`; QA `ACCEPT_READY` 16/16/0/0 and 9/9/0/0; migrations `20260925000002_faculty_availability` unapplied |
| C6 | **S2** scheduler concern workspace (client) ∥ **S4-client** drift/revision UX + D4 read-back | **DONE** — S2 `c403e743` + S4-client `ffbda016` merged together; QA `ACCEPT_READY` 12/12/0/0 and 9/9/0/0 |
| C7 | integration → deployment → two-viewport browser acceptance | **DONE** (deploy) — `066da7a7` LIVE 2026-09-25; `20260925000002_faculty_availability` applied (`MIGRATE_GATE_OK`, 10→11); post-action QA `ACCEPT_READY` 8/8/0/0; **browser acceptance deferred to Lane B (Codex)** |

Rules: one writer per lane, separate `E:` worktrees, disjoint files. `S7`/`S8` share
`teaching-load-automation.service.ts` → **sequenced**. D6 (teacher-portal removal) lands with **S2**,
**after** S3 (already integrated).

## Frozen contracts

### A. Availability authority (S1)

- Models: `FacultyAvailability` (school, year, faculty, termIndex, status, version, reviewedBy, reviewedAt)
  and `FacultyAvailabilitySlot` (day, startTime, endTime, state ∈ `PREFERRED|AVAILABLE|UNAVAILABLE`).
- Routes (scheduler JWT; capability `timetable:edit`; actor-school scoped):
  `GET/PUT /api/v1/faculty-availability/:schoolId/:schoolYearId/faculty/:facultyId`,
  `POST .../submit`, `PATCH .../review`.
- Reads for generation are **reviewed-only** and **term-scoped**; `UNAVAILABLE` is the hard set,
  `PREFERRED` the ranked set. Reject at review when the authority makes the teacher's required load
  infeasible (typed refusal).
- Fingerprint domain `availability` is the digest of reviewed slots for the active term.

### B. Draft read (S3)

- Mirror the published contract: term-scoped (`termIndex` required or `active`), run-scoped to a draft
  `COMPLETED`/`FULL` run, faculty-scoped by external id.
- Payload reuses `DraftReport` (already terminized via `ensureEntriesHaveTermIndex`).
- **Auth (§B superseded at integration 2026-09-24):** implemented as `authenticateWithSystemToken`
  (the companion integration key / `X-Integration-Key`), **not** as the originally frozen "reverse-SSO
  assertion or faculty-scoped draft token" and not with a literal ban on `ATLAS_SYSTEM_TOKEN`. Rationale:
  the credential is only the transport; **teacher scope is enforced by the `faculty-external` path
  parameter**, the whole-run family was removed (D3), and the per-run `draftSharedWithTeachers` toggle
  (default off) is the exposure boundary — so a holder of the key can read a draft only for a run the
  scheduler has explicitly shared. Residual: a leaked integration key exposes every *shared* draft
  (never unshared, never whole-school). Independent QA `ACCEPT_READY` 8/8/0/0 accepted this; operator
  confirmation of the supersession is requested.
- Gate: per-run `shareDraftWithTeachers` flag (default off). Fail-closed codes: toggle-off, unresolved
  term, unknown faculty, cross-faculty.

### C. Revision identity deltas (S4)

- `published_schedule_revisions.metadata.identityOverrides` — optional, effective-dated, same validator as
  the base freeze (`assertSnapshotConsistency`). Read path applies base freeze then overrides in
  effective-date order. History immutable; base never mutated.

## Risks

- S1's migration bumps the generation snapshot version → old runs read `STALE` until regenerated (intended).
- S3 is a new auth boundary → independent review + handwritten negative-control matrix.
- Removing `/my/schedule` (D6) without S3 landing first removes the teacher's only schedule view.
- Live schedule work (generation/publication/revision apply) stays HIGH and separately gated; the standing
  authorization bundles **source + deployment + browser acceptance**, not generation or publication.
