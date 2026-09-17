# Directive revision proposal — 2026-09-17 (DEFERRED, not applied)

Status: **proposal only.** `AGENTS.md` is deliberately **unmodified** here. The
directive blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88` (LF-SHA-256
`7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`) is pinned
inside live packets — including `CONSOLIDATED-DEPLOYMENT-C10` §0 — so editing it
mid-flight invalidates every declared pin. Apply this as **one deliberate
revision**, after C10 closes, in the same commit as `WORKFLOW-PIN-SEMANTICS-C01`.

## Evidence base

Findings from the `CONSOLIDATED-DEPLOYMENT-C10` cycle and the preceding waves:

- C10 required **four** pre-action review rounds before execution; all four
  traced to prose assertions about production code written without checking the
  pinned source (mis-cited `ATLAS_SYSTEM_TOKEN` authority; an undefined row-8
  result; an incomplete §5.3 write set).
- **Two consecutive operator sentences were non-executable** at the boundary
  (an unfilled placeholder; a re-added clause contradicting the prior sentence).
- The frozen pin was invalidated **three times** by unrelated register-only
  pushes — the governance rule was broken by the workflow's own concurrency.
- Execution stalled on four zero-cost preconditions (unstartable rollback tier,
  read-only env DACL, missing `safe.directory`, absent provisioning file).

## Proposed changes

### R1 — Pin semantics: immutable SHA, not tip

Replace tip-equality with: pin is an ancestor of `origin/main` **and** the packet
blob at the pin equals the reviewed blob **and** the register names that SHA.
Rationale: the release is built from the SHA; concurrent register pushes are
irrelevant. Implemented by `WORKFLOW-PIN-SEMANTICS-C01`.

### R2 — Citation claims must be mechanically verified before review

Any `file:line` or behavioural claim in a HIGH packet must be reproduced from the
pinned tree before the packet is offered for pre-action review, and the packet
must carry a fenced claim list (`path:line` + expected symbol) that
`pins.mjs check --packet` validates. Rationale: converts review rounds into
authoring-time failures.

### R3 — Approval sentences are fill-in templates

Every planner-handoff approval sentence must enumerate **every** placeholder
(`<PIN40>`, `<PROVISIONING_PATH>`, `<ACL clause>`, `<LOGIN_BUDGET>`, …). A
sentence containing an unfilled placeholder, or contradicting the previously
recorded clause in the same field, is refused before dispatch. Rationale: two
non-executable sentences cost a full cycle each.

### R4 — Tiered ceremony

Reserve multi-round review, receipts, leases, and the Wave Completion Auditor for
genuine HIGH boundaries (shared-runtime, schema/data apply, publication,
generation, auth/tenant authority). Docs-only, tests-only, and bookkeeping lanes
get **one** review and no receipt chain or auditor. Rationale: ceremony is
currently flat, so a docs annotation and a 540-commit release receive the same
treatment.

### R5 — Hard correction budget

One bounded correction plus a fresh review is normal. A **second** substantive
correction on the same packet requires a planner decision, not a third review
round. Rationale: makes the existing budget rule enforceable rather than
advisory.

### R6 — Collapse duplicated status surfaces

Keep one machine-readable register plus its generated projection. Retire the
hand-maintained prose register and drop receipt/pin ceremony for non-HIGH lanes.
Rationale: a lane whose entire purpose is correcting documents-about-state is a
signal the documentation layer has outgrown its value.

### R7 — Dispatch preflight is mandatory for HIGH actions

No HIGH packet may be offered for approval until
`WORKFLOW-DISPATCH-PREFLIGHT-C01`'s probe reports all preconditions satisfiable.
Rationale: every C10 stall was a free check performed too late.

## Measurement (to prove the revision worked)

| Metric | C10 baseline | Target |
| --- | --- | --- |
| Pre-action review rounds per HIGH packet | 4 | ≤ 2 |
| Non-executable operator sentences | 2 | 0 |
| Preconditions found at execution rather than authoring | 4 | 0 |
| Pin invalidations caused by unrelated pushes | 3 | 0 |

## Sequencing

1. C10 closes (execution is already performed; matrix, acceptance review, and
   Wave Auditor outstanding).
2. Register `WORKFLOW-PIN-SEMANTICS-C01` and `WORKFLOW-DISPATCH-PREFLIGHT-C01`.
3. Apply R1–R7 as **one** `AGENTS.md` revision with those two lanes' evidence,
   then re-pin the directive and reconcile every packet that declares the old
   hash.
