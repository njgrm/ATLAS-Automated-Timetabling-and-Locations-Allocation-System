# Directive revision proposal â€” 2026-09-17 (DEFERRED, not applied)

Status: **proposal only.** `AGENTS.md` is deliberately **unmodified** here. The
directive blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88` (LF-SHA-256
`7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`) is pinned
inside live packets â€” including `CONSOLIDATED-DEPLOYMENT-C10` Â§0 â€” so editing it
mid-flight invalidates every declared pin. Apply this as **one deliberate
revision**, after C10 closes, in the same commit as `WORKFLOW-PIN-SEMANTICS-C01`.

## Evidence base

Findings from the `CONSOLIDATED-DEPLOYMENT-C10` cycle and the preceding waves:

- C10 required **four** pre-action review rounds before execution; all four
  traced to prose assertions about production code written without checking the
  pinned source (mis-cited `ATLAS_SYSTEM_TOKEN` authority; an undefined row-8
  result; an incomplete Â§5.3 write set).
- **Two consecutive operator sentences were non-executable** at the boundary
  (an unfilled placeholder; a re-added clause contradicting the prior sentence).
- The frozen pin was invalidated **three times** by unrelated register-only
  pushes â€” the governance rule was broken by the workflow's own concurrency.
- Execution stalled on four zero-cost preconditions (unstartable rollback tier,
  read-only env DACL, missing `safe.directory`, absent provisioning file).

## Proposed changes

### R1 â€” Pin semantics: immutable SHA, not tip

Replace tip-equality with: pin is an ancestor of `origin/main` **and** the packet
blob at the pin equals the reviewed blob **and** the register names that SHA.
Rationale: the release is built from the SHA; concurrent register pushes are
irrelevant. Implemented by `WORKFLOW-PIN-SEMANTICS-C01`.

### R2 â€” Citation claims must be mechanically verified before review

Any `file:line` or behavioural claim in a HIGH packet must be reproduced from the
pinned tree before the packet is offered for pre-action review, and the packet
must carry a fenced claim list (`path:line` + expected symbol) that
`pins.mjs check --packet` validates. Rationale: converts review rounds into
authoring-time failures.

### R3 â€” Approval sentences are fill-in templates

Every planner-handoff approval sentence must enumerate **every** placeholder
(`<PIN40>`, `<PROVISIONING_PATH>`, `<ACL clause>`, `<LOGIN_BUDGET>`, â€¦). A
sentence containing an unfilled placeholder, or contradicting the previously
recorded clause in the same field, is refused before dispatch. Rationale: two
non-executable sentences cost a full cycle each.

### R4 â€” Tiered ceremony

Reserve multi-round review, receipts, leases, and the Wave Completion Auditor for
genuine HIGH boundaries (shared-runtime, schema/data apply, publication,
generation, auth/tenant authority). Docs-only, tests-only, and bookkeeping lanes
get **one** review and no receipt chain or auditor. Rationale: ceremony is
currently flat, so a docs annotation and a 540-commit release receive the same
treatment.

### R5 â€” Hard correction budget

One bounded correction plus a fresh review is normal. A **second** substantive
correction on the same packet requires a planner decision, not a third review
round. Rationale: makes the existing budget rule enforceable rather than
advisory.

### R6 â€” Collapse duplicated status surfaces

Keep one machine-readable register plus its generated projection. Retire the
hand-maintained prose register and drop receipt/pin ceremony for non-HIGH lanes.
Rationale: a lane whose entire purpose is correcting documents-about-state is a
signal the documentation layer has outgrown its value.

### R7 â€” Dispatch preflight is mandatory for HIGH actions

No HIGH packet may be offered for approval until
`WORKFLOW-DISPATCH-PREFLIGHT-C01`'s probe reports all preconditions satisfiable.
Rationale: every C10 stall was a free check performed too late.

### R8 â€” `record-execution` is paired with a coordination refresh, same turn

Recording an execution must, in the **same turn**, refresh
`coordination.globalNextAction` and correct `git.candidateSha` /
`git.changedPaths`. Rationale: without the pairing the register keeps advertising
the pre-execution state while the runtime has already moved â€” the drift that
produced C10's B2 finding.

### R9 â€” The approval boundary and the dispatch prompt are one source

`approval.approvedActions` is transcribed **from** the dispatched executor
prompt, and any authorization present in the prompt but absent from
`approvedActions` is refused at dispatch. Rationale: C10's B1 finding was not an
unauthorized act but a record gap â€” the operator explicitly instructed the
conditional `safe.directory` addition in the dispatch prompt, and the recorded
boundary was narrower. A granted approval is immutable, so the defect can only be
reconciled by errata; preventing it at dispatch is strictly cheaper.

### R10 â€” Environment prerequisites are named up front in HIGH boundaries

For any HIGH install, the boundary must name the environment prerequisites that
can silently escape `approvedActions`: Git trust-allowlist / ownership
(`safe.directory`) for a release directory that may be created by an elevated
process, the target env file's DACL and which principal will write it, and every
named input artifact the clause depends on. Rationale: covered operationally by
`WORKFLOW-DISPATCH-PREFLIGHT-C01` check 5, and required here as an authoring rule
so the boundary text and the probe agree.

### R11 â€” No-change assertions are capture-derived

Any "unchanged" assertion in evidence (config, env, ACL, listeners, rows) must be
derived from a recorded before/after capture, never from intent. Rationale: the
C10 cutover evidence made three false "config unchanged" claims, each of which a
trivial before/after snapshot would have prevented.

### R12 â€” Closure requires a recorded auditor verdict and matching tallies

A stream may not close while `review.auditorVerdict` is null after an auditor has
returned, or while the machine gate tally and the reported tally disagree.
Rationale: at C10's first closure attempt the auditor verdict was unrecorded and
`gates.total` (16, of a 3-source + 13-live plan) disagreed with the reported
`14/14/0/0`.

### R13 â€” Retain load-bearing state rather than reverting it

When an unrecorded but operationally load-bearing change is found (a trust
allowlist, an ownership adjustment, a DACL), and reverting it is untestable
without a HIGH action while retention risk is bounded, **retain and ratify by
errata** rather than reverting. Never retroactively mutate a granted approval's
`approvedActions`. Rationale: the C10 B1 decision â€” removing the entry could have
broken the SYSTEM-run supervisor's pin check on the next restart or boot.

### R14 â€” Reconcile every superseded wording location in the same turn

After any transition that changes a stream's state, blocker, `nextAction`, or
`awaited`, immediately **grep the register, the generated projection, and the
stream's own evidence artifacts for the superseded wording and reconcile every
occurrence in the same turn, before committing.** A `reconcile-stream` /
`close-cycle` step must not leave a sibling location asserting the previous
state â€” including a coordination snapshot still awaiting a decision the operator
has already made.

Rationale: the same defect cost C10 **two** review rounds. The auditor (round 1,
B2) blocked on stale coordination and git fields, and the fresh QA (round 2, F1,
16/15/1/0) blocked again because the stream blocker said "B1 RESOLVED" while
`coordination.globalNextAction` and the errata's closure bar still awaited an
operator decision that had already been made. The register recorded only one QA
round and left `review.auditorVerdict` null while an auditor had returned â€” the
same class, caught by R12 at closure.

Operational form: after recording any state transition, run a search for the
superseded phrase (the old state name, the old blocker, "awaiting <decision>",
the retired release id) and fix every hit before the commit. This joins the
existing cross-section consistency gate as a commit-time obligation.

## Staging convention for process improvements

Every cycle report ends with a process-improvement note. Those notes are lost when
the session ends, and only committed files persist. Therefore:

- This file is the **single staging area** for directive improvements. No separate
  "memory" file is created â€” an extra surface adds to the sprawl R6 removes and an
  unreferenced file is ignored (cf. the retired `.github/copilot-instructions.md`).
- At each cycle closure, append that cycle's process-improvement note here as a
  numbered rule with its rationale and the incident that produced it.
- Rules land in `AGENTS.md` only in one deliberate revision, then the
  corresponding entries are struck from this file. The file is retired when
  empty.

## Measurement (to prove the revision worked)

| Metric | C10 baseline | Target |
| --- | --- | --- |
| Pre-action review rounds per HIGH packet | 4 | â‰¤ 2 |
| Non-executable operator sentences | 2 | 0 |
| Preconditions found at execution rather than authoring | 4 | 0 |
| Pin invalidations caused by unrelated pushes | 3 | 0 |

## Sequencing

1. C10 closes (execution is already performed; matrix, acceptance review, and
   Wave Auditor outstanding).
2. Register `WORKFLOW-PIN-SEMANTICS-C01` and `WORKFLOW-DISPATCH-PREFLIGHT-C01`.
3. Apply R1â€“R13 as **one** `AGENTS.md` revision with those two lanes' evidence,
   then re-pin the directive and reconcile every packet that declares the old
   hash.
