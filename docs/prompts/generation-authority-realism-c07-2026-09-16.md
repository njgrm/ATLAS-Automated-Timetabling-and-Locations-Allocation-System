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

- `AGENTS.md` (worktree root; `origin/main` version). **Directive identity (planner-corrected
  2026-09-16): raw Git-blob SHA-256 = `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`**
  (hash of the bytes returned by `git cat-file blob HEAD:AGENTS.md`; 171055 bytes; git blob
  `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`). The earlier packet text mislabelled that value as
  "LF-normalized" and quoted a second hash of the CRLF working copy, which is not an identity. The
  checkout materializes CRLF on disk; always hash the Git blob, never the working copy. The harness
  has injected this directive; read targeted headings only.
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

## 14. Planner reconciliation and R2 correction note (2026-09-16, cycle continuation)

Resume point: candidate `48883ef0` over base `750cafcb`, `REVIEW_REQUIRED`, worktree clean, all
existing commits preserved (no amend/rebase/reset/squash), dependencies intact (isolated
`npm ci` installs in `atlas-server` and `atlas-client`; the root `node_modules` junction target still
holds its packages; no install was performed through any junction).

Planner-accepted dispositions for the R1 delta:

1. `atlas-server/src/__tests__/generation-authority-realism-c07-trigger.test.ts` is **attributable**
   and in scope: it is the minimum artifact that realizes packet §13 items 1–3 and drives the real
   `triggerGenerationRun` / `getRunDraft` / `getLatestRunDraft` entry points. No product source
   outside §8 was touched.
2. Fail-closed rejection when the configured Flag/HGP window is not contained by exactly one
   canonical CLASS row is **accepted** (D-C extension), including the zero-row case; it can never
   synthesize an undefined overlay.
3. The Flag/HGP identity negative control is **verified present and load-bearing**
   (`C07-R3 identity negative control`, `CUSTOM` label `Reading Camp`): the predicate is false, the
   day resolver returns `null`, and the rendered slot is not coerced to Monday.
4. The snapshot v2→v3 fixture edits remain attributable only while declaration counts are unchanged
   and the legacy fail-closed path stays covered (below-current version ⇒ `STALE` with
   `SNAPSHOT_VERSION_MISMATCH`, never `FRESH`). QA must confirm both; the planner re-verifies the
   counts and the legacy path in the pre-QA gates.
5. `publication-contract-postgres-concurrency.test.ts` exit 1 is classified **pre-existing** only
   after the identical `DATABASE_URL` guard reproduction on base `750cafcb` and on the candidate.

### R2 bounded correction — F9 warning-classification defect (authority for the next commit)

The audit finding F9 remains in the candidate. Two sites in
`atlas-server/src/services/schedule-constructor.ts` misclassify a non-room failure as a specialized
room result:

- **Site A (unresolved subject, ~line 1979-1993).** The item is pushed with
  `reason: 'NO_QUALIFIED_FACULTY'` but `roomAssignmentReason: 'SPECIALIZED_ROOM_UNAVAILABLE'`
  whenever the demand item carries a specialized room-type preference. A missing subject is not a
  room result.
- **Site B (refusal path, ~line 2544-2556).** `isSpecializedDemand` is evaluated **before** the
  observed failure cause, so `NO_QUALIFIED_FACULTY` (and `FACULTY_OVERLOADED`) with a specialized
  authority is reported as `SPECIALIZED_ROOM_UNAVAILABLE`. Because
  `generation.service.ts:751-758` maps that reason to the `SPECIALIZED_ROOM_UNAVAILABLE` violation
  at **SOFT** severity, a genuine data/workload hard blocker is laundered into a soft room warning.

Required R2 change (bounded to these two sites plus one control; **do not** absorb the broader
warning-recalibration audit):

1. Site A: report `roomAssignmentReason: 'NO_QUALIFIED_FACULTY'` — always consistent with the
   pushed `reason`.
2. Site B: order the room reason by observed cause, authority only as the room-path qualifier:
   `NO_QUALIFIED_FACULTY` → `'NO_QUALIFIED_FACULTY'`; daily/consecutive hard limit →
   `'POLICY_SLOT_BLOCKED'`; `FACULTY_OVERLOADED`/slot-unavailable → `'FACULTY_SLOT_UNAVAILABLE'`;
   room path exhausted **and** specialized authority → `'SPECIALIZED_ROOM_UNAVAILABLE'`; room path
   exhausted otherwise → `'ROOM_PATH_EXHAUSTED'`; else `'FALLBACK_UNRESOLVED'`.
   The genuine specialized-room-exhaustion case (faculty available, no compatible specialized room)
   must still report `SPECIALIZED_ROOM_UNAVAILABLE` so C07-S06 stays PASS.
