# ATLAS Active Delivery Streams

Last reconciled: 2026-09-11 (Asia/Manila)

This is the current operational register for executor, QA, integration, and
operator-action streams. Historical phase plans and per-stream ledgers are
evidence, not alternate status boards. Only the primary planner or integration
owner updates this file.

## Current objective

Complete an understandable EnrollPro-driven rollover into one authoritative
derived-demand flow, preserve prior-year Teaching Load as visible history with
an optional audited carry-forward, and reach one generated schedule with zero
hard blockers before separately approving publication.

## Current coordination snapshot

- Wave 1 is integrated and pushed: `origin/main` now points to
  `36c5d3d1735728c1870f5e0ccfe36ca54a8a6b5d`.
- All three source lanes passed independent QA and the combined integration
  gates. The term schema migration remains a separate live `HIGH` action.
- EnrollPro, AIMS, and SMART reference clones were cleanly fast-forwarded to
  `bf12d0de`, `a22c9c88`, and `c3806e12`. The current EnrollPro implementation
  now exposes `/active-term`, but still lacks the complete ordered term contract
  and silently defaults an unresolved active date to `T1`.
- No live migration, carry-forward, generation, or publication is authorized by
  this register.

## Stream register

| Stream | Objective | State | Risk | Git boundary | Dependency or blocker | Last decisive evidence | Exact next action |
|---|---|---|---|---|---|---|---|
| GEN-ZW01 | Make generation passive over Teaching Load and close actor/audit/write authority | `INTEGRATED` | MEDIUM | `work/generation-zw01`; `e39da520...00488bbf` | None | Independent QA and combined Wave-1 integration gates passed | Closed into `origin/main` at `36c5d3d1` |
| RR-UX01 | Visible rollover awareness, one Year Setup status surface, and read-only archived Teaching Load | `INTEGRATED` | MEDIUM | `work/rollover-rrux01`; `00488bbf...ea44e155` | None | Independent QA and combined Wave-1 integration gates passed | Closed into `origin/main` at `36c5d3d1` |
| TERM-SUBJ-C01 | Consume exact EnrollPro term authority and prepare Subject scheduling metadata without false operative controls | `INTEGRATED` | MEDIUM source; HIGH live migration | `work/term-subject-c01`; `e39da520...8abc2ab1` | Live migration remains separate | Independent QA passed 13/13 server authority and 11/11 client controls; combined builds passed | Prepare the separate live migration preview; do not apply without HIGH approval |
| W1-INTEGRATION | Combine the three accepted Wave-1 source lanes | `INTEGRATED` | MEDIUM | `integration/rollover-derived-demand-w1`; `e39da520...36c5d3d1` | None | Shared-doc-only conflicts matched forecast; focused GEN/RR/TERM suites, both builds/type-checks, diff-check, and isolated server health passed | Closed and pushed to `origin/main` at `36c5d3d1` |
| ENROLLPRO-TERM-HANDOFF | Make EnrollPro expose authoritative ordered term identities, labels, dates, and active term | `DECISION_REQUIRED` | External dependency | EnrollPro `bf12d0de` is READ_ONLY from ATLAS | EnrollPro developer must implement; current `/school-year` omits complete ordered terms and `/active-term` defaults unresolved dates to `T1` | Current-code handoff written at `docs/handoffs/enrollpro-authoritative-term-contract-handoff-2026-09-11.md` | Deliver the handoff to EnrollPro developers and obtain their implementation SHA |
| TERM-LIVE-APPLY | Apply the accepted Subject/term schema migration to the verified ATLAS database | `CLOSED` | HIGH | `work/term-live-migration-preview`; `36c5d3d1...1520d1fc` | None | Exact operator approval received; guarded wrapper revalidated the approved backup; `0001` applied; enum/columns exact; 21 scheduled + one canonical-HG reference-only; protected domains unchanged; receipt at `docs/verification/term-subject-live-migration-apply-2026-09-11.md` | Closed at evidence commit `1520d1fc`; rollback remains available but was not executed |
| MIG-GUARD-R1 | Make the canonical guarded migration command locate the root Prisma schema without manual forwarded arguments | `PLANNED` | LOW | Fresh branch from current `origin/main` | None; must preserve backup revalidation and spawn ordering | First live invocation passed its backup gate but Prisma stopped before migration because the wrapper omitted `../prisma/schema.prisma`; supported forwarded argument succeeded | Implement a narrow command-path correction with failing-first spawn-argument coverage; no live migration |
| W1-RUNTIME-DEPLOY | Deploy the integrated Wave-1 server/client against the migrated schema and verify truthful blocked term authority | `PLANNED` | MEDIUM service lifecycle | Current `origin/main`; isolated build before shared-runtime action | Coordinate with any TL-UX live browser run; EnrollPro ordered term contract may still be absent | Port 5001 health is 200 but `/subjects` returns no new disposition projection after migration, proving the live process predates integrated Wave-1 source | Prepare a bounded build/restart/Tailnet acceptance handoff; do not restart while another live-QA stream is using port 5001 |
| TL-UX-C01 | Rebuild Teaching Load as an accessible remaining-height master-detail assignment workspace and remove contradictory/dead actions | `PLANNED` | MEDIUM UI plus HIGH-risk interaction guards | Fresh `D:/ATLAS-worktrees/teaching-load-ux-c01`, branch `work/teaching-load-ux-c01`, from refreshed `origin/main` | Migration preview may run concurrently; avoid term-schema migration and derived-demand implementation files | Full click-path audit: dormant split-brain preview remains; reconciliation can preview 265 removals with missing term authority; Change owner can silently exchange an unrelated section; sequential multi-teacher saves can partially persist; jump list is a no-op; mutable state is not fully scope-bound | Execute `docs/prompts/teaching-load-ux-one-shot-tluxc01-2026-09-11.md`; commit a bounded candidate after mandatory live Tailnet plus isolated-candidate Playwright QA and independent review |
| TT-UX01 | Make Timetable no-run and Advanced states honest, single-action, dead-end-free, readable, and mobile-reachable | `CORRECTION_REQUIRED` | MEDIUM UI with HIGH interaction guardrails | `work/timetable-ux-01`; `aab8fb00...aa38d784` | Must not implement DEMAND-C01; avoid TL-UX shared paths | Planner review reproduced 34/34 focused, 155/155 tracked client tests, TypeScript/build/diff-check, but found dead `/curriculum-requirements` repair, Advanced generation readiness bypass, no-run task/teacher-recovery dead ends, over-broad capability gating, and context-insensitive tutorial | Execute `docs/prompts/timetable-ux-one-shot-ttux01r-2026-09-11.md` in the existing worktree and return an additive correction candidate |
| DEMAND-C01 | Replace annual Curriculum Requirements authority with one deterministic derived-demand contract | `PLANNED` | MEDIUM | Fresh branch after Wave-1 integration | Accepted term contract and passive generation/TL boundaries | Governing sequence exists in `rollover-derived-demand-generation-readiness-sequence-2026-09-10.md` | Author and execute the bounded DEMAND-C01 prompt from the integrated Wave-1 base |
| UX-C01 | Remove Curriculum Requirements/Decision Workspace from normal workflow and explain derived setup plainly | `BLOCKED` | MEDIUM UI | Not started | DEMAND-C01 must be real first | Product decision recorded in governing sequence | Start in parallel with later demand-consumer work only after DEMAND-C01 establishes replacement truth |
| TL-RR01 | Preview and optionally carry forward last year's Teaching Load into empty current-year demand | `BLOCKED` | MEDIUM preview; HIGH apply | Not started | DEMAND-C01 plus visible archived history | Carry-forward rules are defined in the governing sequence | Build zero-write preview after DEMAND-C01; require a separate approval for apply |
| GEN-C02 | Use canonical term-aware derived demand and close grade-window/class-program-slot/hard-blocker gaps | `BLOCKED` | MEDIUM source; HIGH generation | Not started | DEMAND-C01 and reconciled/carry-forward current-year Teaching Load | GEN-C01 proved the old production-demand mismatch and is superseded | Execute read-only canonical dry-run work after derived demand is authoritative |
| LIVE-GENERATION | Generate one current-year schedule and reach zero hard violations/unresolved sessions | `BLOCKED` | HIGH | Not started | GEN-C02 zero-hard-blocker preview and explicit approval | No current authorization | Prepare fingerprinted preview, independent QA, then request explicit generation approval |
| LIVE-PUBLICATION | Publish the accepted zero-hard-blocker schedule | `BLOCKED` | HIGH | Publication authority source is integrated on `origin/main` | Completed current-year run with zero hard violations, fresh publication preview, independent QA, explicit approval | PUB-C01R3 source is integrated; no publication authorized | Begin only after successful generation and review closure |

