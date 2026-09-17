# Wave Completion Audit — G9G10-FLAG-SOURCE-LANE

Compact capsule. Full transcript is not committed; Git and the register are the
durable authority.

## Wave identity

| Field | Value |
|---|---|
| Stream | `G9G10-FLAG-SOURCE-LANE` (ordinary MEDIUM source lane, `approval.required: false`) |
| Objective | Operator shift-based lunch ruling in the canonical class-program grids (G9/G10 REGULAR 8 CLASS + 2 BREAK with lunch 11:30-12:15; the six special scopes 10 CLASS + 2 BREAK with a two-row pre-lunch Specialization block and an unmodelled 11:15-11:30 seam; G7/G8 untouched), per-scope Monday Flag/HGP resolution, and the `WORKLOAD_POLICY_BLOCK` relabel precedence |
| Governing prompt | `docs/prompts/g9g10-flag-source-lane-2026-09-17.md` |
| Base | `cb4fa7ac1c0c469d54b748098bb3b457f830788c` |
| Candidate | `cca958d73aac90e7c8b7dfb82ad58dcaea32de5f` (8 attributed paths) |
| Integration merge | `ec235689847e289ceba0d21613697cdafbf0527b` over `origin/main` `61fe8515` |
| Integrated tip | `3ebc161d921526a690fd8d599a0582d04d94831c` |
| Register revision at audit | 298 (`INTEGRATED`) |
| Directive pin | `origin/main:AGENTS.md` LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3` (verified byte-exact by the auditor: raw SHA-256, 171055 B, 0 CRLF) |

## Auditor

| Field | Value |
|---|---|
| Role | `ROLE: WAVE_COMPLETION_AUDITOR` (fresh, read-only, adversarial) |
| Session id | `ses_f50eb3020ffeWjLLbxjsNENsj6` (returned by the orchestration harness at delegation; recorded here per the AGENTS.md provenance rule — the auditor's own context did not expose it) |
| Model | `opencode-go/deepseek-v4.1-flash` |
| Reasoning variant | `high` — **operator-pinned** ("Wave Completion Auditor high; do not use max"). Disclosed downgrade from the AGENTS.md `max` default for a wave that changes a source of truth and precedes a HIGH action |
| Verdict | **`AUDIT_CLEAR`** |
| Auditor-area tally | `12 / 12 / 0 / 0` (performed / passed / blocked / unperformed) |
| Reviewed tree | `origin/main` `28cb5dba`; `atlas-server/src` subtree `76d2bac8…` byte-identical at candidate / `762f7f44` / `ec235689` / `origin/main` |

## Reused evidence (not rerun by the auditor)

Fresh independent QA `ses_f50fa2ca2ffeMfAgKvdfKQSELz`: `ACCEPT_READY`
`10/10/0/0`, all 8 paths attributed. Integration-tier gates on the merged tree:
`tsc --noEmit` 0, production build 0, shape-diagnostic 14/14, stakeholder-shape
16/16, tt-output-c03r 14/14, C11 14/14 (zero skips), C11R 8/8,
published-immutability 135/0, `git diff --check` clean.

## New adversarial checks run

Git ancestry and worktree cleanliness at the exact SHAs; repository-wide
`class_program_slot` writer inventory **including raw SQL**; non-test consumer
sweep for the retired intervals; preflight sequencing trace; `getEffectiveEvents`
cardinality and `isFlagCeremonyEvent` breadth; constructor overlay `slice(0,1)`
and its shared scope resolution via `buildTimetableShapeContract`; publication
unassigned gate; generation input-snapshot coverage of `class_program_slots`;
warning-window canonical short-circuit; register stream/awaited/lease/
coordination cross-check; live runtime process and state read.

## Positive verifications

- **No reachable legacy grid writer.** The only production writer of
  `class_program_slots` is `seedClassProgramSlots` -> `createMany({skipDuplicates})`,
  insert-only, skipping any existing `grade:program` group, reached from
  `enrollpro-rollover.service.ts:1563`, and it writes the NEW grid from the same
  literal tables. No raw-SQL writer exists (`INSERT/UPDATE/DELETE class_program_slots`
  = 0 hits outside `node_modules`/`dist`).
- **No stale consumer.** No non-test consumer hardcodes the retired G9/G10
  `12:15-13:00` lunch or the retired third pre-lunch Specialization row;
  published reads resolve frozen rows first (`published-schedule.service.ts:645`).
- **Sequencing boundary is real and locked.** Live release `54dce67b` carries the
  OLD expected set, so `CANONICAL_TEMPLATE_INCOMPLETE` is the correct fail-closed
  behavior until `DATA-CORRECTION-C01` reseeds. The wave claims no generation or
  publication readiness.
- **Unauthorized-mutation check PASSES.** The candidate range is exactly the 8
  declared paths; no migration, runtime, env, task, or companion file; no register
  write by the executor; `MANDATORY_LIVE` gates 0; no generation or publication.

## Findings by severity

**Blocking: none.**

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| F-A1 | NON_BLOCKING | The revision-298 coordination snapshot carried three falsified clauses (peers list `G9G10` RUNNING while its row is INTEGRATED; `MIG-APPLY-0002-0003` "being integrated" while its row is INTEGRATED; "the shared runtime still serves its previous release" while `ENROLLPRO-PROXY-RECOVERY-LIVE` is COMPLETE and the runtime serves `54dce67b`) | Applied by the planner in this closure turn via `coordination-update` (revision 300), not by hand-editing machine state |
| F-A2 | NON_BLOCKING | `DATA-CORRECTION-C01` (spec-only, unregistered) still listed the satisfied `"G9G10-FLAG-SOURCE-LANE to integrate"` awaited entry; its live-deployment precondition is verifiably **unmet** (live release `54dce67b` carries the old grid; `class-program-slot.service.ts` blob `9839ea77…` vs the candidate's `75977e60…`) | Satisfied entry removed in this closure turn; `presentedReady=false` / `granted=false` retained; successor correctly **not** unlocked |
| F-A3 | NON_BLOCKING (fail-closed) | F1 confirmed: `getEffectiveEvents` returns at most one row per `eventType`, so the preflight's per-shape validation of *every* eligible flag window can add a `FLAG_CEREMONY_SCOPE_INVALID` blocker the constructor would not render (label-colliding `CUSTOM` event, e.g. "HGP Culminating Activity"). Both paths consume the same per-scope authority | Successor recommendation **G9G10-WINDOW-BREADTH-FOLLOWUP** (below) |
| F-A4 | NON_BLOCKING (verified resolved) | F2: the composition invariant is enforced by production code, not by the tests' literal table — `GRADE_9_10_SPECIAL` no longer spreads `GRADE_9_10_REGULAR` | Closed; no action |
| F-A5 | NON_BLOCKING (verified confined) | F4: `seedShiftBaseline` (`policy-special-event.service.ts:200-206`) still seeds a stale `9-10 / 12:15-13:00` "Afternoon Shift Lunch Break", reachable via `policy-special-event.router.ts:114`; inert on a canonical scope on both consumption paths (`buildSpecialEventSlots` and `buildWarningWindowAuthority` short-circuit to canonical rows) | Successor recommendation **G9G10-SEED-LUNCH-ALIGN** (below) |
| F-A6 | NON_BLOCKING (verified non-blocking) | F5: no gate keys on `CANONICAL_TEMPLATE_VERSION`; it is import+write-only metadata. Freshness is content-bound (`generation-input-snapshot.service.ts:276` hashes `class_program_slots` rows; publication re-compares and can fail `PUBLICATION_INPUTS_STALE`) | Recorded; fold into the seed-lunch successor if it also touches template metadata |
| F-A7 | NON_BLOCKING (verified non-blocking, one named successor) | F6: no hard blocker can become a publishable soft warning — the softened path requires a genuine room-path failure, and publication independently fails closed on any unassigned session (`PUBLISH_BLOCKED_UNASSIGNED_REQUIRED`, `publication-contract.service.ts:281-286`). Residual: for modular items `getQualifiedFacultyIds` is bypassed (`reason: undefined`) and the per-term pool-coverage failure at `:2442` sets `sawFacultySlotUnavailable` **without** recording a `sessionFailureReasons` entry, so a modular cohort deadlock that also fails the room path is now labelled SOFT and under-reports the faculty-pool cause | Successor recommendation **G9G10-MODULAR-COVERAGE-REASON** (below) |

No finding was downgraded for being pre-existing, outside the candidate diff,
rejected later by a server, or covered only by a helper test.

## Successor recommendations (ranked; none unlocked)

All three are ordinary MEDIUM source lanes with no live unlock. They were not
registered as schema `successors[]` entries because that field can only be set
at `create-stream`; they are recorded here and in the stream's `nextAction`.

1. **G9G10-WINDOW-BREADTH-FOLLOWUP** — validate only rendering-eligible windows
   per shape (mirror `overlay.slice(0, 1)`) so a label-colliding non-snapping
   event cannot add a blocker the constructor would not render. Owner: primary
   planner for packet authoring. Dependency: none. Dispatch condition: a new
   operator-activated cycle.
2. **G9G10-SEED-LUNCH-ALIGN** — align `seedShiftBaseline`'s G9/G10 afternoon
   lunch default to the shift ruling (11:30-12:15) and decide whether to advance
   `CANONICAL_TEMPLATE_VERSION`. Owner: primary planner. Dependency: none.
   Dispatch condition: a new operator-activated cycle; must not be folded into
   the `DATA-CORRECTION-C01` reseed.
3. **G9G10-MODULAR-COVERAGE-REASON** — record the modular per-term pool-coverage
   failure in the session failure-reason set with a two-sided test. Owner:
   primary planner. Dependency: none. Dispatch condition: a new
   operator-activated cycle.

## Live-precondition snapshot (read-only, audit session)

- `origin/main` `28cb5dba`; register revision 298; coordination `MANUAL`,
  `activeCycleId: null`.
- Runtime: supervisor launcher PID 4020 running
  `D:\ATLAS-runtime-supervised-54dce67b-20260914\ops\runtime\cli.mjs start`;
  listeners 5001 -> 13244 (`…54dce67b…\atlas-server\dist\server.js`) and
  5174 -> 13260 (`…54dce67b…\ops\runtime\host.mjs`); that release's
  `supervisor-state.json` reads `state: running`, `releaseSha: 54dce67b…`,
  started `2026-09-15T17:25:41Z`, updated `2026-09-15T21:31:17Z`. The older
  `3d916b26` directory reads `stopped`/`degraded` and is a superseded rollback
  artifact only.
- Migrations 0002/0003 were applied by the peer `MIG-APPLY-0002-0003` (not
  independently DB-probed by the auditor). Database tables were not
  independently probed; the no-generation/no-publication conclusion rests on Git
  inventory, runtime identity, and the register.

## Required planner action (all applied in this closure turn)

1. Apply the F-A1 coordination reconciliation — done via `coordination-update`
   at revision 300.
2. Apply the F-A2 `DATA-CORRECTION-C01` awaited-entry removal — done.
3. Record the auditor session id and `AUDIT_CLEAR` — done at revision 299.
4. Pin the closure receipt and mark the stream `COMPLETE`.
5. Keep `DATA-CORRECTION-C01` and every live/HIGH action locked. No deployment,
   generation, publication, login, data apply, or runtime change is authorized by
   this audit.