3. Failing-first production-path control (added to the real-trigger suite or a new bounded suite):
   (a) a specialized-authority subject with **no qualified faculty** and (b) an unresolved
   specialized demand item whose `subjectId` is absent from the subject map must both yield
   `roomAssignmentReason: 'NO_QUALIFIED_FACULTY'` and, through the real `triggerGenerationRun`, a
   persisted `UNASSIGNED_SECTION` `HARD` violation — never `SPECIALIZED_ROOM_UNAVAILABLE` `SOFT`.
   Produce genuine failing-first evidence: run the control against the pre-fix source, capture the
   failure, then apply the fix and re-run green. Both land in **one additive commit**.
4. Unchanged and re-asserted by the control: the settled primary-beneficiary room contract — Science
   configured `CLASSROOM` stays in normal/home classrooms with zero laboratory reservations and zero
   laboratory warnings; an explicit future `LABORATORY` authority stays data-driven, honored, and
   never inferred from a Science name, code, rotation family, or the existence of laboratory rooms.

## 15. Planner R2d decision and independent verification record (2026-09-16)

**R2d decision (availability is a hard exclusion).** The R2c attempt returned `BLOCKED` with a
genuine, planner-confirmed defect: under `HOME_ROOM_FIRST`/cohort demand the relaxation in
`schedule-constructor.ts` (formerly `1531-1537`) re-admitted candidates that the availability check
had just excluded, so a persisted `UNAVAILABLE` window could be silently used and
`timeSlots: []` versus real slots produced byte-identical placements. The cycle mandate explicitly
requires unavailable-slot exclusion, so the planner directed the bounded R2d fix: one extracted
`isUnavailableAtSlot(facId)` predicate (both authority forms) applied to the `available` filter and
to the relaxation, relaxing *preference* only. No new reason or violation codes; the refusal surfaces
through the existing `NO_AVAILABLE_SLOT` → `FACULTY_SLOT_UNAVAILABLE` → `UNASSIGNED_SECTION`/`HARD`
chain, and the session stays unplaced instead of being silently scheduled.

**Candidate chain (all additive, history preserved).**
`87a05866` (planner register+packet) → `1b990716` (initial) → `459db3a4`, `c59794ee` (planner packet
amendments) → `31901e0e`, `48883ef0` (R1) → `363840cc` (R2 F9) → `af3edb4f` (R2b hygiene) →
`74e7cf00` (R2d availability enforcement). No amend, rebase, reset, squash, or discard.

**Planner independent verification (performed on the frozen bytes; all mutants restored
byte-exactly and the worktree re-verified clean).**

| Check | Result |
| --- | --- |
| Worktree clean (`porcelain=v2` empty, `git diff --quiet`/`--cached --quiet` 0) | PASS |
| Base `750cafcb` is an ancestor; 19 product/test paths + 4 planner docs paths, all attributable | PASS |
| `generation-authority-realism-c07-trigger` | 13/13, exit 0 |
| `generation-authority-realism-c07` | 19/19, exit 0 |
| `generation-authority-realism-c07-availability` (guarded disposable PostgreSQL) | 1/1, exit 0 |
| `npm run build` (server `tsc`) | exit 0 |
| client `tsc --noEmit`, `vite build`, `room-authority-copy` | exit 0 / exit 0 / 4/4 (client bytes unchanged since) |
| `git diff --check` | exit 0 |
| Mutant A — `buildPreflightConstructorInput` reverted to `timeSlots: []` | trigger FAILS (13 tests, 1 fail: "the real trigger must never place the availability owner inside a persisted UNAVAILABLE window"); primary FAILS ("persisted availability must reach the constructor") |
| Mutant B — `specialEvents` threading removed from both the shape policy and the constructor input | primary FAILS ("the real constructor input must receive the persisted rows", 0 !== 3) |
| Mutant C — relaxation guard `&& !isUnavailableAtSlot(facId)` removed | trigger FAILS with the same availability assertion |
| `publication-contract-postgres-concurrency` on base `750cafcb` vs candidate | identical: exit 1, `ERR_ASSERTION`, regex mismatch on an empty database name (`DATABASE_URL` unavailable in this environment); guard at line 179 executes before any snapshot use at 237+ ⇒ **pre-existing environment precondition, not candidate-caused** |
| Snapshot fixture accounting (base vs candidate declaration counts) | `derived-demand-correction-c01r2` 7/7, `timetable-output-export-c03` 7/7, `timetable-shape-diagnostic-c02` 13/13, `publication-contract-readiness` 0/0, `publication-contract-postgres-concurrency` 0/0 ⇒ unchanged |
| Legacy fail-closed coverage retained | asserted: below-current snapshot ⇒ `STALE` + `SNAPSHOT_VERSION_MISMATCH` (never `FRESH`) in `generation-authority-realism-c07` (C07-S09/S10 M8) and `derived-demand-correction-c01r2` control 9 |
| Directive identity | raw Git-blob SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3` (git blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`) |
| Dependency tree | isolated `npm ci` installs intact in `atlas-server`/`atlas-client`; root `node_modules` junction target intact; no install performed through any junction |

Disclosed routing deviation: the executor sessions exposed no separately selectable `high` variant,
so the nearest supported variant was used in every round.

