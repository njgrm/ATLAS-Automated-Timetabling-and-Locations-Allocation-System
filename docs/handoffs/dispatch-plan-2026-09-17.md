# ATLAS dispatch handoffs — 2026-09-17

Authored 2026-09-17 (Asia/Manila) by the ATLAS head planner at
`origin/main` **`f8d99b16`** (register revision **315**, mode `CYCLE_ACTIVE` /
`ROLLOVER-GRADED-AUTONOMY-C01`).

This is the planner dispatch handoff for every lane named as a next action or a
locked successor. It is **dispatch metadata, not a substitute for the packets**:
each lane's own packet remains the authoritative scope and acceptance document.
Where a packet already exists, this file supplies the role, registration
command, immutable base, gate, and dependency; it does not restate the packet.

## How to read this

- **Dispatchable now** — packet + spec exist and the dependency is already
  satisfied: register and dispatch.
- **Registered, awaiting its own gate** — in the register already; needs a
  pre-action review, an approval sentence, or a correction.
- **Precondition-gated (do not author yet)** — see §7/§8/§10. Authoring a
  fingerprinted packet before its precondition exists produces a pin that is
  stale on arrival, which is exactly the defect class the `MIG-APPLY` wave just
  paid for (auditor F-1). For these lanes the handoff is an activation directive
  naming the exact precondition, and the packet is authored afterwards.

## Lane summary

| # | Lane | State | Risk | Dispatchable now? | Dependency |
| --- | --- | --- | --- | --- | --- |
| 1 | `CONSOLIDATED-DEPLOYMENT-C10` | `RUNNING` (rev 315) | HIGH | No — awaiting pre-action review, then approval sentence | Fresh independent pre-action review over the amended packet |
| 2 | `EXPORT-PRESENTATION-PREMISE-SWEEP-C02` | not registered | MEDIUM (docs only) | **Yes** | Register by CAS |
| 3 | `DATA-CORRECTION-C01` | not registered | HIGH (persisted-config write) | No | A live release whose pin contains `G9G10-FLAG-SOURCE-LANE` (i.e. after lane 1) |
| 4 | `TERM-CACHE-CATCHUP-APPLY` | `HIGH_APPROVAL_REQUIRED` | HIGH | No | **Lane 2** — its packet still asserts a pre-apply registry |
| 5 | `AUTHZ-CLASS-TEMPLATE-LIVE` | `PLANNED` | HIGH | No — precondition-gated | A live release containing `d15be919` (lane 1) |
| 6 | `SYNC-SECTION-ENROLMENT-C01` | `PLANNED` | MEDIUM | No — register when CAS is free | Fresh independent pre-action review; register contention |
| 7 | `LIVE-GENERATION` | `BLOCKED` | HIGH | No — precondition-gated | Zero-hard-blocker readiness on the live release, then a fingerprinted preview |
| 8 | `LIVE-PUBLICATION` | `BLOCKED` | HIGH | No — precondition-gated | An accepted, zero-hard-blocker generation run |
| 9 | `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` | `PLANNED` | HIGH | No | A new operator-activated cycle |

---

## 1. `CONSOLIDATED-DEPLOYMENT-C10` — registered, awaiting its gate

| Item | Value |
| --- | --- |
| Role | Pre-action reviewer (HIGH), then operator approval, then executor |
| Packet | `docs/prompts/consolidated-deployment-c10-2026-09-17.md` (383+ lines after this commit) |
| Spec | `ops/workflow/specs/register/CONSOLIDATED-DEPLOYMENT-C10.json` |
| Worktree / branch | `E:/ATLAS-worktrees/consolidated-deploy-c10` / `chore/consolidated-deploy-c10` |
| Base | `43341ac7…` (recorded at registration; re-verify at dispatch) |
| Risk | HIGH — shared-runtime deployment + durable env change |
| Disposition | `RETIRE_AFTER_INTEGRATION` |