## Superseded or closed streams

| Stream | State | Disposition |
|---|---|---|
| SCA-01 through SCA-04 | `SUPERSEDED` | Useful evidence and year-8 transition history; the operator-facing Curriculum Requirements workflow is no longer the intended annual authority |
| GEN-C01 (`2e922d6d`) | `SUPERSEDED` | Diagnostic evidence feeds GEN-C02; do not rebase or integrate blindly because it used the split legacy demand model |
| TT-C02 / TT-C03 | `INTEGRATED` | Preview-only insertion and shared candidate invariants are represented on `origin/main` through integration commits |
| TT-C04 | `INTEGRATED` | Operator lifecycle UX hardening is on `origin/main` via `84d64437` |
| PUB-C01R3 | `INTEGRATED` | Publication authority hardening is on `origin/main` via `63a15a37`; live publication remains a separate HIGH action |
| Year-8 SCA/TL data applies | `CLOSED` | Historical transition completed; do not mistake those applies for automatic authority in the newly rolled-over year |

## Dependency-ordered queue

1. Correct the guarded command's default Prisma schema path and coordinate one
   integrated Wave-1 runtime deployment without interrupting another live-QA
   stream.
2. Deliver the EnrollPro term-contract handoff and obtain its implementation
   SHA while TL-UX-C01 runs in a disjoint worktree.
