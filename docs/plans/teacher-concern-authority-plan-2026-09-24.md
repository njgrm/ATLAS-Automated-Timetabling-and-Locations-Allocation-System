# Teacher-concern authority — plan (2026-09-24)

Status: **ACTIVE (Cycle 1 / S0 closed on commit of this file).** Operator decisions D1–D6 are
**locked as recommended** (operator, 2026-09-24). Cohorts are explicitly out of scope.

## Objective

Make the **scheduler** the single place that accommodates a teacher's preferences and availability —
**in draft and post-publish** — with those inputs genuinely affecting generated rows, and give
**SMART** read-only access to a teacher's **draft** schedule. Remove the ATLAS teacher portal; do not
hand teacher concerns to SMART.

## Locked decisions (D1–D6)

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

## Cycles

1. **Cycle 1 (S0)** — freeze contracts + decisions; commit this file. *Done on commit.*
2. **Cycle 2 (parallel, 3 lanes)** — **S1** ∥ **S3** ∥ **S4-server**. Separate worktrees on `E:`, one writer
   each, disjoint files.
3. **Cycle 3 (parallel, 2 lanes)** — **S2 client** ∥ **S4 client** (drift-domain mapping rides here).
4. **Cycle 4** — integration → deployment → two-viewport browser acceptance (bundled under the standing
   authorization).

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
- Auth: companion identity (reverse-SSO assertion) **or** a faculty-scoped draft token; never a bare
  `ATLAS_SYSTEM_TOKEN` (system identity carries no schoolId and `authenticate` is JWT-only).
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