**Amendment made by this handoff commit (blocking, was missing):** §4.1 now names
`launchOwner` = the registered task `\ATLAS-Runtime-Supervisor` (SYSTEM, ONSTART,
`PT0S`, `IgnoreNew`), `launchMechanism` = re-point the task action to the new
release's `node ...\ops\runtime\cli.mjs start` + `schtasks /run /tn
ATLAS-Runtime-Supervisor`, `rollbackLaunchOwner` = the same task, and
`rollbackLaunchMechanism` = symmetric re-point to `54dce67b` (then supervised
`9d293879`). It also forbids starting the runtime as a child of the executor shell
and adds the acceptance obligation to prove the **task-launched** resident owns
5001/5174 and survives the invoking shell's exit. Without this, the mechanical
closure invariant would have failed the action after execution.

**Next action:** commission one fresh independent pre-action review (HIGH, read
only) over the amended packet — historical precedence, base identity, env delta,
launch ownership, rollback symmetry, and the acceptance matrix — then return the
exact approval sentence to the operator. Do not execute before the sentence.

**Two clauses the approval sentence must resolve** (both already in the packet):
whether the four companion-SSO keys are included (executes only against
**rotated** values), and that the SSO clause is dropped if the rotated values were
not provisioned out of band.

## 2. `EXPORT-PRESENTATION-PREMISE-SWEEP-C02` — dispatchable now

| Item | Value |
| --- | --- |
| Role | Executor, `high` reasoning; then fresh QA; then a fresh Wave Completion Auditor (it unblocks a HIGH approval) |
| Packet | `docs/prompts/export-presentation-premise-sweep-c02-2026-09-17.md` (140 lines) |
| Spec | `ops/workflow/specs/register/EXPORT-PRESENTATION-PREMISE-SWEEP-C02.json` (106 lines) |
| Worktree / branch | `E:/ATLAS-worktrees/export-presentation-premise-sweep-c02` / `fix/export-presentation-premise-sweep-c02` |
| Base | `git rev-parse HEAD` at dispatch (currently `origin/main`) |
| Risk | MEDIUM, **docs only**; 30-minute budget, freeze at 23 |
| Disposition | `RETIRE_AFTER_INTEGRATION` |

**Why it matters beyond closure hygiene:** this lane is a **precondition for lane
4**. `TERM-CACHE-CATCHUP-APPLY` is a live `HIGH_APPROVAL_REQUIRED` stream, and its
packet asserts the pre-apply registry (`term-cache-catchup-apply-2026-09-14.md:533`
— *"also apply the pending `0002_companion_sso_code`"*), which the applied
`0002`/`0003` falsified. Do not present lane 4 for approval until this lands.

**Scope guard:** annotate, do not rewrite bodies. The corrected C06B test must not
be touched — its blob must remain `90a957c931a0b0b23726f1e96a713752b3d71a93`. No
product source, test, migration, `prisma/**`, `ops/workflow/**`, register write,
runtime, task, env, database, login, browser, generation, or publication action.

**One path this handoff adds to the packet's owned list** (still docs-only, same
class): the register's own `nextAction` for lane 4 is currently satisfied-as-written
but unexecutable in fact. Reconciling that text is a planner transition, not an
executor edit — see §Registration mechanics. The executor must not touch
`docs/plans/**`.

## 3. `DATA-CORRECTION-C01` — dependency-gated

| Item | Value |
| --- | --- |
| Role | Executor (HIGH), then fresh QA, then pre-action review, then approval |
| Packet | `docs/prompts/data-correction-c01-2026-09-17.md` |
| Spec | `ops/workflow/specs/register/DATA-CORRECTION-C01.json` |
| Base | `git rev-parse HEAD` at dispatch, **after lane 1 is live and verified** |
| Risk | HIGH — persisted-configuration write to the configured database |

**Dependency, stated precisely:** the reseed must run against a live release whose
catalog already contains the corrected grids. If it runs while the old catalog is
live it fails closed the other way (`CANONICAL_TEMPLATE_INCOMPLETE`). So this lane
opens **only after lane 1** is deployed and verified.

**Measured effect to reproduce:** unassigned `123 → 64`, blockers `308 → 113`,
`WORKLOAD_POLICY_BLOCK 244 → 45`; the eight g7/g8 scopes stay byte-identical; both
`subject_section_ownerships.faculty_id` and the receivers'
`faculty_subjects.section_ids` move together. No cap change and no
`allowFlexibleSubjectAssignment` (both rejected as gaming levers).

## 4. `TERM-CACHE-CATCHUP-APPLY` — registered, blocked on lane 2

| Item | Value |
| --- | --- |
| State | `HIGH_APPROVAL_REQUIRED`; `approval.granted = false`, `execution = null` — **not executed** |
| Role | Planner (premise refresh) → independent pre-action review → operator approval → executor |
| Packet | `docs/prompts/term-cache-catchup-apply-2026-09-14.md` |
| Risk | HIGH — live persisted term-authority write + one bounded login |

Correct the record before acting: the **capture/preview** completed 2026-09-14
(login audit 793, fingerprint `d4cd7cc4…`, `confirmationText
SAVE_TERM_AUTHORITY_1_9`). The **apply itself has never run**. Its preconditions
must be regenerated from the current 4-migration registry and re-reviewed before
any approval sentence is requested.

## 5. `AUTHZ-CLASS-TEMPLATE-LIVE` — precondition-gated (do not author yet)

| Item | Value |
| --- | --- |
| State | `PLANNED`; register `nextAction` already states: *"Author the HIGH deployment packet first: exact target release containing `d15be919`…"* |
| Precondition | Lane 1 live, proving the class-template write-on-read route is no longer reachable unauthenticated and cross-tenant |
| Handoff | **Activation directive only.** After lane 1 is verified, author a HIGH packet that (a) pins the now-live release, (b) probes the route family for missing/invalid JWT, non-privileged role, missing actor school, cross-school actor, and valid same-school actor, (c) asserts **zero downstream dispatch and zero writes** on every rejection, and (d) records the exact permitted write count. Author it after the deployment, not now — a pre-pinned packet would be stale on arrival |

## 6. `SYNC-SECTION-ENROLMENT-C01` — register when the CAS is free

| Item | Value |
| --- | --- |
| Role | Executor, then fresh QA |
| Packet | `docs/prompts/sync-section-enrolment-c01-2026-09-17.md` |
| Spec | `ops/workflow/specs/register/SYNC-SECTION-ENROLMENT-C01.json` |
| Risk | MEDIUM |
| Dependency | Register by CAS once the peer cycle stops transitioning; then one fresh independent pre-action review |

**Cross-lane fact this handoff records:** EnrollPro's current `section_mirrors`
rows for school year 9 are all `enrolledCount 0` (20 rows), while year 8 carries
20 rows totalling 81 enrolments. Confirm with the operator whether the year-9
zeroes are the true state or an unsynced mirror before treating enrolment-driven
behaviour as authoritative. This is a **product question**, not a bug to fix
silently.

## 7. `LIVE-GENERATION` — precondition-gated (do not author yet)

| Item | Value |
| --- | --- |
| State | `BLOCKED` — register `nextAction`: *"Remain locked; no fingerprinted generation preview or approval is authorized."* |
| Preconditions | Lane 1 live; lane 3 applied and verified; then the canonical readiness diagnostic on the live release proves zero hard blockers with exact source freshness |
| Handoff | **Activation directive.** Author the fingerprinted generation preview only after lanes 1–3: reuse the canonical preflight/readiness consumer (the `TT-READINESS-TERM-C03R3` path), record the input fingerprint, and request the exact approval sentence. Do not generate from this handoff |

## 8. `LIVE-PUBLICATION` — precondition-gated (do not author yet)

| Value |
| --- |
| State `BLOCKED` — *"Remain locked until an accepted, zero-hard-blocker generation run exists."* |
| Preconditions: an accepted generation run with **zero hard violations**, a fresh publication preview, and independent QA. Soft/policy blockers are permitted by the operator's ruling; hard violations are not |
| Handoff: activation directive only, authored after lane 7 produces an accepted run |

## 9. `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` — needs a new cycle

Register `nextAction`: *"Re-plan the TERM-CACHE-CATCHUP-APPLY refresh under a new
operator-activated cycle."* No packet is authored; the refresh should fold into
lane 4's premise regeneration rather than run as its own lane unless the operator
wants it separate.

## Registration mechanics (copy-ready)

Run from a checkout whose `HEAD` is current `origin/main` — `create-stream` fails
closed `DIRECTIVE_COPY_STALE` otherwise. Re-read the revision immediately before
invoking: the peer cycle is transitioning concurrently and the CAS will reject a
stale expectation (this is a guard, not a failure).

```bash
# 1. Re-read the true revision (never cache it across a concurrent writer)
node -e "console.log(require('./docs/plans/atlas-delivery-cycles.json').registry.revision)"

# 2. Register a lane by CAS, with its spec carrying the atomic executor lease
node ops/workflow/transition.mjs \
  --transition create-stream \
  --state docs/plans/atlas-delivery-cycles.json \
  --expect-revision <revision-read-in-step-1> \
  --stream-spec ops/workflow/specs/register/<STREAM-ID>.json \
  --render docs/plans/atlas-active-delivery-streams.generated.md

# 3. Verify both gates after every transition
node ops/workflow/verify-cycle.mjs --state docs/plans/atlas-delivery-cycles.json
node ops/workflow/render-register.mjs --check \
  --state docs/plans/atlas-delivery-cycles.json \
  --output docs/plans/atlas-active-delivery-streams.generated.md
```

On a CAS rejection, re-read the revision and re-apply **the same intended change**
— never hand-edit machine state and never force-push. Expect contention: the peer
`ROLLOVER-GRADED-AUTONOMY-C01` lane took revisions 310–311 during the `MIG-APPLY`
turn and the register is currently `CYCLE_ACTIVE`.

**Planner-only register corrections this handoff requires** (not executor scope):

1. Lane 4's `nextAction` must name lane 2 as its dependency, so no one presents
   `TERM-CACHE-CATCHUP-APPLY` for approval against a packet that its own
   divergence rule renders unexecutable.
2. Lane 5's `nextAction` already correctly names the "target release containing
   `d15be919`" precondition — no change needed; it becomes actionable after lane 1.

## Boundaries that apply to every lane

- No lane may touch the shared 5001/5174 runtime, `D:\ATLAS-runtime-config\`, the
  configured database, or any companion repository except under its own approved
  HIGH packet.
- Only one lane may swap or restart the shared runtime at a time; lane 1 owns that
  boundary until it is verified live.
- Executors commit a candidate and return `REVIEW_REQUIRED`; they never
  self-approve, merge, push, or edit the living register.
- `HIGH` lanes execute only against the operator's exact approval sentence, and
  every `HIGH` runtime packet must name all four launch-ownership fields.