3. Run TL-UX-C01 in a disjoint client-focused worktree while term/upstream work
   continues.
4. Correct TT-UX01 on its existing branch; do not integrate `aa38d784`.
5. Execute DEMAND-C01 after the live term contract and required ATLAS migration
   are available.
6. After DEMAND-C01, run UX-C01, TL-RR01 preview, and GEN-C02 in parallel where
   their file ownership is disjoint.
7. Resolve GEN-C02 hard blockers and produce a zero-hard-blocker generation
   preview.
8. Obtain explicit HIGH approval, generate once, verify the completed run, then
   prepare the separate publication preview and approval.

## Safe parallel work now

- EnrollPro developer implementation from the ATLAS handoff; EnrollPro remains
  READ_ONLY to ATLAS agents.
- MIG-GUARD-R1 source/test correction, with no live migration.
- TL-UX-C01 client-focused correction, provided it does not touch term-schema,
  derived-demand, reconciliation authority, generation, or publication paths.
- TT-UX01R in its existing client worktree. Avoid further shared primitive
  changes that could collide with TL-UX-C01 unless the correction proves they
  are necessary.

Do not start DEMAND-C01, UX-C01, TL-RR01, GEN-C02, generation, or publication
until their dependency rows above are satisfied. Do not restart the shared
runtime while TL-UX live QA is active.

## Awaited returns and decisions

- No Wave-1 executor or QA result is awaited; all three candidates are integrated.
- EnrollPro developer ownership, implementation SHA, and deployment timing for
  the complete term payload remain external decisions.
- No migration approval is awaited; `0001_term_subject_authority` is applied and
  verified. Runtime deployment remains a separate planner-coordinated action.
- TT-UX01 is awaiting an additive executor correction from `aa38d784`; the
  current candidate is not integration-ready.

## Update protocol

For each status change, update the affected row, the queue, safe parallel work,
and awaited returns in the same planner turn. Record only current concise truth
here; put detailed commands, test counts, findings, and correction history in
the stream's progress ledger and Git commits.
