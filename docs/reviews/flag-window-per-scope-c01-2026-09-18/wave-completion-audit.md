# Wave Completion Audit — FLAG-WINDOW-PER-SCOPE-C01

## Capsule

| Field | Value |
| --- | --- |
| Auditor task/session ID | `ses_f4e526b67ffeo75Gl82NAXarF9` (returned by the invoking harness) |
| Model / reasoning variant | `opencode-go/deepseek-v4.1-flash`; recommended `max` **unavailable** on the active provider catalog — audited at the strongest available variant. **Fallback disclosed.** |
| Reviewed `origin/main` | `027acfba9648a85bceba8aeb03f996d8b4125804` (independently fetched) |
| Base | `0f8a2dabcb9d055e674d4b7b508918a2daa795c6` |
| Candidate | `aab5dced189e511ac463394b7a08ea4c543ad580` |
| Integration | `aab5dced…` (fast-forward; `027acfba`'s sole product parent is `aab5dced`) |
| Range | `0f8a2dab..aab5dced` = exactly 3 paths |
| Mandatory tally | **8 / 8 / 0 / 0 / 0** (all `MANDATORY_SOURCE`; `MANDATORY_LIVE 0`; `DEFERRED_EXTERNAL 0`) |
| **Verdict** | **`AUDIT_CLEAR`** |
| Register | `FLAG-WINDOW-PER-SCOPE-C01`, revision 372, state `INTEGRATED` |

## What was audited

`generation-preflight.service.ts` resolved the Monday Flag/HGP overlay per scope but
fell back to the single **global** policy window (`07:00-07:30`) whenever a shape had no
scoped `PolicySpecialEvent` rows, then failed closed with `FLAG_CEREMONY_SCOPE_INVALID`
when that window was contained by no canonical CLASS row. Because the canonical grids are
shift-specific, the morning default was reported as invalid configuration for the
afternoon shift — 8 false blockers on the live active year (`schoolYearId=10`; G9/G10 ×
REGULAR/STE/SPA/SPS). `schedule-constructor.ts:538-559` `resolvePolicyFlagOverlaySlots`
resolved the same overlay permissively and silently rendered no overlay, so the gate was
stricter than the only consumer it guarded.

The candidate makes **explicit configuration fail closed** (a configured scoped flag row
that cannot snap still blocks) while an **inapplicable global default produces no blocker
and no overlay**. The constructor is the parity reference and was not edited.

## New adversarial checks run by the auditor

1. Independent Git identity: `027acfba` contains `aab5dced`; fast-forward proven via `rev-list --parents`.
2. Exactly-3-path range confirmed by `--name-status` / `--numstat`.
3. Parity reference byte-identity: `schedule-constructor.ts` blob `b9e397df…` identical base = candidate = deployed release.
4. **Consumer hunt beyond the QA-traced two** — whole-tree search for `FLAG_CEREMONY_SCOPE_INVALID`, `flagCeremony*`, `resolvePolicyFlagOverlaySlots`, `buildDayScopedEventWindows`, `getEffectiveEvents`. No other gate consumer. Emitters: preflight (2 sites) plus `timetable-shape-policy.service.ts:226` (independent non-Monday predicate). All overlay renderers (`published-identity-snapshot`, `published-schedule`, `room-schedule`, `warning-window-authority`, `pre-generation-draft`, `generation-shape-assembly`) are permissive resolvers and never relied on the removed fail-closed behaviour. No client reference.
5. **Strict-subset proof**: candidate blockers ⊆ base blockers for every input; the candidate also collapses N per-window blockers to one per shape (matching the constructor's `slice(0,1)`).
6. **`gradeGroup: null` construction**: a globally-scoped persisted row resolves for every shape in *both* base and candidate, so it still blocks fail-closed under both. No configuration exists where the candidate blocks more than base.
7. **Deliberate test update is contract-required**: `slot-break-authority-c11.test.ts` C10 inverts `assert.ok(unsnappable blocker)` → `assert.equal(…, false, …)` with in-file justification; the old guard is now exercised by the new `generation-stakeholder-shape-genc02r.test.ts` control B. No assertion silently removed (diff +9/−3, all traced).
8. **Successor claim verified against source and stakeholder authority**: `class-program-slot.service.ts:214-240` shows both `GRADE_9_10_REGULAR` and `GRADE_9_10_SPECIAL` contain a `12:15-13:00` **CLASS** row, so a scoped row at `12:15-13:00` snaps and renders. Direct read of `grade9STE_Sched.jpg` confirms Monday `12:15-1:00 = Flag Ceremony/HGP`. Both claims TRUE.
9. **Live preconditions / no mutation**: deployed release `131baab7` has `generation-preflight.service.ts` byte-identical to base and differing from candidate → the release genuinely lacks the candidate. Listeners `5001→30164`, `5174→47088` under the task-launched supervisor. No runtime/task/env/data change attributable to this wave.
10. **Register cross-section consistency**: literal search confirms the stream row, gate tally, git-boundary row, blocker row, session routing and awaited section all agree on `INTEGRATED` with no competing wording.

## Findings

**Blocking: none.**

- **F1 — NON_BLOCKING (evidence classification).** Packet gate 1 was worded as the live
  diagnostic reporting 0, but the register records it under `MANDATORY_SOURCE` and the
  candidate is correctly undeployed. The source-level proof through the real
  `buildGenerationPreflight` (8 on base → 0 on candidate) is legitimate and is the only
  proof possible under the packet's no-deploy boundary. **Reconciled:** the live
  diagnostic rerun is now explicitly a deployment-time acceptance row, not a live claim.
- **F2 — NON_BLOCKING (successor design, carried into the register).**
  `resolvePolicyFlagOverlaySlots` skips the global `07:00-07:30` fallback as soon as *any*
  flag row exists, so adding only G9/G10 rows at `12:15-13:00` would **silently drop the
  G7/G8 morning overlay**. The companion HIGH packet must configure/verify the **G7/G8
  morning authority** as well.
- **F3 — NON_BLOCKING (pre-existing asymmetry, awareness only).**
  `buildTimetableShapeContract` renders the overlay only from persisted effective events
  and never from the global policy window, whereas `resolvePolicyFlagOverlaySlots` does.
  Pre-dates this wave; unchanged by it.
- **F4 — NON_BLOCKING (audit environment).** The auditor could not re-execute the
  candidate suites: the integration worktree's `node_modules` is a shared read-only
  junction whose `.prisma/client` is an uninitialized stub, and regenerating it would
  mutate shared dependencies. QA evidence was reused (valid — the reviewed tree is
  byte-identical to the integrated candidate and unchanged since QA); all independent
  static and adversarial checks completed.
- **F5 — NON_BLOCKING (successor registration).** The companion HIGH data action exists
  only as blocker prose (`successors: []`); it needs a stream ID when its packet is
  authored.

## Required primary-planner action (all applied)

1. ✅ Recorded `AUDIT_CLEAR` + session ID in the register (revision 371).
2. ✅ Applied the docs-only F1/F2 reconciliation (revision 372).
3. ⬜ Register the companion HIGH data-action stream and carry F2/F3 into its packet; keep the write **NOT GRANTED**.
4. ✅ No deploy, generation, publication, or data apply from this wave.

## Live-precondition snapshot (audited 2026-09-18, read-only)

- `origin/main` = `027acfba…`; candidate contained; fast-forward integration.
- Deployed release `131baab7d68fcc8a1a9b874d88e30f45d56a63e0` at `D:\ATLAS-runtime-supervised-131baab7-20260918`; **lacks the candidate**.
- Listeners `5001→30164`, `5174→47088`; machine env `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` = `131baab7…`.
- No login, data apply, generation, publication, migration, deploy, or service restart attributable to this wave.

## Evidence reused

QA `ses_f4e5e9a6bffe3CbGoa96ZUcok3` (`ACCEPT_READY` 8/8, zero blocked/unperformed) and
executor `ses_f4e6955e0ffed5KoQIb3ynhWTN`. Reuse valid: reviewed tree byte-identical to the
integrated candidate and unchanged since QA.
