# GENERATION-AUTHORITY-REALISM-C07 — planner packet (bounded source correction)

- **Role:** `ROLE: EXECUTOR` (bounded implementation; returns `REVIEW_REQUIRED`; never self-accepts)
- **Recommended reasoning variant:** `high` — the packet crosses several tightly coupled
  production authorities (persisted policy special events, canonical shape contracts, the real
  constructor, the constraint validator, the generation freshness snapshot, and the real trigger).
  Disclose any lower-variant substitution in the return.
- **Cycle:** `GENERATION-AUTHORITY-REALISM-C07` (machine register `docs/plans/atlas-delivery-cycles.json`; the stream record is appended by the `create-stream` transition on top of register revision 114)
- **Worktree:** `E:/ATLAS-worktrees/generation-authority-realism-c07`
- **Branch:** `work/generation-authority-realism-c07`
- **Accepted base SHA:** `750cafcbc8b5beeb3e1815a60147e2431dce0c45` (`origin/main` tip at packet finalization; the packet commit sits directly on this base, so the reviewed range is `750cafcb...<candidate>` and includes this packet file). The cycle's registration observation recorded the earlier tip `4160028f...`; the newer tip is the actual review base.
- **Risk tier:** MEDIUM (source/tests only; every live, HIGH, schema, and data action is forbidden)
- **Dependency gate:** none. No other active stream owns these paths.
- **PLANNER_SESSION_ROUTE:** `EXISTING` (this cycle's planner chat — primary planner owns packet, verification, integration, closure)
- **EXECUTOR_SESSION_ROUTE:** `FRESH_REQUIRED` (bounded C07 implementation in a fresh context on the cycle worktree)
- **QA_SESSION_ROUTE:** `FRESH_REQUIRED` (fresh independent QA over the frozen candidate)

---

## 1. Objective

Make ATLAS generation truthful and realistic for the primary beneficiary by correcting, in one
coherent contract:

1. threading **persisted `PolicySpecialEvent`** authority into both the shared shape-contract
   assembly and the **real constructor input**;
2. rendering the **Monday Flag Ceremony/HGP as a day-scoped overlay on the configured underlying
   advisory-section period** with **no added ordinary demand, minutes, or period slots**;
3. **rejecting explicit non-Monday Flag/HGP authority** with a typed blocker instead of silently
   reinterpreting it;
4. making **room authority data-driven** so the primary beneficiary's Science rotation resolves to
   `CLASSROOM` with **zero laboratory occupancy** and **zero laboratory-derived warnings**, while a
   school-scoped explicit `LABORATORY` authority still reserves a laboratory;
5. emitting `ROOM_TYPE_MISMATCH` **only when the preferred room genuinely could not be used**, with
   an auditable machine-readable reason;
6. carrying **actual persisted faculty availability time slots** into the real trigger instead of
   `timeSlots: []`;
7. adding **availability/preferences to the generation freshness snapshot**, bumping the snapshot
   contract, and failing older runs **closed as stale**.

The primary beneficiary does **not** schedule laboratory occupancy in the weekly class timetable.
Laboratory use is on demand and coordinated internally. ATLAS must not infer laboratory scheduling
from a Science subject name or code, from `rotationFamily=SCIENCE`, from the existence of
laboratory rooms, or from required curriculum content.

## 2. Governance and authority to read (do not rewrite)

- `AGENTS.md` (worktree root; `origin/main` version; git blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`;
  LF-normalized SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`;
  raw SHA-256 `d7154367368cc53875d1cf56024490e7f464a73a237b1fa3ad8c950e0333e9b3`). The harness has
  injected it; read targeted headings only.
- `docs/reference/atlas-beneficiary-output-contract.md` §1 items 6–9, §3.1 — HG is not standalone
  demand; **Flag Ceremony/HGP is a Monday-only overlay on the underlying advisory-period slot and
  must not occupy the Tuesday–Friday cells**; ARAL absent; AP ordinary.
- `docs/reference/timetable-dynamic-workspace-and-warning-contract.md` — "Flag Ceremony/HGP is a
  Monday-only overlay on the underlying advisory period; it must never become a five-day event or
  extra load"; typed stale state must be shown, never silently refreshed.
- `docs/reference/atlas-runtime-source-of-truth-map.md` — current runtime/data ownership (read-only).
- `docs/reviews/stakeholder-export-parity-audit-2026-09-14` and
  `docs/analysis/stakeholder-export-parity-audit-2026-09-14.md` — observed beneficiary program shapes
  (Flag/HGP Monday overlay sharing the Tue–Fri period; 45 minutes inclusive of HGP).

## 3. Verified root causes (planner reconnaissance at the accepted base — confirm before editing)

Confirm these against the base commit; they are the reason each requirement exists.

- **F1 — persisted special events never reach the shape contract or the constructor.**
  `atlas-server/src/services/generation-preflight.service.ts:700` loads
  `policySpecialEvent.findMany(...)`, but `:883-888` builds the shape-contract `policy` from
  `policyRow` **without** `specialEvents`, and `:1139-1143` builds the constructor
  `policy` the same way. `buildRunTimetableShapeContracts`
  (`generation-shape-assembly.service.ts:43-100`) therefore calls
  `buildTimetableShapeContract` with no persisted events.
- **F2 — the constructor then falls back to hardcoded windows.**
  `schedule-constructor.ts:230-312` (`buildPeriodSlots`) uses legacy global recess/lunch defaults
  (09:45–10:00 / 11:55–12:55) instead of the persisted `HEALTH_BREAK`/`LUNCH_BREAK` rows
  (09:00–09:15 / 12:15–13:00 for grades 7–8; 15:15–15:30 / 12:15–13:00 for grades 9–10), and
  `:314-369` (`buildSpecialEventSlots`) synthesizes a hardcoded `MONDAY` `FLAG CEREMONY`
  07:00–07:30 display slot instead of the persisted `FLAG_OR_HGP` interval.
- **F3 — the Monday overlay does not share the underlying period.** Because the persisted interval is
  discarded (F1/F2), the rendered overlay can be an interval that matches no canonical CLASS row,
  i.e. an extra interval instead of an overlay on the configured advisory-section period.
- **F4 — explicit non-Monday Flag/HGP authority is silently accepted.**
  `schedule-constructor.ts:394-405` (`resolveSpecialEventDayOfWeek`) returns an explicit non-Monday
  day verbatim, so an explicit `dayOfWeek: 'WEDNESDAY'` `FLAG_OR_HGP` row becomes a Wednesday
  day-scoped window. `generation-preflight.service.ts:909-912,926` validates the flag day only when
  `policyRow.enableFlagCeremony` is truthy and inspects only the **first** matching row.
  `timetable-shape-policy.service.ts:225-226` already defines `FLAG_CEREMONY_SCOPE_INVALID`, but it
  is unreachable for persisted rows when `enableFlagCeremony` is false.
  Two more hardcoded identity coercions exist outside the constructor:
  `room-schedule.service.ts:115-116` and `published-schedule.service.ts:545-546`
  (`se.eventType === 'FLAG_OR_HGP' ? 'MONDAY' : ...`).
- **F5 — classroom-authority demand may be silently satisfied by a laboratory.**
  `schedule-constructor.ts:2141-2153` appends **any** non-`CLASSROOM` teaching room that fits
  enrollment and grade scope (including `LABORATORY`, `TLE_WORKSHOP`, `COMPUTER_LAB`, `GYMNASIUM`)
  as capacity relief for a `CLASSROOM`-authority subject. `constraint-validator.ts:481-501` then
  emits `ROOM_TYPE_MISMATCH` purely because the school owns laboratories.
- **F6 — `ROOM_TYPE_MISMATCH` is a blanket type inequality.**
  `constraint-validator.ts:475-501` fires whenever `room.type !== subject.preferredRoomType`, with
  severity decided only by a `deferredRoomTypePreference`/`MODULAR_POOL_ASSIGNED` marker; there is no
  "the preferred room genuinely could not be used" condition and no auditable reason.
  `:503-529` does the same for `ROOM_FEATURE_MISMATCH`.
- **F7 — the constructor never receives real availability.**
  `generation-preflight.service.ts:698` selects only `{ facultyId, status }`, and `:1138` hardcodes
  `timeSlots: []`, so the real trigger (`generation.service.ts:697-700`) and the readiness dry run
  both schedule **without any** `UNAVAILABLE` exclusion.
- **F8 — availability is not a freshness domain.**
  `generation-input-snapshot.service.ts:8-20,301-354` binds `teachingLoad`, `policy`, `rooms`,
  `sections`, `subjects`, `derivedDemand` only; a persisted preference/availability change does not
  change any fingerprint, so a run generated before the change still reports `FRESH`.
- **F9 — the room-type authority is not data-driven on every consumer.** `Subjects.tsx:907-925`
  labels a non-classroom `preferredRoomType` as an unconditional "Requires … facilities", and
  `SubjectFormModal.tsx:479` help text gives no CLASSROOM/LABORATORY semantics.
- **F10 — two committed assertions encode the behavior that requirement (3) now rejects**
  (`atlas-server/src/__tests__/timetable-output-export-c03.test.ts:19` and
  `atlas-server/src/__tests__/timetable-shape-diagnostic-c02.test.ts:112-115`).
  These are requirement-driven assertion changes, not silent test removals (see C07-S13).

## 4. Required changes

### R1 — Thread persisted `PolicySpecialEvent` authority (shape + constructor)

- Build the constructor/shape `policy` for `buildRunTimetableShapeContracts` and
  `buildPreflightConstructorInput` from `assembly.specialEvents`, mapped into
  `ConstructorInput['policy'].specialEvents` (`{eventType, label, startTime, endTime, dayOfWeek,
  enabled, gradeGroup, programType}`), using the existing effective-event resolver
  (`lib/policy-special-events.ts` `getEffectiveEvents`) — no new parallel resolution.
- `buildPeriodSlots` must exclude the persisted non-day-scoped break/event windows per grade group;
  `buildDayScopedEventWindows` must derive its Monday window from the persisted interval.
- Fail closed on silently-missing authority: if the persisted rows are unavailable, keep the
  existing explicit legacy behavior only where the legacy policy flags are authoritative, and never
  synthesize a display overlay interval that no persisted row or canonical row defines. State the
  chosen fallback explicitly in the handoff.

### R2 — Monday Flag/HGP overlay shares the underlying advisory-section period

- The `FLAG_OR_HGP` display row interval **must equal** the canonical CLASS row interval that
  contains the configured window (the underlying advisory-section period), with `dayOfWeek:
  'MONDAY'` and the persisted label. It must not create a second interval, an extra period slot, an
  extra demand line, extra minutes, or an extra teaching cell.
- If the configured window spans more than one canonical CLASS row, fail closed with the typed
  `FLAG_CEREMONY_SCOPE_INVALID` blocker (never invent a multi-period overlay).
- Tue–Fri cells of the same interval remain ordinary teachable periods (existing day-scoped
  blocking semantics preserved).
- Emit exactly one flag overlay row per grade/program contract (no duplicate interval in
  `displaySlots` or `buildUnionDisplaySlots`).

### R3 — Reject explicit non-Monday Flag/HGP authority

- One shared identity/day authority in `lib/policy-special-events.ts`: a row is Flag/HGP when
  `eventType === 'FLAG_OR_HGP'` or the label matches the flag-ceremony identity; an **absent** day
  means Monday; an **explicit non-Monday** day is rejected authority (never coerced, never
  reinterpreted).
- The preflight must validate **every** persisted Flag/HGP row's day scope independently of
  `policyRow.enableFlagCeremony`, and block with `FLAG_CEREMONY_SCOPE_INVALID`
  (`owningSurface: 'Scheduling policy / special events'`, a concrete `nextAction`). The real trigger
  already throws `GENERATION_PREFLIGHT_BLOCKED` on any blocker — prove zero writes.
- The constructor must exclude rejected rows (no non-Monday day-scoped window, no non-Monday
  overlay) so a bypassed preflight cannot silently schedule a Wednesday/Thursday ceremony.
- Align the two read projections (`room-schedule.service.ts`, `published-schedule.service.ts`) onto
  the same shared helper so a rejected row is not silently re-rendered as Monday. Valid
  configurations must render byte-identically to today; existing suites stay green.

### R4 — Data-driven room authority (no laboratory inference, opt-in preserved)

- Room authority comes **only** from persisted school-scoped authority: `Subject.preferredRoomType`
  (and `InstructionalCohort.preferredRoomType` for cohort lanes). No code path may consult subject
  code, name, `rotationFamily`, weekly minutes, curriculum content, or the presence of laboratory
  rooms to choose a room type. Remove the unconditional specialized-room deferral
  (`schedule-constructor.ts:1896-1900, 2090-2095, 2419-2424`) that currently forces
  `CLASSROOM` for any non-classroom authority under `HOME_ROOM_FIRST`.
- **Resolved-authority placement rule (planner decision D-A):** an entry's room must satisfy the
  resolved authority.
  - Authority `CLASSROOM` → only `CLASSROOM` teaching rooms that are grade-scope compatible and not
    shared facilities, plus the section's documented home room. The non-classroom "overflow relief"
    pool (F5) is removed for classroom authority: a capacity/type shortfall is reported truthfully
    (typed unassigned/room-resource result), never absorbed by a laboratory or other specialist room.
  - Authority `X` specialized → attempt compatible `X` rooms first (type, grade scope, capacity,
    features). Only if none is available at the evaluated slot does the documented home-room
    contract apply, and the entry must record the auditable deviation reason (D-E below) so the
    result is truthful; otherwise the session is reported `SPECIALIZED_ROOM_UNAVAILABLE`
    (`soft` violation) and the preflight reports `ROOM_RESOURCE_UNAVAILABLE`.
- **Primary fixture A:** Science (BIO/CHEM/ES, `rotationFamily=SCIENCE`) authority `CLASSROOM` →
  `preferredRoomType` resolves `CLASSROOM`, `requiredFeatures` empty, zero entries in laboratory
  rooms, zero `ROOM_TYPE_MISMATCH`, zero `SPECIALIZED_ROOM_UNAVAILABLE`, zero
  `ROOM_FEATURE_MISMATCH`, complete T1/T2/T3 Science session conservation.
- **Future fixture B:** a school-scoped explicit `LABORATORY` authority → compatible laboratory
  available → the scheduled rotation entries occupy that laboratory in every applicable term;
  removing laboratory compatibility (type/capacity/grade scope) produces the documented typed
  warning/blocker instead of a silent classroom substitution.
- **No schema migration.** If "only some weekly sessions may use a laboratory" cannot be represented
  by existing authority, record it as a successor policy requirement in the handoff — do not invent
  a fallback and do not touch `prisma/`.

### R5 — `ROOM_TYPE_MISMATCH` only on genuine preferred-room failure

- **D-E deviation vocabulary (planner decision):** the constructor records, on the entry metadata,
  a closed-set `roomAuthorityDeviationReason` with one of
  `HOME_ROOM_CONTRACT` (documented home-room/classroom contract, authority satisfied),
  `PREFERRED_ROOM_UNUSABLE_NO_COMPATIBLE_ROOM`,
  `PREFERRED_ROOM_UNUSABLE_CAPACITY`,
  `PREFERRED_ROOM_UNUSABLE_NO_REQUIRED_FEATURES`, or absent.
- The validator emits `ROOM_TYPE_MISMATCH` **only** when the entry's room type does not satisfy the
  resolved authority **and** the metadata carries a `PREFERRED_ROOM_UNUSABLE_*` reason; `meta` must
  include the reason, `roomType`, `preferredRoomType`, and the attempted constraints. Severity:
  `SOFT` for the documented-and-recorded fallback class, `HARD` only for an unsatisfied authority
  with **no** recorded reason (a regression/bug signal that must never occur in the accepted
  fixtures). Never emit for a satisfied authority and never for the documented home-room contract.
- `ROOM_FEATURE_MISMATCH` follows the same "genuine failure" rule and stays silent when
  `requiredFeatures` is empty.
- Report the final severity decision in the handoff and cover both classes with tests.

### R6 — Real availability in the trigger

- The preflight assembly must load persisted availability
  (`facultyPreference` → `timeSlots` with `{ day, startTime, endTime, preference }`, ordered
  deterministically) and `buildPreflightConstructorInput` must pass those slots verbatim
  (`PreferenceSlotInput` shape). No `timeSlots: []`.
- **Do not** flip `ATLAS_ENABLE_LEGACY_TIME_PREFERENCES` and **do not** change
  `preference.service.ts` write behavior (that is a separate product decision and is out of scope).
  The change is: consume the persisted authority that exists.
- The readiness dry run and the real trigger must continue to use the **same** assembly/builders, so
  their constructor inputs stay identical (existing parity test must stay green).

### R7 — Availability freshness domain, version bump, fail-closed stale

- Add `availability` as a required freshness domain in
  `atlas-server/src/services/generation-input-snapshot.service.ts`: bump
  `GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION` (2 → 3), extend
  `GenerationInputDomain`, `REQUIRED_GENERATION_INPUT_DOMAINS`, and the emitted `domains`.
- The domain must bind the persisted availability authority exactly: a content digest over
  `faculty_preferences` and `preference_time_slots` scoped to `schoolId`/`schoolYearId` (same
  raw-SQL digest style as the existing domains), plus count/max-id/max-timestamp signals.
  Any persisted preference or availability edit must change the fingerprint.
- **Older runs fail closed as stale, never fresh:** a run whose snapshot schema version is below the
  current version must compare as `status: 'STALE'` (retaining the distinct
  `missingReason: 'SNAPSHOT_VERSION_MISMATCH'` and a truthful message/action hint) — never `FRESH`
  and never silently reinterpreted. `extractGenerationInputSnapshot` must reject a
  current-version snapshot that is missing the `availability` domain.
- Write-time guards must include the new domain automatically: the trigger's captured-source
  snapshot vs the transaction-bound recomputation (`generation.service.ts:621,879-882`) and the
  manual/quick-place guard (`manual-edit.service.ts:1400-1415`) must fail closed with the existing
  typed `SOURCE_AUTHORITY_STALE` and zero writes when availability changed.

### R8 — Operator-facing room-authority wording

- One shared client copy authority (single module consumed by every surface) with the required
  semantics:
  - `CLASSROOM` → "regular classroom; special-room use handled outside this timetable";
  - `LABORATORY` → "reserve a laboratory through this timetable".
- `Subjects.tsx:907-925` must not label `preferredRoomType` as an unconditional requirement;
  `SubjectFormModal.tsx:468-479` must explain both values. Keep the existing layout primitives
  (`@/ui/*`) and the no-scroll architecture; no new native controls.

### R9 — Assertion-change accounting (no silent test removal)

- Every changed or removed committed assertion must be listed in the handoff with its requirement
  mapping and its replacement coverage (F10 is the known pair). No unexplained assertion or test
  removal; run the existing affected suites and report pass/fail, reproducing any pre-existing
  failure on the base commit to prove it is not introduced.

## 5. Acceptance matrix (mandatory — QA tallies exactly these rows)

Predeclared plan: `MANDATORY_SOURCE: 14`, `MANDATORY_LIVE: 1`, `DEFERRED_EXTERNAL: 0` (total 15).
Every row needs a real production entry point, an observable pass condition, and a failing
control that the old behavior (base commit) fails.

| ID | Class | Requirement | Production entry point | Observable pass condition |
| --- | --- | --- | --- | --- |
| C07-S01 | MANDATORY_SOURCE | R1 persisted events → shape contract | `buildGenerationPreflight` + `buildRunTimetableShapeContracts` | display/period slots derive from the persisted `FLAG_OR_HGP` and `HEALTH_BREAK`/`LUNCH_BREAK` rows; mutant M1 (threading removed) fails |
| C07-S02 | MANDATORY_SOURCE | R1 persisted events → real constructor input | `buildPreflightConstructorInput` → `constructBaseline`/`runHybridScheduler` | `policy.specialEvents` non-empty and effective; the Monday window equals the persisted interval; non-day-scoped persisted events block all weekdays; mutant M1 fails |
| C07-S03 | MANDATORY_SOURCE | R2 overlay shares the underlying period | `buildTimetableShapeContract` + `buildUnionDisplaySlots` + constructor demand | exactly one flag overlay row, interval equal to the containing canonical CLASS row, `dayOfWeek=MONDAY`; `periodSlots`/`periodsPerDay`/weekly minutes/demand identical to the same fixture without the flag row; mutant M2 (overlay interval shifted) fails |
| C07-S04 | MANDATORY_SOURCE | R3 non-Monday rejection | `buildGenerationPreflight` + `triggerGenerationRun` + `constructBaseline` + the two read projections | `FLAG_CEREMONY_SCOPE_INVALID` blocker, `GENERATION_PREFLIGHT_BLOCKED`, zero writes; constructor excludes the row; read projections do not re-render it as Monday; mutant M3 (validation removed) fails |
| C07-S05 | MANDATORY_SOURCE | R4 fixture A | `triggerGenerationRun` (write-instrumented) | Science `CLASSROOM` authority: zero laboratory entries, zero `ROOM_TYPE_MISMATCH`, zero `SPECIALIZED_ROOM_UNAVAILABLE`, zero `ROOM_FEATURE_MISMATCH`, complete per-term T1/T2/T3 conservation; mutant M4 (lab-capable overflow restored) fails |
| C07-S06 | MANDATORY_SOURCE | R4 fixture B | `triggerGenerationRun` + `validateHardConstraints` | explicit `LABORATORY` authority: rotation entries occupy the compatible laboratory in every applicable term; removing compatibility yields the typed `SPECIALIZED_ROOM_UNAVAILABLE`/`ROOM_RESOURCE_UNAVAILABLE` result; mutant M5 (unconditional deferral) fails |
| C07-S07 | MANDATORY_SOURCE | R5 mismatch semantics | `validateHardConstraints` + constructor metadata | positive: unsatisfied authority is reported with a machine-readable reason; negative: satisfied authority and the documented home-room contract emit no `ROOM_TYPE_MISMATCH`; mutant M6 (blanket type inequality) fails |
| C07-S08 | MANDATORY_SOURCE | R6 real availability | `buildGenerationPreflight` + `triggerGenerationRun` | persisted `UNAVAILABLE` slots are excluded from placement and the typed reason is surfaced; mutant M7 (`timeSlots: []`) fails |
| C07-S09 | MANDATORY_SOURCE | R7 domain + version bump | `computeGenerationInputSnapshot` + `extractGenerationInputSnapshot` | snapshot emits a non-empty `availability` domain and the bumped version; a current-version snapshot missing the domain is rejected; mutant M8 (domain binding omitted) fails |
| C07-S10 | MANDATORY_SOURCE | R7 post-run availability edit | `getRunDraft`/`getLatestRunDraft` (`inputState`) | after a completed run, a persisted availability edit reports `STALE` with `availability` in `changedDomains`; a pre-bump snapshot reports the version-mismatch stale reason, never `FRESH`; zero writes |
| C07-S11 | MANDATORY_SOURCE | R7 write-time stale | `triggerGenerationRun` (write-instrumented, mock client) with the guarded disposable-PostgreSQL tier as supporting engine evidence | availability change between capture and commit → typed `SOURCE_AUTHORITY_STALE`, **zero `COMPLETED`/success writes** (no COMPLETED run status, no persisted draft entries for that run, no success audit, no completion notification); the pre-existing `FAILED` finalization of the aborted attempt is permitted but must be asserted explicitly so it is never mistaken for success |
| C07-S12 | MANDATORY_SOURCE | R8 wording | subject form + coverage panel rendering | one shared copy authority; exact CLASSROOM/LABORATORY semantics; no unconditional "requires … facilities" label; client type-check/build green |
| C07-S13 | MANDATORY_SOURCE | R9 accounting | committed test diff | every changed/removed assertion mapped with replacement coverage (F10 pair included); no unexplained removal; affected suites pass |
| C07-S14 | MANDATORY_SOURCE | build + parity row | `tsc`/build (server + client) and the changed-producer/shape chain | both builds green; one `production-shape parity` row naming real producer, real consumer, conservation totals, negative control, result |
| C07-L01 | MANDATORY_LIVE | live primary-beneficiary authority (read-only) | `GET https://njgrm.buru-degree.ts.net/api/v1/subjects?schoolId=1` (unauthenticated, zero write) | active `SCI_BIO`/`SCI_CHEM`/`SCI_ES` resolve `preferredRoomType: "CLASSROOM"` and empty `requiredFeatures`. If any resolves `LABORATORY` (or requires lab features): return `PRIMARY_ROOM_POLICY_MISMATCH` and prepare — do **not** execute — a separate fingerprinted data-correction preview |

Planner-side observation for C07-L01 (captured 2026-09-16, Asia/Manila, read-only, to be
re-observed by the executor and QA): 22 active subjects, `SCI_BIO`/`SCI_CHEM`/`SCI_ES` =
`CLASSROOM`, `requiredFeatures` empty; the only non-classroom authority is `TLE_ICT_EXP`
(`COMPUTER_LAB`).

## 6. Required mutants (failing controls)

| Mutant | Mutation | Must fail |
| --- | --- | --- |
| M1 | Omit persisted `specialEvents` from the shape/constructor policy | C07-S01, C07-S02 |
| M2 | Shift the overlay interval off the underlying canonical CLASS row | C07-S03 (extra interval/minutes or missing overlay) |
| M3 | Remove the persisted non-Monday Flag/HGP validation | C07-S04 |
| M4 | Restore laboratory-capable overflow for a `CLASSROOM` authority | C07-S05 |
| M5 | Restore the unconditional specialized-room deferral | C07-S06 |
| M6 | Restore the blanket `room.type !== preferredRoomType` emission | C07-S07 |
| M7 | Restore `timeSlots: []` in the constructor input | C07-S08 |
| M8 | Omit the `availability` domain binding (and/or the version bump) | C07-S09, C07-S10 |

Mutants must be real production-boundary mutations (a restored old code path, a changed production
input), not source-text assertions or helper-only stubs.

## 7. Fixtures

Use a **realistic three-term** fixture built through the real producer (`deriveCanonicalDemand` /
`buildDerivedDemand` projection with three ordered terms T1/T2/T3), the real canonical class-program
rows (`getExpectedCanonicalSlots` or the equivalent persisted shape), real rooms (classrooms plus at
least three laboratory rooms and a TLE workshop so a false inference is detectable), real
`PolicySpecialEvent` rows, and real faculty qualifications plus availability slots. Follow the
existing harness patterns:

- `atlas-server/src/__tests__/generation-production-trigger-genc02r1.test.ts` — `withDataContext`
  mock-client driver for the **real** `triggerGenerationRun` with write instrumentation and a
  preflight/readiness parity check. Extend the mock so `computeGenerationInputSnapshot` succeeds
  (`$queryRawUnsafe` must return the six-or-more domain digest row set) and so the write path
  (`$transaction`) is instrumented.
- `atlas-server/src/__tests__/tt-output-c03r3.test.ts` / `generation-rotation-totals-genc02r1.test.ts`
  — realistic three-term derived-demand + rotation construction.
- `atlas-server/src/__tests__/generation-readiness-disposable-genc02r.test.ts` — the guarded
  disposable-PostgreSQL pattern (`atlas_restore_drill_<yyyymmdd>_<rand>` name, schema applied only
  inside it, `try/finally` zero-residue cleanup, skip-safe without `DATABASE_URL`) for C07-S11.

Fixture A (primary / external-on-demand): Science rotation (BIO/CHEM/ES, `rotationFamily=SCIENCE`,
`modularOrder` 1/2/3, `preferredRoomType=CLASSROOM`, no required features) + year-long
MATH/ENG/AP/ESP/MAPEH; persisted `FLAG_OR_HGP` Monday window equal to the underlying canonical
CLASS row; persisted per-grade-group `HEALTH_BREAK`/`LUNCH_BREAK` rows.

Fixture B (future / timetable-reserved lab): same shape, but a school-scoped explicit `LABORATORY`
authority on the rotating Science family, with a compatible laboratory available; plus the
compatibility-removed variant.

## 8. Owned paths (edit only these)

- `atlas-server/src/services/generation-shape-assembly.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/generation-preflight.service.ts`
- `atlas-server/src/services/generation-input-snapshot.service.ts`
- `atlas-server/src/services/generation.service.ts` (wiring/typed-stale only)
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/timetable-shape-policy.service.ts`
- `atlas-server/src/services/room-schedule.service.ts` (R3 consumer alignment only)
- `atlas-server/src/services/published-schedule.service.ts` (R3 consumer alignment only)
- `atlas-server/src/lib/policy-special-events.ts`
- `atlas-server/src/__tests__/generation-authority-realism-c07.test.ts` (new primary suite)
- `atlas-server/src/__tests__/generation-authority-realism-c07-availability.test.ts` (new availability/stale suite, or fold into the primary suite — declare which)
- the minimum bounded edits to the existing suites whose assertions encode changed behavior (F10)
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/subjects/SubjectFormModal.tsx`
- `atlas-client/src/lib/room-type-labels.ts` and/or a new
  `atlas-client/src/lib/room-authority-copy.ts` (single shared copy authority)
- `atlas-client/src/lib/__tests__/room-authority-copy.test.ts` (new)

## 9. Forbidden (hard boundaries)

- No `prisma/schema.prisma`, `prisma/migrations/**`, migration, `db push`, `migrate reset`, seed, or
  any schema command of any kind.
- No live/shared-database write, no live generation, no publication, no deployment, no runtime or
  supervisor action, no task/env change, no login, no browser session.
- No subject-data mutation of any kind (C07-L01 is read-only). If it reports
  `PRIMARY_ROOM_POLICY_MISMATCH`, prepare (do not execute) the separate fingerprinted preview.
- No `ATLAS_ENABLE_LEGACY_TIME_PREFERENCES` flip, no `preference.service.ts` write-path change.
- No edits to `docs/plans/**` (register/state), `CHANGELOG.md`, `ops/workflow/**`,
  `docs/reference/**`, or `AGENTS.md`.
- Do not `npm install`/`npm ci` (dependencies are already installed in this worktree and the Prisma
  client is generated); never run an install through a shared junction.
- No `--force` Git operations, no rebase/amend of reviewed history, no push, no merge to `main`.
- No unrelated refactor, rename, formatting sweep, or file-size churn.

## 10. Verification commands (run from the worktree)

Server (`E:/ATLAS-worktrees/generation-authority-realism-c07/atlas-server`):

```
npm run build
npx tsx src/__tests__/generation-authority-realism-c07.test.ts
npx tsx src/__tests__/generation-production-trigger-genc02r1.test.ts
npx tsx src/__tests__/generation-rotation-totals-genc02r1.test.ts
npx tsx src/__tests__/generation-stakeholder-shape-genc02r.test.ts
npx tsx src/__tests__/generation-canonical-readiness-genc02.test.ts
npx tsx src/__tests__/timetable-shape-diagnostic-c02.test.ts
npx tsx src/__tests__/timetable-output-export-c03.test.ts
npx tsx src/__tests__/timetable-candidate-domain.test.ts
npx tsx src/__tests__/timetable-warning-authority-c04.test.ts
npx tsx src/__tests__/tt-source-freshness-generation-c04.test.ts
npx tsx src/__tests__/tt-output-c03r3.test.ts
npx tsx src/__tests__/publication-contract-readiness.test.ts
```

Client (`.../atlas-client`):

```
npm run build
npx tsx --test src/lib/__tests__/room-authority-copy.test.ts
npx tsx --test src/lib/__tests__/rollover-ui-guardrails.test.ts
```

Disposable-PostgreSQL tier (C07-S11) uses the guarded pattern in
`generation-readiness-disposable-genc02r.test.ts`; it may read `DATABASE_URL` from
`atlas-server/.env` when present (never print it) and must be skip-safe when absent. Before any
schema command inside that test, record the resolved host, database name, environment
classification, school count, and migration count without exposing secrets. Cleanup must leave zero
residue (rows removed, disposable database dropped) and is verified in `finally`.

## 11. Return contract (one immutable handoff)

Report, in one message:

1. `ROLE: EXECUTOR` header, worktree, branch, base SHA, candidate SHA, `REVIEW_REQUIRED`.
2. `git status --porcelain=v2` empty and `git diff --quiet` clean **after** the final source/test
   command (both required), plus the exact `git diff --name-status <base>...<candidate>` list.
3. The compact trace table `requirement -> production path -> negative control -> verification
   command`, with every row `PASS` / `BLOCKED` / `DEFERRED`; a row without production-path evidence
   cannot be `PASS`.
4. The 15-row acceptance matrix with pass conditions and the mutant results (M1–M8), including the
   "fails on base / passes on candidate" evidence for the load-bearing rows.
5. The `production-shape parity` row (real producer, real consumer, conservation totals, negative
   control, result).
6. The assertion-change inventory (F10 pair plus anything else) with requirement mapping and
   replacement coverage.
7. C07-L01 output: exact URL, HTTP status, the observed `preferredRoomType`/`requiredFeatures` for
   `SCI_BIO`/`SCI_CHEM`/`SCI_ES`, and one `window.location.origin`-free statement that the probe was
   an unauthenticated read-only HTTP GET with zero writes (no browser used).
8. Known risks, deferred items, and the successor policy requirement if partial-laboratory weekly
   support cannot be represented by existing authority.
9. Worktree disposition: `KEEP_ACTIVE` (the planner retains it for correction until integration).

Do not self-accept, merge, push, or edit the register.

## 12. Commit workflow

- Stage only the owned paths listed in §8; verify the staged list and `git diff --cached --check`
  before committing.
- One conventional commit (`feat(generation): ...`) or, if cleaner, two bounded commits
  (source+server tests, then client copy+test). No amend/rebase of handed-off history; corrections
  are additive commits on the same branch.
- Include this packet file (already committed on the branch) in the reviewed range.

## 13. R1 correction note (planner, 2026-09-16)

The first candidate (`1b990716`, over base `750cafcb`) returned with two mandatory rows
**BLOCKED** and one declared entry-point deviation. This section is the authority for the bounded
R1 correction; it is additive and changes no other requirement.

1. **C07-S05 / C07-S06 entry-point closure.** Those rows name the real `triggerGenerationRun`
   (write-instrumented) as the production entry point; the first candidate exercised the real
   producer + `constructBaseline`/`runHybridScheduler` + validator but not the trigger. R1 must
   drive the real `triggerGenerationRun` with a mock client (same technique as
   `generation-production-trigger-genc02r1.test.ts`) for fixture A and fixture B, and assert the
   invariants on the **persisted** output (`draftEntries` / `violations` handed to the run update):
   zero laboratory rooms and zero `ROOM_TYPE_MISMATCH` / `SPECIALIZED_ROOM_UNAVAILABLE` /
   `ROOM_FEATURE_MISMATCH` in fixture A; laboratory occupancy in every applicable term in fixture B;
   complete per-term T1/T2/T3 Science conservation in both.
2. **C07-S10.** Exercise the declared surface: `getRunDraft` / `getLatestRunDraft` `inputState`.
   With a persisted v3 run summary and a changed availability authority, `inputState.status` must be
   `STALE` with `availability` in `changedDomains`; with a below-current summary it must be `STALE`
   with `missingReason: 'SNAPSHOT_VERSION_MISMATCH'`, never `FRESH`. Instrument writes and prove the
   read performs none.
3. **C07-S11.** Drive the availability interleave through the real `triggerGenerationRun` (mock
   client): the availability digest changes between the captured pre-scheduling snapshot and the
   transaction-bound recomputation -> typed `SOURCE_AUTHORITY_STALE` with zero `COMPLETED`/success
   writes as defined in §5. The disposable-PostgreSQL evidence already gathered (domain binding on a
   real engine, zero residue) remains supporting engine evidence.
4. **Identity negative control.** Add one assertion that a non-flag `CUSTOM` event row (for example
   label `Reading Camp`) is never treated as a Monday-only Flag/HGP overlay, so the identity
   predicate cannot misclassify an unrelated event.
5. **Packet erratum applied.** The §10 client command list previously named a non-existent
   `src/lib/__tests__/ux-guardrails.test.ts`; the existing analogue
   `src/lib/__tests__/rollover-ui-guardrails.test.ts` replaces it. That was a packet defect, not a
   candidate defect.

Constraints unchanged: additive commits only on `work/generation-authority-realism-c07`, no
rebase/amend, no push, no schema/live action, same owned/forbidden path lists.