Residuals carried to QA: in-process mutants M1–M8 (predicate/input reproductions, not compiled-base
runs); D-C zero-row strictness; D-E severity semantics; stale npm script
`test:hybrid-scheduler` pointing at a non-existent test file; `preference-wellbeing` npm target
absent at base.

## 17. Post-apply amendment — B3 false `TERM_AUTHORITY_STALE` and the record correction (2026-09-16)

### Record correction (supersedes one stale planner statement)

**`TERM-CACHE-CATCHUP-APPLY` is no longer "NOT GRANTED".** The term-cache catch-up apply executed
successfully at main ancestor `818439c2`; its valid write is retained, and mirror 223 now contains the
reviewed ordered T1/T2/T3 authority. No second apply, replay, rollback, or login is authorized. Any
register row or report still describing that apply as ungranted is stale and must be reconciled by
the next authorized register transition (the machine register is currently under
`WF-SEED-INVENTORY-C02` custody, so no transition is made in this amendment).

### B3 — the live apply exposed a cross-namespace comparison that emits a false hard blocker

`generation-preflight.service.ts:670-690` performs a second authority read and compares the **stored
upstream** string against the **local canonical derived** revision:

```ts
const persistedRevision = (authorityMirror?.termContractCache as { semanticRevision?: unknown } | null)?.semanticRevision;
if (typeof persistedRevision === 'string' && persistedRevision !== derived.termStructure.semanticRevision) {
    blockers.push({ code: 'TERM_AUTHORITY_STALE', ... });
}
```

Those two values are produced from different payloads and are **not interchangeable**:
`enrollpro-term-contract.service.ts:168-170` (`semanticRevisionFor`) hashes the upstream normalized
structure, while `derived-demand.service.ts:924-936` (`canonicalTermStructureRevision`) hashes a
canonical `{schoolId, schoolYearId, format, sorted terms}` payload; `derived-demand.service.ts:938-944`
already documents that the stored string must not be trusted as the binding revision because
PostgreSQL JSONB reorders object keys. With the now-valid mirror-223 cache the comparison therefore
blocks a healthy runtime with a false `TERM_AUTHORITY_STALE`.

### B3 required correction (bounded)

1. **Remove** the direct comparison between the stored upstream `semanticRevision` and the canonical
   derived revision at `generation-preflight.service.ts:670-690`.
2. **One shared canonical helper.** Both the first cached structure consumed by derived demand
   (`derived-demand.service.ts:1049` via `normalizePersistedTermStructure`) and the second authority
   read used for the concurrency/staleness check must pass through the **same** normalizer and
   revision helper (`normalizePersistedTermStructure` → `canonicalTermStructureRevision`). The
   preflight's second read must compare canonical revision ↔ canonical revision
   (`persisted.structure.revision` vs `derived.termStructure.semanticRevision`), never a stored
   string vs a computed one.
3. **Canonical payload completeness and determinism.** `canonicalTermStructureRevision` must include
   every term-authority field that affects generation or its selected-term outputs — at minimum
   `identity`, `displayLabel`, `order`, and the term start/end boundaries where the persisted
   normalized structure retains them (extend the normalizer to retain and validate them if it
   currently discards them). The payload must be built field-by-field with an explicit, sorted
   ordering (sort by `order`, deterministic tie-break) and must never depend on JSONB object-key
   order.
4. **Preserve concurrency protection.**
   - unchanged canonical authority ⇒ no `TERM_AUTHORITY_STALE`;
   - authority changed between the first and second read ⇒ typed `TERM_AUTHORITY_STALE`;
   - malformed, missing, foreign-school, wrong-year, duplicate, out-of-order, or otherwise
     unnormalizable authority ⇒ the existing typed fail-closed blocker path (map the normalizer
     failure to a typed blocker; do not invent new codes and do not throw);
   - every rejection performs **zero** writes.
5. **Provenance only.** The upstream `semanticRevision` may remain as untrusted provenance metadata,
   but must never be compared with, substituted for, or used to derive the canonical revision.

### B3 failing-first controls (mandatory)

Using a production-shaped cached snapshot equivalent to live mirror 223 — school 1, year 9,
`TRIMESTER`, ordered `T1`/`T2`/`T3` with labels and dates, upstream
`semanticRevision a51b62a26e27416c3d1295697f144d7ae5de5c56bb6a5e0d25bcb0c24dd8abb9`:

1. Prove the **current** code emits the false `TERM_AUTHORITY_STALE` for that unchanged snapshot.
2. Prove the **corrected** code emits **no** stale blocker for it.
3. Change one generation-relevant term-authority field between the first and second read and prove
   typed `TERM_AUTHORITY_STALE`.
4. Prove deterministic equivalence under JSON object-key reordering of the persisted cache payload.
5. Add a **mutant restoring the cross-namespace comparison**; the focused suite must fail.
6. Assert zero writes on every blocker path.

Scope discipline: B3 touches the term-authority comparison and the canonical revision payload only.
Do not absorb rollover, publication, term-cache, or warning-recalibration work; `academic-term`,
`runtime-context`, and `derived-demand` consumers of the shared helper must keep working with their
existing typed behaviour.
